-- 00027_booking_flow_trigger.sql
-- Automate the booking flow: when a booking is inserted,
-- update seats_filled, auto-confirm for 1:1 post types,
-- create contracts, and notify the post author.

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
  -- Fetch the post this booking belongs to
  SELECT id, author_id, type, title, status, seats_total, seats_filled,
         origin_address, dest_address, origin_lat, origin_lng,
         dest_lat, dest_lng, price_cents, departure_at,
         errand_fee_cents
    INTO v_post
    FROM posts
   WHERE id = NEW.post_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_author_id := v_post.author_id;
  v_post_type := v_post.type;
  v_post_title := v_post.title;

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

-- Use BEFORE INSERT so we can modify NEW.status for auto-confirm
CREATE TRIGGER on_booking_inserted
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION handle_new_booking();

-- Also need INSERT policy for contracts from the trigger (runs as SECURITY DEFINER, so OK)
-- And INSERT policy for notifications from the trigger (also SECURITY DEFINER, so OK)

-- Allow notifications INSERT from trigger (service role / security definer handles this)
-- No additional policy needed since the function is SECURITY DEFINER.
