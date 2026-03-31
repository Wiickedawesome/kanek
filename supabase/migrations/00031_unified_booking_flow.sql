-- 00031_unified_booking_flow.sql
-- Unify booking flow: ALL post types auto-confirm bookings,
-- mark post as 'filled', and create contracts.
--
-- Previously only errand/package auto-confirmed.
-- route_offer left bookings pending, route_request/job did nothing.
-- Now all types behave the same: book → confirmed → filled → complete.

-- ════════════════════════════════════════════════
-- 1. BEFORE INSERT: auto-confirm for ALL types
-- ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_booking_before()
RETURNS trigger AS $$
DECLARE
  v_post        RECORD;
  v_new_seats   integer;
BEGIN
  SELECT id, author_id, type, title, status, seats_total, seats_filled
    INTO v_post
    FROM posts
   WHERE id = NEW.post_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_post.status != 'open' THEN
    RAISE EXCEPTION 'Post is no longer open for bookings';
  END IF;

  IF NEW.user_id = v_post.author_id THEN
    RAISE EXCEPTION 'Cannot book your own post';
  END IF;

  -- Auto-confirm the booking for all types
  NEW.status := 'confirmed';

  -- ROUTE OFFER: increment seats_filled
  IF v_post.type = 'route_offer' THEN
    v_new_seats := COALESCE(v_post.seats_filled, 0) + NEW.seats_booked;

    IF v_post.seats_total IS NOT NULL AND v_new_seats > v_post.seats_total THEN
      RAISE EXCEPTION 'Not enough seats available';
    END IF;

    UPDATE posts SET seats_filled = v_new_seats WHERE id = NEW.post_id;

    -- Mark filled when seats are full
    IF v_post.seats_total IS NOT NULL AND v_new_seats >= v_post.seats_total THEN
      UPDATE posts SET status = 'filled' WHERE id = NEW.post_id;
    END IF;

  -- ALL OTHER TYPES: single-booking, mark post filled immediately
  ELSE
    UPDATE posts SET status = 'filled' WHERE id = NEW.post_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════
-- 2. AFTER INSERT: create contract + notification for ALL types
-- ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_booking_after()
RETURNS trigger AS $$
DECLARE
  v_post        RECORD;
  v_author_id   uuid;
  v_post_type   text;
  v_post_title  text;
  v_booker_name text;
  v_notif_title text;
  v_notif_body  text;
  v_notif_type  text;
  v_contract_id uuid;
