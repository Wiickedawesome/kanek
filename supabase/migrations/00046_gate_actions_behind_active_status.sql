-- 00046_gate_actions_behind_active_status.sql
-- Prevent users from posting or booking until their account is approved (active).
--
-- Before: any authenticated user could INSERT posts and bookings regardless of account_status.
-- After:  only users with account_status = 'active' can INSERT posts and bookings.

-- ═══════════════════════════════════════
-- Helper: check if current user is active
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION is_active_account()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ═══════════════════════════════════════
-- POSTS: restrict INSERT to active users
-- ═══════════════════════════════════════

-- Drop the old permissive INSERT policy
DROP POLICY IF EXISTS "posts_insert_authenticated" ON posts;

-- New policy: only active accounts can create posts
CREATE POLICY "posts_insert_active_only" ON posts
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND is_active_account());

-- ═══════════════════════════════════════
-- BOOKINGS: restrict INSERT to active users
-- ═══════════════════════════════════════

-- Drop the old permissive INSERT policy
DROP POLICY IF EXISTS "bookings_insert_authenticated" ON bookings;

-- New policy: only active accounts can create bookings
CREATE POLICY "bookings_insert_active_only" ON bookings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_active_account());

-- ═══════════════════════════════════════
-- Also gate the accept_applicant and reject_applicant RPCs
-- These are SECURITY DEFINER, so RLS doesn't apply inside them.
-- We add an explicit check at the top of each function.
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION accept_applicant(p_booking_id uuid)
RETURNS void AS $$
DECLARE
  v_booking        RECORD;
  v_post           RECORD;
  v_contract_id    uuid;
  v_applicant_name text;
  v_new_seats      integer;
  v_rejected       RECORD;
  v_accept_title   text;
  v_accept_body    text;
  v_reject_title   text;
  v_reject_body    text;
  v_caller_status  text;
