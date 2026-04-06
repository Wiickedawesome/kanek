-- 00045_universal_applicant_review.sql
-- Generalize the job-only applicant-review flow to ALL post types.
--
-- Before: only job posts used pending → owner-accept flow.
--         route_offer auto-confirmed, errand/package/route_request auto-confirmed + auto-filled.
-- After:  ALL types start as pending, post stays open, owner reviews applicants,
--         owner accepts → confirmed + contract created, others rejected.
--         route_offer supports multi-seat acceptance.

-- ════════════════════════════════════════════════
-- 1. Add 'rejected' to booking_status enum
-- ════════════════════════════════════════════════
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'rejected';

-- ════════════════════════════════════════════════
-- 2. BEFORE INSERT: all bookings start as pending
-- ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_new_booking_before()
RETURNS trigger AS $$
DECLARE
  v_post           RECORD;
  v_pending_seats  integer;
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

-- ════════════════════════════════════════════════
-- 3. AFTER INSERT: notify owner (no contract created)
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
BEGIN
  SELECT id, author_id, type, title
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

  -- All types now use "application" / "request" language
  IF v_post_type = 'route_offer' THEN
    v_notif_type  := 'new_applicant';
    v_notif_title := 'New Rider Request!';
    v_notif_body  := v_booker_name || ' wants to book ' || NEW.seats_booked || ' seat(s) on "' || v_post_title || '". Review and accept.';

  ELSIF v_post_type = 'route_request' THEN
    v_notif_type  := 'new_applicant';
    v_notif_title := 'Driver Offered!';
    v_notif_body  := v_booker_name || ' offered to drive your route "' || v_post_title || '". Review and accept.';

  ELSIF v_post_type IN ('errand', 'package') THEN
    v_notif_type  := 'new_applicant';
    v_notif_title := CASE WHEN v_post_type = 'errand' THEN 'New Errand Helper!' ELSE 'New Delivery Offer!' END;
    v_notif_body  := v_booker_name || ' offered to handle your ' || v_post_type || ' "' || v_post_title || '". Review and accept.';

  ELSIF v_post_type = 'job' THEN
    v_notif_type  := 'new_applicant';
    v_notif_title := 'New Applicant!';
    v_notif_body  := v_booker_name || ' applied for "' || v_post_title || '". Review and accept.';
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
        'bookerId', NEW.user_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════
-- 4. Generic RPC: accept any applicant (all post types)
-- ════════════════════════════════════════════════
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
BEGIN
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
    -- Multi-seat: increment seats_filled
    v_new_seats := COALESCE(v_post.seats_filled, 0) + v_booking.seats_booked;
    UPDATE posts SET seats_filled = v_new_seats WHERE id = v_post.id;

    -- If all seats filled, reject remaining pending and fill post
    IF v_post.seats_total IS NOT NULL AND v_new_seats >= v_post.seats_total THEN
      UPDATE posts SET status = 'filled' WHERE id = v_post.id;

      -- Reject remaining pending bookings
      UPDATE bookings
         SET status = 'rejected'
       WHERE post_id = v_post.id
         AND id != p_booking_id
         AND status = 'pending';
    END IF;
  ELSE
    -- Single-match types: fill post and reject all other pending
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

GRANT EXECUTE ON FUNCTION accept_applicant(uuid) TO authenticated;

