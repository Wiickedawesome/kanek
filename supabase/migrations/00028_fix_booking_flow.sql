-- 00028_fix_booking_flow.sql
-- Fixes critical issues in the booking flow:
-- 1. Add 'filled' to post_status enum (trigger was using non-existent value)
-- 2. Rewrite trigger with FOR UPDATE lock to prevent race conditions
-- 3. Add booking cancellation trigger to revert post state
-- 4. Add CASCADE on contracts.booking_id FK

-- ════════════════════════════════════════════════
-- 1. Add 'filled' to post_status enum
-- ════════════════════════════════════════════════
ALTER TYPE post_status ADD VALUE IF NOT EXISTS 'filled';

-- ════════════════════════════════════════════════
-- 2. Replace trigger with race-condition-safe version
-- ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_booking()
RETURNS trigger AS $$
DECLARE
  v_post        RECORD;
  v_author_id   uuid;
  v_post_type   text;
  v_post_title  text;
  v_booker_name text;
  v_new_seats   integer;
  v_notif_title text;
  v_notif_body  text;
  v_notif_type  text;
  v_contract_id uuid;
BEGIN
  -- Fetch + lock the post row to prevent race conditions
  SELECT id, author_id, type, title, status, seats_total, seats_filled,
         origin_address, dest_address, origin_lat, origin_lng,
         dest_lat, dest_lng, price_cents, departure_at,
         errand_fee_cents
    INTO v_post
    FROM posts
   WHERE id = NEW.post_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Reject bookings on non-open posts
  IF v_post.status != 'open' THEN
    RAISE EXCEPTION 'Post is no longer open for bookings';
  END IF;

  v_author_id := v_post.author_id;
  v_post_type := v_post.type;
  v_post_title := v_post.title;

  -- Prevent self-booking
  IF NEW.user_id = v_author_id THEN
    RAISE EXCEPTION 'Cannot book your own post';
  END IF;

  -- Get booker's name for notification
  SELECT COALESCE(first_name || ' ' || last_name, first_name, 'Someone')
    INTO v_booker_name
    FROM profiles
   WHERE id = NEW.user_id;

  -- ═══════════════════════════════════
  -- ROUTE OFFER: increment seats_filled
  -- ═══════════════════════════════════
  IF v_post_type = 'route_offer' THEN
    v_new_seats := COALESCE(v_post.seats_filled, 0) + NEW.seats_booked;

    -- Check seat availability
    IF v_post.seats_total IS NOT NULL AND v_new_seats > v_post.seats_total THEN
      RAISE EXCEPTION 'Not enough seats available';
    END IF;

    UPDATE posts
       SET seats_filled = v_new_seats
     WHERE id = NEW.post_id;

    -- If seats are full, mark post as filled
    IF v_post.seats_total IS NOT NULL AND v_new_seats >= v_post.seats_total THEN
      UPDATE posts SET status = 'filled' WHERE id = NEW.post_id;
    END IF;

    v_notif_type := 'new_booking';
    v_notif_title := 'New Seat Booked';
    v_notif_body := v_booker_name || ' booked ' || NEW.seats_booked || ' seat(s) on "' || v_post_title || '".';

  -- ═══════════════════════════════════
  -- ROUTE REQUEST: driver offered to drive
  -- ═══════════════════════════════════
  ELSIF v_post_type = 'route_request' THEN
    v_notif_type := 'new_booking';
    v_notif_title := 'Driver Offered';
    v_notif_body := v_booker_name || ' offered to drive your route "' || v_post_title || '".';

  -- ═══════════════════════════════════
  -- ERRAND / PACKAGE: auto-confirm + create contract + fill post
  -- ═══════════════════════════════════
  ELSIF v_post_type IN ('errand', 'package') THEN
    -- Auto-confirm the booking
    NEW.status := 'confirmed';

    -- Mark post as filled (removes from feed)
    UPDATE posts SET status = 'filled' WHERE id = NEW.post_id;

    -- Create contract
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

    v_notif_type := 'errand_accepted';
    v_notif_title := CASE WHEN v_post_type = 'errand' THEN 'Errand Accepted!' ELSE 'Delivery Accepted!' END;
    v_notif_body := v_booker_name || ' accepted your ' || v_post_type || ' "' || v_post_title || '". A contract has been created.';

  -- ═══════════════════════════════════
  -- JOB: someone applied
  -- ═══════════════════════════════════
  ELSIF v_post_type = 'job' THEN
    v_notif_type := 'job_application';
    v_notif_title := 'New Job Application';
    v_notif_body := v_booker_name || ' applied for "' || v_post_title || '".';
  END IF;

  -- ═══════════════════════════════════
  -- Create in-app notification for post author
  -- ═══════════════════════════════════
  IF v_author_id IS NOT NULL AND v_author_id != NEW.user_id THEN
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
-- 3. Add booking cancellation/update trigger
--    Reverts post state when a booking is cancelled
-- ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_booking_status_change()
RETURNS trigger AS $$
DECLARE
  v_post_type text;
  v_remaining_active bigint;
BEGIN
  -- Only act when status changes TO 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN

    SELECT type INTO v_post_type FROM posts WHERE id = NEW.post_id;

    IF v_post_type IN ('errand', 'package') THEN
      -- Delete associated contract
      DELETE FROM contracts WHERE booking_id = NEW.id;

      -- Check if any other active bookings exist on this post
      SELECT count(*) INTO v_remaining_active
        FROM bookings
       WHERE post_id = NEW.post_id
         AND id != NEW.id
         AND status NOT IN ('cancelled', 'no_show');

      -- Re-open the post if no other active bookings
      IF v_remaining_active = 0 THEN
        UPDATE posts SET status = 'open' WHERE id = NEW.post_id AND status = 'filled';
      END IF;

    ELSIF v_post_type = 'route_offer' THEN
      -- Decrement seats_filled
      UPDATE posts
         SET seats_filled = GREATEST(0, COALESCE(seats_filled, 0) - OLD.seats_booked),
             status = CASE
               WHEN status = 'filled' THEN 'open'
               ELSE status
             END
       WHERE id = NEW.post_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_booking_status_change
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION handle_booking_status_change();

-- ════════════════════════════════════════════════
-- 4. Fix contracts.booking_id FK to cascade on delete
-- ════════════════════════════════════════════════
ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_booking_id_fkey;

ALTER TABLE contracts
  ADD CONSTRAINT contracts_booking_id_fkey
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