BEGIN
  SELECT id, author_id, type, title,
         origin_address, dest_address, origin_lat, origin_lng,
         dest_lat, dest_lng, price_cents, departure_at,
         errand_fee_cents
    INTO v_post
    FROM posts
   WHERE id = NEW.post_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  v_author_id  := v_post.author_id;
  v_post_type  := v_post.type;
  v_post_title := v_post.title;

  SELECT COALESCE(first_name || ' ' || last_name, first_name, 'Someone')
    INTO v_booker_name
    FROM profiles
   WHERE id = NEW.user_id;

  -- Create contract for ALL post types
  INSERT INTO contracts (
    post_id, booking_id, parties,
    origin_address, origin_coords,
    dest_address, dest_coords,
    agreed_price_cents, departure_at,
    status
  ) VALUES (
    NEW.post_id,
    NEW.id,
    ARRAY[v_author_id, NEW.user_id],
    v_post.origin_address,
    CASE WHEN v_post.origin_lat IS NOT NULL AND v_post.origin_lng IS NOT NULL
         THEN point(v_post.origin_lng::float, v_post.origin_lat::float)
         ELSE NULL END,
    v_post.dest_address,
    CASE WHEN v_post.dest_lat IS NOT NULL AND v_post.dest_lng IS NOT NULL
         THEN point(v_post.dest_lng::float, v_post.dest_lat::float)
         ELSE NULL END,
    COALESCE(v_post.errand_fee_cents, v_post.price_cents, 0),
    v_post.departure_at,
    'active'
  )
  RETURNING id INTO v_contract_id;

  -- Set notification text per type
  IF v_post_type = 'route_offer' THEN
    v_notif_type  := 'new_booking';
    v_notif_title := 'Seat Booked!';
    v_notif_body  := v_booker_name || ' booked ' || NEW.seats_booked || ' seat(s) on "' || v_post_title || '".';

  ELSIF v_post_type = 'route_request' THEN
    v_notif_type  := 'new_booking';
    v_notif_title := 'Driver Offered!';
    v_notif_body  := v_booker_name || ' offered to drive your route "' || v_post_title || '".';

  ELSIF v_post_type IN ('errand', 'package') THEN
    v_notif_type  := 'errand_accepted';
    v_notif_title := CASE WHEN v_post_type = 'errand' THEN 'Errand Accepted!' ELSE 'Delivery Accepted!' END;
    v_notif_body  := v_booker_name || ' accepted your ' || v_post_type || ' "' || v_post_title || '".';

  ELSIF v_post_type = 'job' THEN
    v_notif_type  := 'job_application';
    v_notif_title := 'Job Application!';
    v_notif_body  := v_booker_name || ' applied for "' || v_post_title || '".';
  END IF;

  -- Notify post author
  IF v_author_id IS NOT NULL AND v_author_id != NEW.user_id AND v_notif_type IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_author_id,
      v_notif_type,
      v_notif_title,
      v_notif_body,
      jsonb_build_object(
        'postId', NEW.post_id,
        'bookingId', NEW.id,
        'bookerId', NEW.user_id,
        'contractId', v_contract_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════
-- 3. Fix cancellation to handle contracts for ALL types
-- ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_booking_status_change()
RETURNS trigger AS $$
DECLARE
  v_post_type text;
  v_remaining_active bigint;
BEGIN
  -- ═══════════════════════════════
  -- CANCELLATION
  -- ═══════════════════════════════
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN

    SELECT type INTO v_post_type FROM posts WHERE id = NEW.post_id;

    -- Delete contract for this booking (all types now have contracts)
    DELETE FROM contracts WHERE booking_id = NEW.id;

    IF v_post_type = 'route_offer' THEN
      -- Decrement seats
      UPDATE posts
         SET seats_filled = GREATEST(0, COALESCE(seats_filled, 0) - OLD.seats_booked),
             status = CASE WHEN status = 'filled' THEN 'open' ELSE status END
       WHERE id = NEW.post_id;
    ELSE
      -- For all other types: re-open if no remaining active bookings
      SELECT count(*) INTO v_remaining_active
        FROM bookings
       WHERE post_id = NEW.post_id
         AND id != NEW.id
         AND status NOT IN ('cancelled', 'no_show', 'completed');

      IF v_remaining_active = 0 THEN
        UPDATE posts SET status = 'open'
         WHERE id = NEW.post_id AND status IN ('filled', 'in_progress');
      END IF;
    END IF;
  END IF;

  -- ═══════════════════════════════
  -- COMPLETION
  -- ═══════════════════════════════
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN

    UPDATE contracts
       SET status = 'completed', completed_at = now()
     WHERE booking_id = NEW.id AND status != 'completed';

    SELECT count(*) INTO v_remaining_active
      FROM bookings
     WHERE post_id = NEW.post_id
       AND id != NEW.id
       AND status IN ('pending', 'confirmed');

    IF v_remaining_active = 0 THEN
      UPDATE posts SET status = 'completed'
       WHERE id = NEW.post_id AND status NOT IN ('completed', 'cancelled');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════
-- 4. Fix existing data: confirm pending bookings and fill their posts
-- ════════════════════════════════════════════════
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT bk.id as booking_id, bk.post_id, bk.user_id, bk.seats_booked,
           p.author_id, p.type, p.title, p.origin_address,
           p.origin_lat, p.origin_lng, p.dest_address,
           p.dest_lat, p.dest_lng, p.price_cents,
           p.departure_at, p.errand_fee_cents
      FROM bookings bk
      JOIN posts p ON bk.post_id = p.id
     WHERE bk.status = 'pending'
  LOOP
    -- Confirm the booking
    UPDATE bookings SET status = 'confirmed' WHERE id = rec.booking_id;

    -- Mark post filled (except route_offer which may have more seats)
    IF rec.type != 'route_offer' THEN
      UPDATE posts SET status = 'filled' WHERE id = rec.post_id AND status = 'open';
    END IF;

    -- Create contract if one doesn't exist
    IF NOT EXISTS (SELECT 1 FROM contracts WHERE booking_id = rec.booking_id) THEN
      INSERT INTO contracts (
        post_id, booking_id, parties,
        origin_address, origin_coords,
        dest_address, dest_coords,
        agreed_price_cents, departure_at,
        status
      ) VALUES (
        rec.post_id,
        rec.booking_id,
        ARRAY[rec.author_id, rec.user_id],
        rec.origin_address,
        CASE WHEN rec.origin_lat IS NOT NULL AND rec.origin_lng IS NOT NULL
             THEN point(rec.origin_lng::float, rec.origin_lat::float)
             ELSE NULL END,
        rec.dest_address,
        CASE WHEN rec.dest_lat IS NOT NULL AND rec.dest_lng IS NOT NULL
             THEN point(rec.dest_lng::float, rec.dest_lat::float)
             ELSE NULL END,
        COALESCE(rec.errand_fee_cents, rec.price_cents, 0),
        rec.departure_at,
        'active'
      );
    END IF;
  END LOOP;
END $$;