-- ════════════════════════════════════════════════
-- 5. Generic RPC: reject a specific applicant (all post types)
-- ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION reject_applicant(p_booking_id uuid)
RETURNS void AS $$
DECLARE
  v_booking RECORD;
  v_post    RECORD;
  v_reject_title text;
  v_reject_body  text;
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

  SELECT id, author_id, type, title
    INTO v_post
    FROM posts
   WHERE id = v_booking.post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF auth.uid() != v_post.author_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Set to rejected (not cancelled — distinct from user withdrawal)
  UPDATE bookings
     SET status = 'rejected'
   WHERE id = p_booking_id;

  -- Post stays open for more applicants

  -- Notify rejected applicant
  CASE v_post.type
    WHEN 'route_offer' THEN
      v_reject_title := 'Seat Request Declined';
      v_reject_body  := 'Your seat request for "' || v_post.title || '" was not accepted.';
    WHEN 'route_request' THEN
      v_reject_title := 'Drive Offer Declined';
      v_reject_body  := 'Your offer to drive "' || v_post.title || '" was not accepted.';
    WHEN 'errand' THEN
      v_reject_title := 'Errand Offer Declined';
      v_reject_body  := 'Your offer for the errand "' || v_post.title || '" was not accepted.';
    WHEN 'package' THEN
      v_reject_title := 'Delivery Offer Declined';
      v_reject_body  := 'Your offer to deliver "' || v_post.title || '" was not accepted.';
    WHEN 'job' THEN
      v_reject_title := 'Application Declined';
      v_reject_body  := 'Your application for "' || v_post.title || '" was not accepted.';
    ELSE
      v_reject_title := 'Not Selected';
      v_reject_body  := 'Your request for "' || v_post.title || '" was not accepted.';
  END CASE;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_booking.user_id,
    'applicant_rejected',
    v_reject_title,
    v_reject_body,
    jsonb_build_object(
      'postId', v_post.id,
      'bookingId', p_booking_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reject_applicant(uuid) TO authenticated;

-- ════════════════════════════════════════════════
-- 6. Update handle_booking_status_change for 'rejected' status
-- ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_booking_status_change()
RETURNS trigger AS $$
DECLARE
  v_post_type text;
  v_remaining_active bigint;
  v_author_id uuid;
  v_actor_id uuid;
  v_recipient_id uuid;
  v_actor_name text;
  v_post_title text;
  v_contract_id uuid;
  v_notif_title text;
  v_notif_body text;
BEGIN
  SELECT type, author_id, title
    INTO v_post_type, v_author_id, v_post_title
    FROM posts
   WHERE id = NEW.post_id;

  -- ═══════════════════════════════
  -- REJECTED (owner declined — no contract exists, no seat change)
  -- ═══════════════════════════════
  IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    -- Nothing to clean up: no contract was created, no seats were incremented.
    -- Notifications are handled by the reject_applicant / accept_applicant RPCs.
    RETURN NEW;
  END IF;

  -- ═══════════════════════════════
  -- CANCELLATION (user withdrew or confirmed booking cancelled)
  -- ═══════════════════════════════
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    v_actor_id := auth.uid();

    IF v_actor_id IS NULL THEN
      v_actor_id := NEW.user_id;
    END IF;

    IF v_actor_id != NEW.user_id AND v_actor_id != v_author_id THEN
      v_actor_id := NEW.user_id;
    END IF;

    v_recipient_id := CASE
      WHEN v_actor_id = NEW.user_id THEN v_author_id
      ELSE NEW.user_id
    END;

    -- Only delete contract if one exists (confirmed bookings have contracts)
    IF OLD.status = 'confirmed' THEN
      DELETE FROM contracts WHERE booking_id = NEW.id;

      IF v_post_type = 'route_offer' THEN
        -- Decrement seats
        UPDATE posts
           SET seats_filled = GREATEST(0, COALESCE(seats_filled, 0) - OLD.seats_booked),
               status = CASE WHEN status = 'filled' THEN 'open' ELSE status END
         WHERE id = NEW.post_id;
      ELSE
        -- Re-open if no remaining active bookings
        SELECT count(*) INTO v_remaining_active
          FROM bookings
         WHERE post_id = NEW.post_id
           AND id != NEW.id
           AND status NOT IN ('cancelled', 'no_show', 'completed', 'rejected');

        IF v_remaining_active = 0 THEN
          UPDATE posts SET status = 'open'
           WHERE id = NEW.post_id AND status IN ('filled', 'in_progress');
        END IF;
      END IF;
    END IF;

    -- Pending booking cancelled (user withdrew before acceptance) — no cleanup needed
    -- Post stays open since nothing was confirmed

    IF v_recipient_id IS NOT NULL AND v_recipient_id != v_actor_id THEN
      SELECT COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), 'Someone')
        INTO v_actor_name
        FROM profiles
       WHERE id = v_actor_id;

      v_notif_title := CASE
        WHEN v_post_type IN ('route_offer', 'route_request') THEN 'Ride Cancelled'
        WHEN v_post_type = 'package' THEN 'Delivery Cancelled'
        WHEN v_post_type = 'errand' THEN 'Errand Cancelled'
        WHEN v_post_type = 'job' THEN 'Job Cancelled'
        ELSE 'Activity Cancelled'
      END;

      v_notif_body := v_actor_name || ' cancelled ' || COALESCE('"' || v_post_title || '"', 'this activity') || '.';

      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_recipient_id,
        'booking_cancelled',
        v_notif_title,
        v_notif_body,
        jsonb_build_object(
          'postId', NEW.post_id,
          'bookingId', NEW.id,
          'actorId', v_actor_id,
          'event', 'cancelled'
        )
      );
    END IF;
  END IF;

  -- ═══════════════════════════════
  -- COMPLETION
  -- ═══════════════════════════════
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    v_actor_id := auth.uid();

    IF v_actor_id IS NULL THEN
      v_actor_id := v_author_id;
    END IF;

    IF v_actor_id != NEW.user_id AND v_actor_id != v_author_id THEN
      v_actor_id := v_author_id;
    END IF;

    v_recipient_id := CASE
      WHEN v_actor_id = NEW.user_id THEN v_author_id
      ELSE NEW.user_id
    END;

    UPDATE contracts
       SET status = 'completed', completed_at = now()
     WHERE booking_id = NEW.id AND status != 'completed';

    SELECT id INTO v_contract_id
      FROM contracts
     WHERE booking_id = NEW.id
     LIMIT 1;

    SELECT count(*) INTO v_remaining_active
      FROM bookings
     WHERE post_id = NEW.post_id
       AND id != NEW.id
       AND status IN ('pending', 'confirmed');

    IF v_remaining_active = 0 THEN
      UPDATE posts SET status = 'completed'
       WHERE id = NEW.post_id AND status NOT IN ('completed', 'cancelled');
    END IF;

    IF v_recipient_id IS NOT NULL AND v_recipient_id != v_actor_id AND v_contract_id IS NOT NULL THEN
      SELECT COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), 'Someone')
        INTO v_actor_name
        FROM profiles
       WHERE id = v_actor_id;

      v_notif_body := CASE
        WHEN v_post_title IS NOT NULL AND v_post_title <> '' THEN
          v_actor_name || ' marked "' || v_post_title || '" as completed. Tap to rate them.'
        ELSE
          v_actor_name || ' marked your activity as completed. Tap to rate them.'
      END;

      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_recipient_id,
        'contract_completed',
        'Activity Completed',
        v_notif_body,
        jsonb_build_object(
          'contractId', v_contract_id,
          'ratedId', v_actor_id,
          'postId', NEW.post_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ════════════════════════════════════════════════
-- 7. Handle post expiry: auto-reject pending bookings
-- ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_post_status_change()
RETURNS trigger AS $$
DECLARE
  v_booking RECORD;
BEGIN
  -- When post becomes expired or cancelled, reject all pending bookings
  IF NEW.status IN ('expired', 'cancelled') AND OLD.status NOT IN ('expired', 'cancelled') THEN
    FOR v_booking IN
      SELECT id, user_id
        FROM bookings
       WHERE post_id = NEW.id
         AND status = 'pending'
    LOOP
      UPDATE bookings
         SET status = 'rejected'
       WHERE id = v_booking.id;

      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_booking.user_id,
        'applicant_rejected',
        'Post No Longer Available',
        'The post "' || NEW.title || '" is no longer available. Your request has been closed.',
        jsonb_build_object('postId', NEW.id, 'bookingId', v_booking.id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_status_change ON posts;
CREATE TRIGGER trg_post_status_change
  AFTER UPDATE OF status ON posts
  FOR EACH ROW
  EXECUTE FUNCTION handle_post_status_change();

-- ════════════════════════════════════════════════
-- 8. Keep old RPCs as thin wrappers for backward compat
-- ════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION accept_job_application(p_booking_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM accept_applicant(p_booking_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_job_application(p_booking_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM reject_applicant(p_booking_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

