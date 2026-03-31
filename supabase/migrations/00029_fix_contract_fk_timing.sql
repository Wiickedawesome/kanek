-- 00029_fix_contract_fk_timing.sql
-- Fixes: "insert or update on table contracts violates FK contracts_booking_id_fkey"
--
-- ROOT CAUSE: handle_new_booking() runs as BEFORE INSERT on bookings.
-- It uses NEW.id to insert into contracts(booking_id), but the booking row
-- hasn't been committed yet, so the FK check fails.
--
-- FIX: Split into two triggers:
--   1. BEFORE INSERT  → validates post, updates seats/status, sets NEW.status
--   2. AFTER INSERT   → creates contract + notification (booking row now exists)

-- ════════════════════════════════════════════════
-- 1. BEFORE INSERT: validation, seat updates, auto-confirm status
-- ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_booking_before()
RETURNS trigger AS $$
DECLARE
  v_post        RECORD;
  v_new_seats   integer;
BEGIN
  -- Fetch + lock the post row to prevent race conditions
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

  -- Prevent self-booking
  IF NEW.user_id = v_post.author_id THEN
    RAISE EXCEPTION 'Cannot book your own post';
  END IF;

  -- ROUTE OFFER: increment seats_filled, check overflow
  IF v_post.type = 'route_offer' THEN
    v_new_seats := COALESCE(v_post.seats_filled, 0) + NEW.seats_booked;

    IF v_post.seats_total IS NOT NULL AND v_new_seats > v_post.seats_total THEN
      RAISE EXCEPTION 'Not enough seats available';
    END IF;

    UPDATE posts SET seats_filled = v_new_seats WHERE id = NEW.post_id;

    IF v_post.seats_total IS NOT NULL AND v_new_seats >= v_post.seats_total THEN
      UPDATE posts SET status = 'filled' WHERE id = NEW.post_id;
    END IF;

  -- ERRAND / PACKAGE: auto-confirm booking + fill post
  ELSIF v_post.type IN ('errand', 'package') THEN
    NEW.status := 'confirmed';
    UPDATE posts SET status = 'filled' WHERE id = NEW.post_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════
-- 2. AFTER INSERT: create contract + notification
--    (booking row now exists so FK is satisfied)
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

  -- ROUTE OFFER
  IF v_post_type = 'route_offer' THEN
    v_notif_type  := 'new_booking';
    v_notif_title := 'New Seat Booked';
    v_notif_body  := v_booker_name || ' booked ' || NEW.seats_booked || ' seat(s) on "' || v_post_title || '".';

  -- ROUTE REQUEST
  ELSIF v_post_type = 'route_request' THEN
    v_notif_type  := 'new_booking';
    v_notif_title := 'Driver Offered';
    v_notif_body  := v_booker_name || ' offered to drive your route "' || v_post_title || '".';

  -- ERRAND / PACKAGE: create contract
  ELSIF v_post_type IN ('errand', 'package') THEN
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

    v_notif_type  := 'errand_accepted';
    v_notif_title := CASE WHEN v_post_type = 'errand' THEN 'Errand Accepted!' ELSE 'Delivery Accepted!' END;
    v_notif_body  := v_booker_name || ' accepted your ' || v_post_type || ' "' || v_post_title || '". A contract has been created.';

  -- JOB
  ELSIF v_post_type = 'job' THEN
    v_notif_type  := 'job_application';
    v_notif_title := 'New Job Application';
    v_notif_body  := v_booker_name || ' applied for "' || v_post_title || '".';
  END IF;

  -- Create notification for post author
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
-- 3. Replace old trigger with the two new ones
-- ════════════════════════════════════════════════
DROP TRIGGER IF EXISTS on_booking_inserted ON bookings;

-- Drop the old combined function
DROP FUNCTION IF EXISTS handle_new_booking();

CREATE TRIGGER on_booking_before_insert
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION handle_new_booking_before();

CREATE TRIGGER on_booking_after_insert
  AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION handle_new_booking_after();