BEGIN
  -- Gate: only active accounts can accept applicants
  SELECT account_status INTO v_caller_status
    FROM profiles WHERE id = auth.uid();
  IF v_caller_status IS NULL OR v_caller_status != 'active' THEN
    RAISE EXCEPTION 'Your account must be approved before you can accept applicants';
  END IF;

  -- Load and lock booking
  SELECT id, post_id, user_id, status, seats_booked
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

  -- Load and lock post
  SELECT id, author_id, type, title,
         origin_address, dest_address, origin_lat, origin_lng,
         dest_lat, dest_lng, price_cents, errand_fee_cents,
         pay_rate_cents, departure_at,
         seats_total, seats_filled
    INTO v_post
    FROM posts
   WHERE id = v_booking.post_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Authorization: only the post author can accept
  IF auth.uid() != v_post.author_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- For route_offer: check we won't exceed seat limit
  IF v_post.type = 'route_offer' AND v_post.seats_total IS NOT NULL THEN
    v_new_seats := COALESCE(v_post.seats_filled, 0) + v_booking.seats_booked;
    IF v_new_seats > v_post.seats_total THEN
      RAISE EXCEPTION 'Not enough seats available to accept this booking';
    END IF;
  END IF;

  -- 1. Confirm the booking
  UPDATE bookings SET status = 'confirmed' WHERE id = p_booking_id;

  -- 2. Create contract
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
    COALESCE(v_post.errand_fee_cents, v_post.pay_rate_cents, v_post.price_cents, 0),
    v_post.departure_at,
    'active'
  )
  RETURNING id INTO v_contract_id;

  -- 3. Handle post status based on type
  IF v_post.type = 'route_offer' THEN
    v_new_seats := COALESCE(v_post.seats_filled, 0) + v_booking.seats_booked;
    UPDATE posts SET seats_filled = v_new_seats WHERE id = v_post.id;

    IF v_post.seats_total IS NOT NULL AND v_new_seats >= v_post.seats_total THEN
      UPDATE posts SET status = 'filled' WHERE id = v_post.id;

      UPDATE bookings
         SET status = 'rejected'
       WHERE post_id = v_post.id
         AND id != p_booking_id
         AND status = 'pending';
    END IF;
  ELSE
    UPDATE posts SET status = 'filled' WHERE id = v_post.id;

    UPDATE bookings
       SET status = 'rejected'
     WHERE post_id = v_post.id
       AND id != p_booking_id
       AND status = 'pending';
  END IF;

  -- 4. Get applicant name for notifications
  SELECT COALESCE(first_name || ' ' || last_name, first_name, 'Someone')
    INTO v_applicant_name
    FROM profiles
   WHERE id = v_booking.user_id;

  -- 5. Set per-type acceptance notification text
  CASE v_post.type
    WHEN 'route_offer' THEN
      v_accept_title := 'Seat Confirmed!';
      v_accept_body  := 'Your seat on "' || v_post.title || '" has been confirmed by the driver.';
    WHEN 'route_request' THEN
      v_accept_title := 'Drive Accepted!';
      v_accept_body  := 'You were accepted to drive "' || v_post.title || '".';
    WHEN 'errand' THEN
      v_accept_title := 'Errand Confirmed!';
      v_accept_body  := 'You were accepted for the errand "' || v_post.title || '".';
    WHEN 'package' THEN
      v_accept_title := 'Delivery Confirmed!';
      v_accept_body  := 'You were accepted to deliver "' || v_post.title || '".';
    WHEN 'job' THEN
      v_accept_title := 'You Got the Job!';
      v_accept_body  := 'You were accepted for "' || v_post.title || '".';
    ELSE
      v_accept_title := 'Accepted!';
      v_accept_body  := 'You were accepted for "' || v_post.title || '".';
  END CASE;

  -- Notify accepted applicant
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_booking.user_id,
    'applicant_accepted',
    v_accept_title,
    v_accept_body,
    jsonb_build_object(
      'postId', v_post.id,
      'bookingId', p_booking_id,
      'contractId', v_contract_id
    )
  );

  -- 6. Notify owner (match confirmation)
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_post.author_id,
    'match_confirmed',
    'Match Confirmed!',
    v_applicant_name || ' has been confirmed for "' || v_post.title || '".',
    jsonb_build_object(
      'postId', v_post.id,
      'bookingId', p_booking_id,
      'contractId', v_contract_id
    )
  );

  -- 7. Notify rejected applicants (batch)
  CASE v_post.type
    WHEN 'route_offer' THEN
      v_reject_title := 'Seat Not Available';
      v_reject_body  := 'The seats on "' || v_post.title || '" have been filled.';
    WHEN 'route_request' THEN
      v_reject_title := 'Driver Selected';
      v_reject_body  := 'Another driver was selected for "' || v_post.title || '".';
    WHEN 'errand' THEN
      v_reject_title := 'Errand Taken';
      v_reject_body  := 'Someone else was selected for the errand "' || v_post.title || '".';
    WHEN 'package' THEN
      v_reject_title := 'Delivery Taken';
      v_reject_body  := 'Someone else was selected for the delivery "' || v_post.title || '".';
    WHEN 'job' THEN
      v_reject_title := 'Job Filled';
      v_reject_body  := 'Another applicant was selected for "' || v_post.title || '".';
    ELSE
      v_reject_title := 'Not Selected';
      v_reject_body  := 'Another person was selected for "' || v_post.title || '".';
  END CASE;

  FOR v_rejected IN
    SELECT id, user_id
      FROM bookings
     WHERE post_id = v_post.id
       AND id != p_booking_id
       AND status = 'rejected'
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_rejected.user_id,
      'applicant_rejected',
      v_reject_title,
      v_reject_body,
      jsonb_build_object(
        'postId', v_post.id,
        'bookingId', v_rejected.id
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also gate the booking creation trigger
CREATE OR REPLACE FUNCTION handle_new_booking_before()
RETURNS trigger AS $$
DECLARE
  v_post           RECORD;
  v_pending_seats  integer;
  v_booker_status  text;
BEGIN
  -- Gate: only active accounts can create bookings
  SELECT account_status INTO v_booker_status
    FROM profiles WHERE id = NEW.user_id;
  IF v_booker_status IS NULL OR v_booker_status != 'active' THEN
    RAISE EXCEPTION 'Your account must be approved before you can book';
  END IF;

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

  -- For route_offer: check seat availability against pending + confirmed bookings
  IF v_post.type = 'route_offer' THEN
    SELECT COALESCE(SUM(seats_booked), 0)
      INTO v_pending_seats
      FROM bookings
     WHERE post_id = NEW.post_id
       AND status IN ('pending', 'confirmed');

    IF v_post.seats_total IS NOT NULL
       AND (v_pending_seats + NEW.seats_booked) > v_post.seats_total THEN
      RAISE EXCEPTION 'Not enough seats available';
    END IF;
  END IF;

  -- ALL types: booking starts as pending
  NEW.status := 'pending';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

