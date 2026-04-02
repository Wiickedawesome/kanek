-- 00040_job_application_flow.sql
-- Change job posts to a multi-applicant, owner-accept flow.
--
-- Before: first applicant auto-confirmed → post filled immediately, no owner choice.
-- After:  apply → booking pending (post stays open)
--         owner accepts → booking confirmed, contract created, post filled,
--                          other pending applicants cancelled
--         owner rejects → booking cancelled, post stays open

-- ════════════════════════════════════════════════
-- 1. BEFORE INSERT: job bookings start as pending
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

  IF v_post.type = 'route_offer' THEN
    -- Auto-confirm, increment seats, fill when full
    NEW.status := 'confirmed';
    v_new_seats := COALESCE(v_post.seats_filled, 0) + NEW.seats_booked;

    IF v_post.seats_total IS NOT NULL AND v_new_seats > v_post.seats_total THEN
      RAISE EXCEPTION 'Not enough seats available';
    END IF;

    UPDATE posts SET seats_filled = v_new_seats WHERE id = NEW.post_id;

    IF v_post.seats_total IS NOT NULL AND v_new_seats >= v_post.seats_total THEN
      UPDATE posts SET status = 'filled' WHERE id = NEW.post_id;
    END IF;

  ELSIF v_post.type = 'job' THEN
    -- Leave pending — post stays open until owner accepts one applicant
    NEW.status := 'pending';

  ELSE
    -- errand, package, route_request: auto-confirm and fill immediately
    NEW.status := 'confirmed';
    UPDATE posts SET status = 'filled' WHERE id = NEW.post_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════
-- 2. AFTER INSERT: skip contract creation for job (deferred to acceptance)
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

  -- Create contract for all types EXCEPT job
  -- Job contract is created when the owner accepts an applicant
  IF v_post_type != 'job' THEN
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
  END IF;

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
    v_notif_title := 'New Applicant!';
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
-- 3. RPC: accept a specific job applicant
-- ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION accept_job_application(p_booking_id uuid)
RETURNS void AS $$
DECLARE
  v_booking      RECORD;
  v_post         RECORD;
  v_contract_id  uuid;
  v_applicant_name text;
BEGIN
  -- Load and lock booking
  SELECT id, post_id, user_id, status
    INTO v_booking
    FROM bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.status != 'pending' THEN
    RAISE EXCEPTION 'Booking is not in a pending state';
  END IF;

  -- Load post
  SELECT id, author_id, type, title,
         origin_address, dest_address, origin_lat, origin_lng,
         dest_lat, dest_lng, pay_rate_cents, departure_at
    INTO v_post
    FROM posts
   WHERE id = v_booking.post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Authorization: only the post author can accept
  IF auth.uid() != v_post.author_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- 1. Confirm accepted booking
  UPDATE bookings
     SET status = 'confirmed'
   WHERE id = p_booking_id;

  -- 2. Create contract for the accepted applicant
  INSERT INTO contracts (
    post_id, booking_id, parties,
    origin_address, origin_coords,
    dest_address, dest_coords,
    agreed_price_cents, departure_at,
    status
  ) VALUES (
    v_post.id,
    p_booking_id,
    ARRAY[v_post.author_id, v_booking.user_id],
    v_post.origin_address,
    CASE WHEN v_post.origin_lat IS NOT NULL AND v_post.origin_lng IS NOT NULL
         THEN point(v_post.origin_lng::float, v_post.origin_lat::float)
         ELSE NULL END,
    v_post.dest_address,
    CASE WHEN v_post.dest_lat IS NOT NULL AND v_post.dest_lng IS NOT NULL
         THEN point(v_post.dest_lng::float, v_post.dest_lat::float)
         ELSE NULL END,
    COALESCE(v_post.pay_rate_cents, 0),
    v_post.departure_at,
    'active'
  )
  RETURNING id INTO v_contract_id;

  -- 3. Mark post as filled
  UPDATE posts SET status = 'filled' WHERE id = v_post.id;

  -- 4. Cancel all other pending applicants on this post
  UPDATE bookings
     SET status = 'cancelled',
         cancelled_at = now(),
         cancel_reason = 'Another applicant was accepted'
   WHERE post_id = v_post.id
     AND id != p_booking_id
     AND status = 'pending';

  -- 5. Notify the accepted applicant
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_booking.user_id,
    'job_accepted',
    'You Got the Job!',
    'You were accepted for "' || v_post.title || '".',
    jsonb_build_object(
      'postId', v_post.id,
      'bookingId', p_booking_id,
      'contractId', v_contract_id
    )
  );

  -- 6. Notify the post owner (match confirmation)
  SELECT COALESCE(first_name || ' ' || last_name, first_name, 'Someone')
    INTO v_applicant_name
    FROM profiles
   WHERE id = v_booking.user_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_post.author_id,
    'job_match_confirmed',
    'Match Confirmed!',
    v_applicant_name || ' has been confirmed for "' || v_post.title || '".',
    jsonb_build_object(
      'postId', v_post.id,
      'bookingId', p_booking_id,
      'contractId', v_contract_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_job_application(uuid) TO authenticated;

-- ════════════════════════════════════════════════
-- 4. RPC: reject a specific job applicant
-- ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION reject_job_application(p_booking_id uuid)
RETURNS void AS $$
DECLARE
  v_booking RECORD;
  v_post    RECORD;
BEGIN
  SELECT id, post_id, user_id, status
    INTO v_booking
    FROM bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.status != 'pending' THEN
    RAISE EXCEPTION 'Booking is not in a pending state';
  END IF;

  SELECT id, author_id
    INTO v_post
    FROM posts
   WHERE id = v_booking.post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF auth.uid() != v_post.author_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Cancel the booking; handle_booking_status_change trigger keeps post open
  UPDATE bookings
     SET status = 'cancelled',
         cancelled_at = now(),
         cancel_reason = 'Application declined'
   WHERE id = p_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reject_job_application(uuid) TO authenticated;
