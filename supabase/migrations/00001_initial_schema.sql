


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."account_status" AS ENUM (
    'pending',
    'active',
    'restricted',
    'suspended',
    'dormant'
);




CREATE TYPE "public"."admin_action_type" AS ENUM (
    'approve_driver',
    'reject_driver',
    'approve_rider_doc',
    'reject_rider_doc',
    'suspend_user',
    'unsuspend_user',
    'remove_post',
    'dismiss_flag',
    'issue_strike'
);




CREATE TYPE "public"."belize_district" AS ENUM (
    'belize',
    'cayo',
    'corozal',
    'orange_walk',
    'stann_creek',
    'toledo'
);




CREATE TYPE "public"."booking_role" AS ENUM (
    'rider',
    'driver'
);




CREATE TYPE "public"."booking_status" AS ENUM (
    'pending',
    'confirmed',
    'cancelled',
    'no_show',
    'completed',
    'rejected'
);




CREATE TYPE "public"."contract_status" AS ENUM (
    'active',
    'completed',
    'disputed',
    'cancelled'
);




CREATE TYPE "public"."driver_document_type" AS ENUM (
    'drivers_license',
    'vehicle_insurance',
    'vehicle_registration',
    'police_record'
);




COMMENT ON TYPE "public"."driver_document_type" IS 'police_record value is deprecated and no longer used';



CREATE TYPE "public"."ekyash_status" AS ENUM (
    'pending',
    'approved',
    'cancelled',
    'refunded'
);




CREATE TYPE "public"."errand_category" AS ENUM (
    'grocery',
    'bill',
    'pharmacy',
    'document',
    'delivery',
    'food',
    'hardware',
    'other'
);




CREATE TYPE "public"."flag_reason" AS ENUM (
    'spam',
    'scam',
    'harassment',
    'fake_account',
    'safety',
    'other'
);




CREATE TYPE "public"."flag_status" AS ENUM (
    'pending',
    'reviewed',
    'action_taken',
    'dismissed'
);




CREATE TYPE "public"."flag_target" AS ENUM (
    'post',
    'user',
    'booking'
);




CREATE TYPE "public"."job_category" AS ENUM (
    'skilled_trade',
    'cleaning',
    'delivery',
    'handyman',
    'landscaping',
    'moving',
    'tutoring',
    'tech',
    'other'
);




CREATE TYPE "public"."job_timeline" AS ENUM (
    'asap',
    'today',
    'this_week',
    'flexible'
);




CREATE TYPE "public"."pay_type" AS ENUM (
    'hourly',
    'fixed'
);




CREATE TYPE "public"."payment_method" AS ENUM (
    'cash',
    'ekyash'
);




CREATE TYPE "public"."pickup_style" AS ENUM (
    'single',
    'multi_stop'
);




CREATE TYPE "public"."post_status" AS ENUM (
    'open',
    'activated',
    'in_progress',
    'completed',
    'cancelled',
    'expired',
    'filled'
);




CREATE TYPE "public"."post_type" AS ENUM (
    'route_offer',
    'route_request',
    'errand',
    'package',
    'job'
);




CREATE TYPE "public"."review_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);




CREATE TYPE "public"."road_report_type" AS ENUM (
    'accident',
    'checkpoint',
    'traffic',
    'flooding',
    'construction',
    'road_damage'
);




CREATE TYPE "public"."role" AS ENUM (
    'rider',
    'driver',
    'admin'
);




CREATE TYPE "public"."strike_reason" AS ENUM (
    'late_cancel',
    'no_show',
    'early_leave',
    'driver_no_show',
    'report'
);




CREATE TYPE "public"."strike_type" AS ENUM (
    'soft',
    'hard'
);




CREATE OR REPLACE FUNCTION "public"."accept_applicant"("p_booking_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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

  IF auth.uid() != v_post.author_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_post.type = 'route_offer' AND v_post.seats_total IS NOT NULL THEN
    v_new_seats := COALESCE(v_post.seats_filled, 0) + v_booking.seats_booked;
    IF v_new_seats > v_post.seats_total THEN
      RAISE EXCEPTION 'Not enough seats available to accept this booking';
    END IF;
  END IF;

  UPDATE bookings SET status = 'confirmed' WHERE id = p_booking_id;

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

  SELECT COALESCE(first_name || ' ' || last_name, first_name, 'Someone')
    INTO v_applicant_name
    FROM profiles
   WHERE id = v_booking.user_id;

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
$$;




CREATE OR REPLACE FUNCTION "public"."accept_job_application"("p_booking_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM accept_applicant(p_booking_id);
END;
$$;




CREATE OR REPLACE FUNCTION "public"."accumulate_donation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.donation_cents > 0 THEN
    UPDATE donation_totals
    SET total_cents = total_cents + NEW.donation_cents, updated_at = now()
    WHERE id = 1;
  END IF;
  RETURN NEW;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."check_driver_documents_complete"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*) = 3
  FROM driver_documents
  WHERE profile_id = p_profile_id
    AND review_status = 'approved'
    AND document_type IN ('drivers_license', 'vehicle_insurance', 'vehicle_registration');
$$;




CREATE OR REPLACE FUNCTION "public"."compute_rating_avg"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_avg numeric;
  v_count int;
  v_punctuality int;
BEGIN
  SELECT
    ROUND(AVG(stars)::numeric, 2),
    COUNT(*)
  INTO v_avg, v_count
  FROM ratings
  WHERE rated_id = p_user_id;

  IF v_count = 0 THEN
    RETURN jsonb_build_object(
      'rating_avg', NULL,
      'punctuality_pct', NULL,
      'total_ratings', 0
    );
  END IF;

  SELECT
    CASE
      WHEN COUNT(*) FILTER (WHERE was_on_time IS NOT NULL) = 0 THEN NULL
      ELSE ROUND(
        (COUNT(*) FILTER (WHERE was_on_time = true))::numeric
        / (COUNT(*) FILTER (WHERE was_on_time IS NOT NULL))
        * 100
      )::int
    END
  INTO v_punctuality
  FROM ratings
  WHERE rated_id = p_user_id;

  -- Update profile inline
  UPDATE profiles
  SET
    rating_avg    = v_avg,
    punctuality_pct = v_punctuality,
    updated_at    = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'rating_avg', v_avg,
    'punctuality_pct', v_punctuality,
    'total_ratings', v_count
  );
END;
$$;




CREATE OR REPLACE FUNCTION "public"."enforce_phone_change_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only fire when phone_changed_at is actually being set to a new non-null value
  IF NEW.phone_changed_at IS NOT NULL
     AND OLD.phone_changed_at IS NOT NULL
     AND NEW.phone_changed_at IS DISTINCT FROM OLD.phone_changed_at
  THEN
    IF OLD.phone_changed_at > (NOW() - INTERVAL '30 days') THEN
      RAISE EXCEPTION
        'Phone number can only be changed once every 30 days. Next allowed change: %',
        (OLD.phone_changed_at + INTERVAL '30 days')::date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."handle_booking_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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

  -- REJECTED (owner declined — no contract, no seat change)
  IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    RETURN NEW;
  END IF;

  -- CANCELLATION
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

    IF OLD.status = 'confirmed' THEN
      DELETE FROM contracts WHERE booking_id = NEW.id;

      IF v_post_type = 'route_offer' THEN
        UPDATE posts
           SET seats_filled = GREATEST(0, COALESCE(seats_filled, 0) - OLD.seats_booked),
               status = CASE WHEN status = 'filled' THEN 'open' ELSE status END
         WHERE id = NEW.post_id;
      ELSE
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

  -- COMPLETION
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
$$;




CREATE OR REPLACE FUNCTION "public"."handle_new_booking_after"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;




CREATE OR REPLACE FUNCTION "public"."handle_new_booking_before"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;




CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, email)
  VALUES (NEW.id, NEW.phone, NEW.email);
  RETURN NEW;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."handle_post_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_booking RECORD;
BEGIN
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
$$;




CREATE OR REPLACE FUNCTION "public"."increment_strike_counter"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.type = 'soft' THEN
    UPDATE profiles SET strikes_soft = strikes_soft + 1 WHERE id = NEW.user_id;
  ELSE
    UPDATE profiles SET strikes_hard = strikes_hard + 1 WHERE id = NEW.user_id;
  END IF;

  -- Auto-restrict on 3 soft strikes
  IF (SELECT strikes_soft FROM profiles WHERE id = NEW.user_id) >= 3 THEN
    UPDATE profiles SET account_status = 'restricted' WHERE id = NEW.user_id;
  END IF;

  -- Auto-suspend on 2 hard strikes
  IF (SELECT strikes_hard FROM profiles WHERE id = NEW.user_id) >= 2 THEN
    UPDATE profiles SET account_status = 'suspended' WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."is_active_account"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND account_status = 'active'
  );
$$;




CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;




CREATE OR REPLACE FUNCTION "public"."notify_contract_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_contract   RECORD;
  v_party_id   uuid;
  v_actor_name text;
BEGIN
  SELECT c.parties, p.title AS post_title, p.type AS post_type
    INTO v_contract
    FROM contracts c
    LEFT JOIN posts p ON p.id = c.post_id
    WHERE c.id = NEW.contract_id;

  SELECT COALESCE(first_name || ' ' || last_name, 'Someone')
    INTO v_actor_name
    FROM profiles WHERE id = NEW.actor_id;

  FOREACH v_party_id IN ARRAY v_contract.parties
  LOOP
    IF v_party_id != NEW.actor_id THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_party_id,
        'contract_event',
        v_actor_name || ' updated the trip',
        REPLACE(REPLACE(NEW.event_type, '_', ' '), 'en route', 'en route'),
        jsonb_build_object(
          'contract_id', NEW.contract_id,
          'event_type', NEW.event_type,
          'actor_id', NEW.actor_id,
          'post_title', v_contract.post_title,
          'post_type', v_contract.post_type
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."notify_on_new_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  _recipient_id uuid;
  _sender_name  text;
BEGIN
  SELECT party
    INTO _recipient_id
    FROM contracts c, unnest(c.parties) AS party
   WHERE c.id = NEW.contract_id
     AND party <> NEW.sender_id
   LIMIT 1;

  IF _recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.first_name, 'Someone')
    INTO _sender_name
    FROM profiles p
   WHERE p.id = NEW.sender_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    _recipient_id,
    'new_message',
    _sender_name || ' sent you a message',
    LEFT(NEW.body, 100),
    jsonb_build_object('contract_id', NEW.contract_id, 'message_id', NEW.id)
  );

  RETURN NEW;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."notify_on_post_deleted"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor_id uuid;
  v_actor_name text;
  v_booking record;
  v_notif_title text;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    v_actor_id := OLD.author_id;
  END IF;

  IF v_actor_id != OLD.author_id THEN
    v_actor_id := OLD.author_id;
  END IF;

  SELECT COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), 'Someone')
    INTO v_actor_name
    FROM profiles
   WHERE id = v_actor_id;

  v_notif_title := CASE
    WHEN OLD.type IN ('route_offer', 'route_request') THEN 'Ride Cancelled'
    WHEN OLD.type = 'package' THEN 'Delivery Cancelled'
    WHEN OLD.type = 'errand' THEN 'Errand Cancelled'
    WHEN OLD.type = 'job' THEN 'Job Cancelled'
    ELSE 'Activity Cancelled'
  END;

  FOR v_booking IN
    SELECT id, user_id
      FROM bookings
     WHERE post_id = OLD.id
       AND status IN ('pending', 'confirmed')
       AND user_id <> v_actor_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_booking.user_id,
      'post_cancelled',
      v_notif_title,
      v_actor_name || ' removed ' || COALESCE('"' || OLD.title || '"', 'an activity you were involved in') || '.',
      jsonb_build_object(
        'postId', OLD.id,
        'bookingId', v_booking.id,
        'actorId', v_actor_id,
        'event', 'post_cancelled'
      )
    );
  END LOOP;

  RETURN OLD;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."process_ekyash_payment"("p_order_id" "text", "p_transaction_id" "text", "p_callback_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_txn record;
  v_payer_email text;
  v_result jsonb;
BEGIN
  -- 1. Update transaction record (idempotency: skip if already processed)
  UPDATE ekyash_transactions
  SET transaction_id  = p_transaction_id,
      status          = 'approved',
      callback_received = true,
      callback_payload  = p_callback_payload,
      updated_at        = now()
  WHERE order_id = p_order_id
    AND callback_received = false
  RETURNING * INTO v_txn;

  -- Nothing to update — already processed or not found
  IF v_txn IS NULL THEN
    RETURN jsonb_build_object('status', 'already_processed');
  END IF;

  -- 2. Confirm related booking
  UPDATE bookings
  SET status     = 'confirmed',
      updated_at = now()
  WHERE ekyash_invoice_id = v_txn.invoice_id;

  -- 3. Activate contract
  UPDATE contracts
  SET status = 'active'
  WHERE id = v_txn.contract_id;

  -- 4. Create notifications for both parties
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES
    (
      v_txn.payer_id,
      'payment_sent',
      'Payment Sent',
      'Your E-Kyash payment of $' || to_char(v_txn.amount_cents / 100.0, 'FM999990.00') || ' BZD was approved.',
      jsonb_build_object('contractId', v_txn.contract_id, 'orderId', p_order_id)
    ),
    (
      v_txn.payee_id,
      'payment_received',
      'Payment Received',
      'You received an E-Kyash payment of $' || to_char(v_txn.amount_cents / 100.0, 'FM999990.00') || ' BZD.',
      jsonb_build_object('contractId', v_txn.contract_id, 'orderId', p_order_id)
    );

  -- 5. Look up payer email for potential receipt
  SELECT email INTO v_payer_email
  FROM profiles
  WHERE id = v_txn.payer_id;

  v_result := jsonb_build_object(
    'status',      'ok',
    'txn_id',      v_txn.id,
    'payer_id',    v_txn.payer_id,
    'payer_email', v_payer_email,
    'contract_id', v_txn.contract_id
  );

  RETURN v_result;
END;
$_$;




CREATE OR REPLACE FUNCTION "public"."recalculate_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE profiles SET
    rating_avg = (
      SELECT ROUND(AVG(stars)::numeric, 1)
      FROM ratings WHERE rated_id = NEW.rated_id
    ),
    punctuality_pct = (
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE was_on_time = true) / NULLIF(COUNT(*) FILTER (WHERE was_on_time IS NOT NULL), 0)
      )::integer
      FROM ratings WHERE rated_id = NEW.rated_id
    )
  WHERE id = NEW.rated_id;
  RETURN NEW;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."reject_applicant"("p_booking_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_booking RECORD;
  v_post    RECORD;
  v_reject_title text;
  v_reject_body  text;
  v_caller_status text;
BEGIN
  -- Gate: only active accounts can reject applicants
  SELECT account_status INTO v_caller_status
    FROM profiles WHERE id = auth.uid();
  IF v_caller_status IS NULL OR v_caller_status != 'active' THEN
    RAISE EXCEPTION 'Your account must be approved before you can manage applicants';
  END IF;

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

  UPDATE bookings
     SET status = 'rejected'
   WHERE id = p_booking_id;

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
$$;




CREATE OR REPLACE FUNCTION "public"."reject_job_application"("p_booking_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM reject_applicant(p_booking_id);
END;
$$;




CREATE OR REPLACE FUNCTION "public"."report_road_report_gone"("report_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Dedup: one vote per user per report
  INSERT INTO road_report_gone_votes (user_id, report_id)
  VALUES (auth.uid(), report_road_report_gone.report_id)
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Already reported as gone';
  END IF;

  SELECT gone_count INTO current_count
  FROM road_reports
  WHERE id = report_road_report_gone.report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Road report not found';
  END IF;

  IF (current_count + 1) >= 3 THEN
    DELETE FROM road_reports WHERE id = report_road_report_gone.report_id;
  ELSE
    UPDATE road_reports
    SET gone_count = gone_count + 1
    WHERE id = report_road_report_gone.report_id;
  END IF;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."switch_to_driver_role"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_gov_id_ok boolean;
  v_driver_docs_ok boolean;
BEGIN
  -- Check government ID is approved
  SELECT EXISTS(
    SELECT 1 FROM rider_documents
    WHERE user_id = p_user_id AND review_status = 'approved'
  ) INTO v_gov_id_ok;

  IF NOT v_gov_id_ok THEN
    RAISE EXCEPTION 'Government ID not approved';
  END IF;

  -- Check all required driver doc types are approved
  -- Required types: drivers_license, vehicle_registration, vehicle_insurance
  SELECT (
    SELECT COUNT(DISTINCT document_type)
    FROM driver_documents
    WHERE user_id = p_user_id
      AND review_status = 'approved'
      AND document_type IN ('drivers_license', 'vehicle_registration', 'vehicle_insurance')
  ) = 3 INTO v_driver_docs_ok;

  IF NOT v_driver_docs_ok THEN
    RAISE EXCEPTION 'Not all required driver documents are approved';
  END IF;

  UPDATE profiles SET role = 'driver', updated_at = now() WHERE id = p_user_id;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;



SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."road_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "type" "public"."road_report_type" NOT NULL,
    "lat" numeric(10,7) NOT NULL,
    "lng" numeric(10,7) NOT NULL,
    "description" "text",
    "upvotes" integer DEFAULT 1,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '02:00:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gone_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "road_report_in_belize" CHECK (((("lat" >= 15.889) AND ("lat" <= 18.497)) AND (("lng" >= '-89.225'::numeric) AND ("lng" <= '-87.485'::numeric)))),
    CONSTRAINT "road_reports_description_check" CHECK (("char_length"("description") <= 500))
);




CREATE OR REPLACE FUNCTION "public"."upvote_road_report"("report_id" "uuid") RETURNS "public"."road_reports"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  caller_id   UUID := auth.uid();
  updated_report road_reports;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert vote; conflict means already voted → no-op
  INSERT INTO road_report_votes (user_id, report_id)
  VALUES (caller_id, report_id)
  ON CONFLICT (user_id, report_id) DO NOTHING;

  -- Only increment counter when the insert actually happened
  IF FOUND THEN
    UPDATE road_reports
    SET upvotes = upvotes + 1
    WHERE id = report_id
    RETURNING * INTO updated_report;
  ELSE
    SELECT * INTO updated_report FROM road_reports WHERE id = report_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Road report not found';
  END IF;

  RETURN updated_report;
END;
$$;




CREATE TABLE IF NOT EXISTS "public"."gas_prices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "station_name" "text" NOT NULL,
    "station_lat" numeric(10,7) NOT NULL,
    "station_lng" numeric(10,7) NOT NULL,
    "regular_cents" integer,
    "premium_cents" integer,
    "diesel_cents" integer,
    "verified_count" integer DEFAULT 1,
    "reported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gas_price_in_belize" CHECK (((("station_lat" >= 15.889) AND ("station_lat" <= 18.497)) AND (("station_lng" >= '-89.225'::numeric) AND ("station_lng" <= '-87.485'::numeric))))
);




CREATE OR REPLACE FUNCTION "public"."verify_gas_price"("price_id" "uuid") RETURNS "public"."gas_prices"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  caller_id    UUID := auth.uid();
  updated_price gas_prices;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert verification; conflict means already verified → no-op
  INSERT INTO gas_price_verifications (user_id, price_id)
  VALUES (caller_id, price_id)
  ON CONFLICT (user_id, price_id) DO NOTHING;

  IF FOUND THEN
    UPDATE gas_prices
    SET verified_count = verified_count + 1
    WHERE id = price_id
    RETURNING * INTO updated_price;
  ELSE
    SELECT * INTO updated_price FROM gas_prices WHERE id = price_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gas price not found';
  END IF;

  RETURN updated_price;
END;
$$;




CREATE TABLE IF NOT EXISTS "public"."admin_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "action" "public"."admin_action_type" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reason" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."booking_role" NOT NULL,
    "status" "public"."booking_status" DEFAULT 'pending'::"public"."booking_status" NOT NULL,
    "seats_booked" integer DEFAULT 1,
    "payment_method" "public"."payment_method",
    "ekyash_invoice_id" "text",
    "cancelled_at" timestamp with time zone,
    "cancel_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bookings_seats_booked_check" CHECK ((("seats_booked" >= 1) AND ("seats_booked" <= 20)))
);




CREATE TABLE IF NOT EXISTS "public"."contract_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contract_events_type_check" CHECK (("event_type" = ANY (ARRAY['en_route'::"text", 'arrived_pickup'::"text", 'departed'::"text", 'arrived_destination'::"text", 'driver_confirmed'::"text", 'accepted_errand'::"text", 'arrived_location'::"text", 'picked_up'::"text", 'returning'::"text", 'delivered'::"text", 'checked_in'::"text", 'started_work'::"text", 'completed_work'::"text", 'started_ride'::"text", 'picked_up_rider'::"text", 'completed_ride'::"text", 'cancelled'::"text", 'delayed'::"text", 'rerouted'::"text", 'emergency'::"text", 'custom'::"text"])))
);




CREATE TABLE IF NOT EXISTS "public"."contract_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contract_messages_body_check" CHECK ((("char_length"("body") > 0) AND ("char_length"("body") <= 2000)))
);




CREATE TABLE IF NOT EXISTS "public"."contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "parties" "uuid"[] NOT NULL,
    "origin_address" "text",
    "origin_coords" "point",
    "dest_address" "text",
    "dest_coords" "point",
    "agreed_price_cents" integer NOT NULL,
    "departure_at" timestamp with time zone,
    "terms" "jsonb",
    "status" "public"."contract_status" DEFAULT 'active'::"public"."contract_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "contracts_agreed_price_cents_check" CHECK (("agreed_price_cents" >= 0))
);




CREATE TABLE IF NOT EXISTS "public"."donation_totals" (
    "id" integer DEFAULT 1 NOT NULL,
    "total_cents" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "donation_totals_id_check" CHECK (("id" = 1))
);




CREATE TABLE IF NOT EXISTS "public"."driver_checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "selfie_url" "text" NOT NULL,
    "lat" numeric(10,7),
    "lng" numeric(10,7),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."driver_details" (
    "id" "uuid" NOT NULL,
    "license_url" "text",
    "insurance_url" "text",
    "id_document_url" "text",
    "vehicle_make" "text",
    "vehicle_model" "text",
    "vehicle_year" integer,
    "vehicle_color" "text",
    "vehicle_plate" "text",
    "verified" boolean DEFAULT false,
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "rejection_reason" "text",
    "review_status" "public"."review_status" DEFAULT 'pending'::"public"."review_status" NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."driver_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "document_type" "public"."driver_document_type" NOT NULL,
    "document_url" "text" NOT NULL,
    "document_number" "text",
    "expiration_date" "date",
    "review_status" "public"."review_status" DEFAULT 'pending'::"public"."review_status" NOT NULL,
    "rejection_reason" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."ekyash_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "payer_id" "uuid" NOT NULL,
    "payee_id" "uuid" NOT NULL,
    "order_id" "text" NOT NULL,
    "invoice_id" "text",
    "transaction_id" "text",
    "amount_cents" integer NOT NULL,
    "platform_fee_cents" integer DEFAULT 0 NOT NULL,
    "donation_cents" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'BZD'::"text" NOT NULL,
    "status" "public"."ekyash_status" DEFAULT 'pending'::"public"."ekyash_status" NOT NULL,
    "callback_received" boolean DEFAULT false,
    "callback_payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ekyash_transactions_amount_cents_check" CHECK (("amount_cents" > 0))
);




CREATE TABLE IF NOT EXISTS "public"."email_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "contract_id" "uuid",
    "email_to" "text" NOT NULL,
    "resend_id" "text",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ekyash_txn_id" "uuid",
    "type" "text" DEFAULT 'payment'::"text" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "error" "text",
    CONSTRAINT "email_receipts_has_reference" CHECK ((("contract_id" IS NOT NULL) OR ("ekyash_txn_id" IS NOT NULL)))
);




CREATE TABLE IF NOT EXISTS "public"."flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "target_type" "public"."flag_target" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reason" "public"."flag_reason" NOT NULL,
    "description" "text",
    "status" "public"."flag_status" DEFAULT 'pending'::"public"."flag_status" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "flags_description_check" CHECK (("char_length"("description") <= 500))
);




CREATE TABLE IF NOT EXISTS "public"."gas_price_verifications" (
    "user_id" "uuid" NOT NULL,
    "price_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "data" "jsonb",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "type" "public"."post_type" NOT NULL,
    "status" "public"."post_status" DEFAULT 'open'::"public"."post_status" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "origin_address" "text",
    "origin_lat" numeric(10,7),
    "origin_lng" numeric(10,7),
    "dest_address" "text",
    "dest_lat" numeric(10,7),
    "dest_lng" numeric(10,7),
    "departure_at" timestamp with time zone,
    "price_cents" integer,
    "seats_total" integer,
    "seats_filled" integer DEFAULT 0,
    "min_riders" integer,
    "pickup_style" "public"."pickup_style",
    "errand_category" "public"."errand_category",
    "errand_fee_cents" integer,
    "item_cost_cents" integer,
    "route_geometry" "jsonb",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "job_category" "public"."job_category",
    "pay_rate_cents" integer,
    "pay_type" "public"."pay_type",
    "job_timeline" "public"."job_timeline",
    "route_distance_km" numeric(10,2),
    "route_duration_min" numeric(10,1),
    "route_fuel_cost_cents" integer,
    "vehicle_description" "text",
    "pickup_notes" "text",
    "is_round_trip" boolean DEFAULT false NOT NULL,
    "payment_method" "public"."payment_method" DEFAULT 'cash'::"public"."payment_method" NOT NULL,
    CONSTRAINT "posts_description_check" CHECK (("char_length"("description") <= 500)),
    CONSTRAINT "posts_dest_in_belize" CHECK ((("dest_lat" IS NULL) OR ((("dest_lat" >= 15.889) AND ("dest_lat" <= 18.497)) AND (("dest_lng" >= '-89.225'::numeric) AND ("dest_lng" <= '-87.485'::numeric))))),
    CONSTRAINT "posts_errand_fee_cents_check" CHECK ((("errand_fee_cents" >= 0) AND ("errand_fee_cents" <= 999900))),
    CONSTRAINT "posts_item_cost_cents_check" CHECK (("item_cost_cents" >= 0)),
    CONSTRAINT "posts_origin_in_belize" CHECK ((("origin_lat" IS NULL) OR ((("origin_lat" >= 15.889) AND ("origin_lat" <= 18.497)) AND (("origin_lng" >= '-89.225'::numeric) AND ("origin_lng" <= '-87.485'::numeric))))),
    CONSTRAINT "posts_pay_rate_cents_check" CHECK ((("pay_rate_cents" >= 0) AND ("pay_rate_cents" <= 999900))),
    CONSTRAINT "posts_price_cents_check" CHECK ((("price_cents" >= 0) AND ("price_cents" <= 999900))),
    CONSTRAINT "posts_route_fuel_cost_cents_check" CHECK (("route_fuel_cost_cents" >= 0)),
    CONSTRAINT "posts_seats_total_check" CHECK ((("seats_total" >= 1) AND ("seats_total" <= 20)))
);




COMMENT ON COLUMN "public"."posts"."vehicle_description" IS 'Driver car description (make, model, color) for route offers';



COMMENT ON COLUMN "public"."posts"."pickup_notes" IS 'Specific pickup location instructions';



COMMENT ON COLUMN "public"."posts"."is_round_trip" IS 'Whether the route offer includes a return trip';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "phone" "text",
    "first_name" "text",
    "last_name" "text",
    "role" "public"."role" DEFAULT 'rider'::"public"."role" NOT NULL,
    "avatar_url" "text",
    "email" "text",
    "rating_avg" numeric(2,1) DEFAULT 0,
    "punctuality_pct" integer DEFAULT 100,
    "strikes_soft" integer DEFAULT 0,
    "strikes_hard" integer DEFAULT 0,
    "account_status" "public"."account_status" DEFAULT 'pending'::"public"."account_status" NOT NULL,
    "emergency_contact" "text",
    "last_active_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "push_token" "text",
    "district" "public"."belize_district",
    "address_line" "text",
    "phone_changed_at" timestamp with time zone
);




CREATE OR REPLACE VIEW "public"."profiles_public" AS
 SELECT "id",
    "first_name",
    "last_name",
    "avatar_url",
    "role",
    "account_status",
    "rating_avg",
    "punctuality_pct",
    "district",
    "address_line",
    "last_active_at",
    "created_at"
   FROM "public"."profiles";




COMMENT ON VIEW "public"."profiles_public" IS 'Safe public projection of profiles — omits phone, email, push_token, emergency_contact, strikes, phone_changed_at.';



CREATE TABLE IF NOT EXISTS "public"."ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "rater_id" "uuid" NOT NULL,
    "rated_id" "uuid" NOT NULL,
    "stars" integer NOT NULL,
    "was_on_time" boolean,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "ratings_comment_check" CHECK (("char_length"("comment") <= 500)),
    CONSTRAINT "ratings_stars_check" CHECK ((("stars" >= 1) AND ("stars" <= 5)))
);




CREATE OR REPLACE VIEW "public"."ratings_public" AS
 SELECT "r"."id",
    "r"."contract_id",
    "r"."rated_id",
    "r"."stars",
    "r"."was_on_time",
    "r"."comment",
    "r"."is_anonymous",
    "r"."created_at",
        CASE
            WHEN "r"."is_anonymous" THEN NULL::"uuid"
            ELSE "r"."rater_id"
        END AS "rater_id",
        CASE
            WHEN "r"."is_anonymous" THEN NULL::"text"
            ELSE "p"."first_name"
        END AS "rater_first_name",
        CASE
            WHEN "r"."is_anonymous" THEN NULL::"text"
            ELSE "p"."last_name"
        END AS "rater_last_name",
        CASE
            WHEN "r"."is_anonymous" THEN NULL::"text"
            ELSE "p"."avatar_url"
        END AS "rater_avatar_url",
        CASE
            WHEN "r"."is_anonymous" THEN NULL::"public"."role"
            ELSE "p"."role"
        END AS "rater_role"
   FROM ("public"."ratings" "r"
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "r"."rater_id")));




CREATE TABLE IF NOT EXISTS "public"."rider_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_url" "text" NOT NULL,
    "verified" boolean DEFAULT false,
    "review_status" "public"."review_status" DEFAULT 'pending'::"public"."review_status" NOT NULL,
    "reviewed_by" "uuid",
    "rejection_reason" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."road_report_gone_votes" (
    "user_id" "uuid" NOT NULL,
    "report_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);




CREATE TABLE IF NOT EXISTS "public"."road_report_votes" (
    "user_id" "uuid" NOT NULL,
    "report_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."strikes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "contract_id" "uuid",
    "type" "public"."strike_type" NOT NULL,
    "reason" "public"."strike_reason" NOT NULL,
    "auto_generated" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "notified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."contract_events"
    ADD CONSTRAINT "contract_events_note_length" CHECK ((("note" IS NULL) OR ("char_length"("note") <= 500))) NOT VALID;



ALTER TABLE ONLY "public"."contract_events"
    ADD CONSTRAINT "contract_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contract_messages"
    ADD CONSTRAINT "contract_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."donation_totals"
    ADD CONSTRAINT "donation_totals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_checkins"
    ADD CONSTRAINT "driver_checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_details"
    ADD CONSTRAINT "driver_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_documents"
    ADD CONSTRAINT "driver_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_documents"
    ADD CONSTRAINT "driver_documents_profile_id_document_type_key" UNIQUE ("profile_id", "document_type");



ALTER TABLE "public"."ekyash_transactions"
    ADD CONSTRAINT "ekyash_fee_nonneg" CHECK (("platform_fee_cents" >= 0)) NOT VALID;



ALTER TABLE ONLY "public"."ekyash_transactions"
    ADD CONSTRAINT "ekyash_transactions_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."ekyash_transactions"
    ADD CONSTRAINT "ekyash_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_receipts"
    ADD CONSTRAINT "email_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flags"
    ADD CONSTRAINT "flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gas_price_verifications"
    ADD CONSTRAINT "gas_price_verifications_pkey" PRIMARY KEY ("user_id", "price_id");



ALTER TABLE "public"."gas_prices"
    ADD CONSTRAINT "gas_prices_bbox" CHECK (((("station_lat" >= 15.889) AND ("station_lat" <= 18.497)) AND (("station_lng" >= '-89.225'::numeric) AND ("station_lng" <= '-87.485'::numeric)))) NOT VALID;



ALTER TABLE "public"."gas_prices"
    ADD CONSTRAINT "gas_prices_diesel_positive" CHECK ((("diesel_cents" IS NULL) OR ("diesel_cents" > 0))) NOT VALID;



ALTER TABLE ONLY "public"."gas_prices"
    ADD CONSTRAINT "gas_prices_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."gas_prices"
    ADD CONSTRAINT "gas_prices_premium_positive" CHECK ((("premium_cents" IS NULL) OR ("premium_cents" > 0))) NOT VALID;



ALTER TABLE "public"."gas_prices"
    ADD CONSTRAINT "gas_prices_regular_positive" CHECK ((("regular_cents" IS NULL) OR ("regular_cents" > 0))) NOT VALID;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."posts"
    ADD CONSTRAINT "posts_dest_bbox" CHECK ((("dest_lat" IS NULL) OR ((("dest_lat" >= 15.889) AND ("dest_lat" <= 18.497)) AND (("dest_lng" >= '-89.225'::numeric) AND ("dest_lng" <= '-87.485'::numeric))))) NOT VALID;



ALTER TABLE "public"."posts"
    ADD CONSTRAINT "posts_origin_bbox" CHECK ((("origin_lat" IS NULL) OR ((("origin_lat" >= 15.889) AND ("origin_lat" <= 18.497)) AND (("origin_lng" >= '-89.225'::numeric) AND ("origin_lng" <= '-87.485'::numeric))))) NOT VALID;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."posts"
    ADD CONSTRAINT "posts_seats_filled_nonneg" CHECK (("seats_filled" >= 0)) NOT VALID;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rider_documents"
    ADD CONSTRAINT "rider_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."road_report_gone_votes"
    ADD CONSTRAINT "road_report_gone_votes_pkey" PRIMARY KEY ("user_id", "report_id");



ALTER TABLE ONLY "public"."road_report_votes"
    ADD CONSTRAINT "road_report_votes_pkey" PRIMARY KEY ("user_id", "report_id");



ALTER TABLE "public"."road_reports"
    ADD CONSTRAINT "road_reports_bbox" CHECK (((("lat" >= 15.889) AND ("lat" <= 18.497)) AND (("lng" >= '-89.225'::numeric) AND ("lng" <= '-87.485'::numeric)))) NOT VALID;



ALTER TABLE ONLY "public"."road_reports"
    ADD CONSTRAINT "road_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."strikes"
    ADD CONSTRAINT "strikes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_admin_actions_admin" ON "public"."admin_actions" USING "btree" ("admin_id");



CREATE INDEX "idx_admin_actions_target" ON "public"."admin_actions" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_bookings_post" ON "public"."bookings" USING "btree" ("post_id");



CREATE INDEX "idx_bookings_post_id_status" ON "public"."bookings" USING "btree" ("post_id", "status");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_bookings_unique_user_post" ON "public"."bookings" USING "btree" ("post_id", "user_id") WHERE ("status" <> 'cancelled'::"public"."booking_status");



CREATE INDEX "idx_bookings_user" ON "public"."bookings" USING "btree" ("user_id");



CREATE INDEX "idx_bookings_user_id" ON "public"."bookings" USING "btree" ("user_id");



CREATE INDEX "idx_contract_events_contract" ON "public"."contract_events" USING "btree" ("contract_id", "created_at");



CREATE INDEX "idx_contract_events_contract_id" ON "public"."contract_events" USING "btree" ("contract_id");



CREATE INDEX "idx_contract_messages_contract" ON "public"."contract_messages" USING "btree" ("contract_id", "created_at");



CREATE INDEX "idx_contract_messages_contract_id" ON "public"."contract_messages" USING "btree" ("contract_id");



CREATE INDEX "idx_contract_messages_sender" ON "public"."contract_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_contracts_booking_id" ON "public"."contracts" USING "btree" ("booking_id");



CREATE INDEX "idx_contracts_parties" ON "public"."contracts" USING "gin" ("parties");



CREATE INDEX "idx_contracts_post_id" ON "public"."contracts" USING "btree" ("post_id");



CREATE INDEX "idx_contracts_status" ON "public"."contracts" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_driver_checkin_unique" ON "public"."driver_checkins" USING "btree" ("driver_id", "contract_id");



CREATE INDEX "idx_driver_checkins_contract" ON "public"."driver_checkins" USING "btree" ("contract_id");



CREATE INDEX "idx_driver_checkins_contract_id" ON "public"."driver_checkins" USING "btree" ("contract_id");



CREATE INDEX "idx_driver_details_review" ON "public"."driver_details" USING "btree" ("review_status");



CREATE INDEX "idx_driver_documents_profile" ON "public"."driver_documents" USING "btree" ("profile_id");



CREATE INDEX "idx_driver_documents_profile_id" ON "public"."driver_documents" USING "btree" ("profile_id");



CREATE INDEX "idx_driver_documents_review" ON "public"."driver_documents" USING "btree" ("review_status") WHERE ("review_status" = 'pending'::"public"."review_status");



CREATE INDEX "idx_ekyash_contract" ON "public"."ekyash_transactions" USING "btree" ("contract_id");



CREATE INDEX "idx_ekyash_order" ON "public"."ekyash_transactions" USING "btree" ("order_id");



CREATE INDEX "idx_ekyash_payee" ON "public"."ekyash_transactions" USING "btree" ("payee_id");



CREATE INDEX "idx_ekyash_payer" ON "public"."ekyash_transactions" USING "btree" ("payer_id");



CREATE INDEX "idx_ekyash_status" ON "public"."ekyash_transactions" USING "btree" ("status");



CREATE INDEX "idx_ekyash_transactions_contract_id" ON "public"."ekyash_transactions" USING "btree" ("contract_id");



CREATE INDEX "idx_ekyash_transactions_order_id" ON "public"."ekyash_transactions" USING "btree" ("order_id");



CREATE INDEX "idx_email_receipts_contract" ON "public"."email_receipts" USING "btree" ("contract_id");



CREATE INDEX "idx_email_receipts_ekyash_txn" ON "public"."email_receipts" USING "btree" ("ekyash_txn_id");



CREATE INDEX "idx_email_receipts_user" ON "public"."email_receipts" USING "btree" ("user_id");



CREATE INDEX "idx_flags_status" ON "public"."flags" USING "btree" ("status");



CREATE INDEX "idx_flags_target" ON "public"."flags" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_gas_prices_recent" ON "public"."gas_prices" USING "btree" ("reported_at" DESC);



CREATE INDEX "idx_gas_prices_station" ON "public"."gas_prices" USING "btree" ("station_lat", "station_lng");



CREATE INDEX "idx_notifications_created" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_unread" ON "public"."notifications" USING "btree" ("user_id") WHERE ("read" = false);



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user_id_read" ON "public"."notifications" USING "btree" ("user_id", "read");



CREATE INDEX "idx_posts_author" ON "public"."posts" USING "btree" ("author_id");



CREATE INDEX "idx_posts_author_id" ON "public"."posts" USING "btree" ("author_id");



CREATE INDEX "idx_posts_created" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_posts_created_at" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_posts_departure" ON "public"."posts" USING "btree" ("departure_at") WHERE ("status" = 'open'::"public"."post_status");



CREATE INDEX "idx_posts_origin_coords" ON "public"."posts" USING "btree" ("origin_lat", "origin_lng") WHERE ("origin_lat" IS NOT NULL);



CREATE INDEX "idx_posts_status" ON "public"."posts" USING "btree" ("status");



CREATE INDEX "idx_posts_type" ON "public"."posts" USING "btree" ("type");



CREATE INDEX "idx_profiles_account_status" ON "public"."profiles" USING "btree" ("account_status");



CREATE INDEX "idx_profiles_district" ON "public"."profiles" USING "btree" ("district");



CREATE INDEX "idx_profiles_phone" ON "public"."profiles" USING "btree" ("phone");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_ratings_contract" ON "public"."ratings" USING "btree" ("contract_id");



CREATE INDEX "idx_ratings_contract_id" ON "public"."ratings" USING "btree" ("contract_id");



CREATE INDEX "idx_ratings_rated" ON "public"."ratings" USING "btree" ("rated_id");



CREATE INDEX "idx_ratings_rated_id" ON "public"."ratings" USING "btree" ("rated_id");



CREATE UNIQUE INDEX "idx_ratings_unique" ON "public"."ratings" USING "btree" ("contract_id", "rater_id");



CREATE INDEX "idx_rider_documents_review" ON "public"."rider_documents" USING "btree" ("review_status");



CREATE INDEX "idx_rider_documents_user" ON "public"."rider_documents" USING "btree" ("user_id");



CREATE INDEX "idx_road_report_gone_votes_report" ON "public"."road_report_gone_votes" USING "btree" ("report_id");



CREATE INDEX "idx_road_reports_coords" ON "public"."road_reports" USING "btree" ("lat", "lng");



CREATE INDEX "idx_road_reports_expires" ON "public"."road_reports" USING "btree" ("expires_at");



CREATE INDEX "idx_road_reports_expires_at" ON "public"."road_reports" USING "btree" ("expires_at");



CREATE INDEX "idx_road_reports_type" ON "public"."road_reports" USING "btree" ("type");



CREATE INDEX "idx_strikes_user" ON "public"."strikes" USING "btree" ("user_id");



CREATE INDEX "idx_strikes_user_id" ON "public"."strikes" USING "btree" ("user_id");



CREATE INDEX "idx_waitlist_post" ON "public"."waitlist" USING "btree" ("post_id");



CREATE UNIQUE INDEX "idx_waitlist_unique" ON "public"."waitlist" USING "btree" ("post_id", "user_id");



CREATE OR REPLACE TRIGGER "enforce_phone_change_rate_limit" BEFORE UPDATE OF "phone_changed_at" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_phone_change_rate_limit"();



CREATE OR REPLACE TRIGGER "on_booking_after_insert" AFTER INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_booking_after"();



CREATE OR REPLACE TRIGGER "on_booking_before_insert" BEFORE INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_booking_before"();



CREATE OR REPLACE TRIGGER "on_booking_status_change" AFTER UPDATE OF "status" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_booking_status_change"();



CREATE OR REPLACE TRIGGER "on_ekyash_approved" AFTER UPDATE ON "public"."ekyash_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."accumulate_donation"();



CREATE OR REPLACE TRIGGER "on_rating_inserted" AFTER INSERT ON "public"."ratings" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_rating"();



CREATE OR REPLACE TRIGGER "on_strike_created" AFTER INSERT ON "public"."strikes" FOR EACH ROW EXECUTE FUNCTION "public"."increment_strike_counter"();



CREATE OR REPLACE TRIGGER "set_bookings_updated_at" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_ekyash_updated_at" BEFORE UPDATE ON "public"."ekyash_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_posts_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_contract_event_notify" AFTER INSERT ON "public"."contract_events" FOR EACH ROW EXECUTE FUNCTION "public"."notify_contract_event"();



CREATE OR REPLACE TRIGGER "trg_message_notification" AFTER INSERT ON "public"."contract_messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_new_message"();



CREATE OR REPLACE TRIGGER "trg_post_deleted_notification" BEFORE DELETE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_post_deleted"();



CREATE OR REPLACE TRIGGER "trg_post_status_change" AFTER UPDATE OF "status" ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_post_status_change"();



ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contract_events"
    ADD CONSTRAINT "contract_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contract_events"
    ADD CONSTRAINT "contract_events_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contract_messages"
    ADD CONSTRAINT "contract_messages_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contract_messages"
    ADD CONSTRAINT "contract_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_checkins"
    ADD CONSTRAINT "driver_checkins_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_checkins"
    ADD CONSTRAINT "driver_checkins_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_details"
    ADD CONSTRAINT "driver_details_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_details"
    ADD CONSTRAINT "driver_details_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."driver_documents"
    ADD CONSTRAINT "driver_documents_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_documents"
    ADD CONSTRAINT "driver_documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ekyash_transactions"
    ADD CONSTRAINT "ekyash_transactions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id");



ALTER TABLE ONLY "public"."ekyash_transactions"
    ADD CONSTRAINT "ekyash_transactions_payee_id_fkey" FOREIGN KEY ("payee_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."ekyash_transactions"
    ADD CONSTRAINT "ekyash_transactions_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."email_receipts"
    ADD CONSTRAINT "email_receipts_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id");



ALTER TABLE ONLY "public"."email_receipts"
    ADD CONSTRAINT "email_receipts_ekyash_txn_id_fkey" FOREIGN KEY ("ekyash_txn_id") REFERENCES "public"."ekyash_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_receipts"
    ADD CONSTRAINT "email_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flags"
    ADD CONSTRAINT "flags_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."flags"
    ADD CONSTRAINT "flags_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."gas_price_verifications"
    ADD CONSTRAINT "gas_price_verifications_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "public"."gas_prices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gas_price_verifications"
    ADD CONSTRAINT "gas_price_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gas_prices"
    ADD CONSTRAINT "gas_prices_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_rated_id_fkey" FOREIGN KEY ("rated_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."rider_documents"
    ADD CONSTRAINT "rider_documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."rider_documents"
    ADD CONSTRAINT "rider_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."road_report_gone_votes"
    ADD CONSTRAINT "road_report_gone_votes_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."road_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."road_report_gone_votes"
    ADD CONSTRAINT "road_report_gone_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."road_report_votes"
    ADD CONSTRAINT "road_report_votes_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."road_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."road_report_votes"
    ADD CONSTRAINT "road_report_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."road_reports"
    ADD CONSTRAINT "road_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."strikes"
    ADD CONSTRAINT "strikes_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id");



ALTER TABLE ONLY "public"."strikes"
    ADD CONSTRAINT "strikes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Contract parties can read messages" ON "public"."contract_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."contracts"
  WHERE (("contracts"."id" = "contract_messages"."contract_id") AND ("auth"."uid"() = ANY ("contracts"."parties"))))));



CREATE POLICY "Parties can insert own events" ON "public"."contract_events" FOR INSERT WITH CHECK ((("actor_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."contracts" "c"
  WHERE (("c"."id" = "contract_events"."contract_id") AND ("auth"."uid"() = ANY ("c"."parties")) AND ("c"."status" = 'active'::"public"."contract_status"))))));



CREATE POLICY "Parties can view contract events" ON "public"."contract_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."contracts" "c"
  WHERE (("c"."id" = "contract_events"."contract_id") AND ("auth"."uid"() = ANY ("c"."parties"))))));



ALTER TABLE "public"."admin_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_actions_select_admin" ON "public"."admin_actions" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings_insert_active_only" ON "public"."bookings" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_active_account"()));



CREATE POLICY "bookings_select_involved" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("post_id" IN ( SELECT "posts"."id"
   FROM "public"."posts"
  WHERE ("posts"."author_id" = "auth"."uid"())))));



CREATE POLICY "bookings_update_author" ON "public"."bookings" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."posts"
  WHERE (("posts"."id" = "bookings"."post_id") AND ("posts"."author_id" = "auth"."uid"()))))) WITH CHECK (("status" = ANY (ARRAY['completed'::"public"."booking_status", 'no_show'::"public"."booking_status", 'cancelled'::"public"."booking_status"])));



CREATE POLICY "bookings_update_own" ON "public"."bookings" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("status" = ANY (ARRAY['cancelled'::"public"."booking_status", 'completed'::"public"."booking_status"])));



ALTER TABLE "public"."contract_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contract_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contract_messages_insert" ON "public"."contract_messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND "public"."is_active_account"() AND (EXISTS ( SELECT 1
   FROM "public"."contracts"
  WHERE (("contracts"."id" = "contract_messages"."contract_id") AND ("auth"."uid"() = ANY ("contracts"."parties")))))));



CREATE POLICY "contract_parties_view_checkins" ON "public"."driver_checkins" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."contracts"
  WHERE (("contracts"."id" = "driver_checkins"."contract_id") AND ("auth"."uid"() = ANY ("contracts"."parties"))))));



ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contracts_select_party" ON "public"."contracts" FOR SELECT TO "authenticated" USING (("auth"."uid"() = ANY ("parties")));



ALTER TABLE "public"."donation_totals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "donation_totals_select_all" ON "public"."donation_totals" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."driver_checkins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_details" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "driver_details_insert_own" ON "public"."driver_details" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "driver_details_select_own_or_admin" ON "public"."driver_details" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "driver_details_update_own" ON "public"."driver_details" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."driver_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "driver_documents_admin_select" ON "public"."driver_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."role")))));



CREATE POLICY "driver_documents_admin_update" ON "public"."driver_documents" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."role")))));



CREATE POLICY "driver_documents_insert" ON "public"."driver_documents" FOR INSERT WITH CHECK (("auth"."uid"() = "profile_id"));



CREATE POLICY "driver_documents_select" ON "public"."driver_documents" FOR SELECT USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "driver_documents_update" ON "public"."driver_documents" FOR UPDATE USING (("auth"."uid"() = "profile_id")) WITH CHECK (("review_status" = 'pending'::"public"."review_status"));



CREATE POLICY "drivers_insert_own_checkins" ON "public"."driver_checkins" FOR INSERT WITH CHECK (("auth"."uid"() = "driver_id"));



CREATE POLICY "ekyash_select_involved" ON "public"."ekyash_transactions" FOR SELECT TO "authenticated" USING ((("payer_id" = "auth"."uid"()) OR ("payee_id" = "auth"."uid"())));



ALTER TABLE "public"."ekyash_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_receipts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_receipts_select_own" ON "public"."email_receipts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."flags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "flags_insert_authenticated" ON "public"."flags" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));



CREATE POLICY "flags_select_admin" ON "public"."flags" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "flags_update_admin" ON "public"."flags" FOR UPDATE TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."gas_price_verifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gas_price_verifications_insert_own" ON "public"."gas_price_verifications" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "gas_price_verifications_select_own" ON "public"."gas_price_verifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."gas_prices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gas_prices_insert_authenticated" ON "public"."gas_prices" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));



CREATE POLICY "gas_prices_select_all" ON "public"."gas_prices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "gas_prices_update_owner" ON "public"."gas_prices" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "reporter_id")) WITH CHECK (("auth"."uid"() = "reporter_id"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posts_delete_author" ON "public"."posts" FOR DELETE TO "authenticated" USING (("author_id" = "auth"."uid"()));



CREATE POLICY "posts_insert_active_only" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK ((("author_id" = "auth"."uid"()) AND "public"."is_active_account"()));



CREATE POLICY "posts_select_all" ON "public"."posts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "posts_update_author" ON "public"."posts" FOR UPDATE USING (("author_id" = "auth"."uid"())) WITH CHECK ((("author_id" = "auth"."uid"()) AND (NOT ("seats_filled" IS DISTINCT FROM ( SELECT "p"."seats_filled"
   FROM "public"."posts" "p"
  WHERE ("p"."id" = "posts"."id")))) AND (NOT (("status" = 'activated'::"public"."post_status") AND (( SELECT "p"."status"
   FROM "public"."posts" "p"
  WHERE ("p"."id" = "posts"."id")) <> 'activated'::"public"."post_status"))) AND (NOT (("status" = 'open'::"public"."post_status") AND (( SELECT "p"."status"
   FROM "public"."posts" "p"
  WHERE ("p"."id" = "posts"."id")) = ANY (ARRAY['expired'::"public"."post_status", 'completed'::"public"."post_status"]))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK ((("id" = "auth"."uid"()) AND (NOT ("role" IS DISTINCT FROM ( SELECT "p"."role"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) AND (NOT ("account_status" IS DISTINCT FROM ( SELECT "p"."account_status"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) AND (NOT ("strikes_soft" IS DISTINCT FROM ( SELECT "p"."strikes_soft"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) AND (NOT ("strikes_hard" IS DISTINCT FROM ( SELECT "p"."strikes_hard"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) AND (NOT ("rating_avg" IS DISTINCT FROM ( SELECT "p"."rating_avg"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"())))) AND (NOT ("punctuality_pct" IS DISTINCT FROM ( SELECT "p"."punctuality_pct"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))))));



ALTER TABLE "public"."ratings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ratings_insert_party" ON "public"."ratings" FOR INSERT TO "authenticated" WITH CHECK ((("rater_id" = "auth"."uid"()) AND ("contract_id" IN ( SELECT "contracts"."id"
   FROM "public"."contracts"
  WHERE ("auth"."uid"() = ANY ("contracts"."parties"))))));



CREATE POLICY "ratings_select_party" ON "public"."ratings" FOR SELECT USING ((("rater_id" = "auth"."uid"()) OR ("rated_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."rider_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rider_documents_insert_own" ON "public"."rider_documents" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "rider_documents_select_own_or_admin" ON "public"."rider_documents" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."road_report_gone_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "road_report_gone_votes_select_own" ON "public"."road_report_gone_votes" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."road_report_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "road_report_votes_insert_own" ON "public"."road_report_votes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "road_report_votes_select_own" ON "public"."road_report_votes" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."road_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "road_reports_delete_owner" ON "public"."road_reports" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "reporter_id"));



CREATE POLICY "road_reports_insert_authenticated" ON "public"."road_reports" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));



CREATE POLICY "road_reports_select_all" ON "public"."road_reports" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "road_reports_update_owner" ON "public"."road_reports" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "reporter_id")) WITH CHECK (("auth"."uid"() = "reporter_id"));



ALTER TABLE "public"."strikes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "strikes_select_own" ON "public"."strikes" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "waitlist_delete_own" ON "public"."waitlist" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "waitlist_insert_own" ON "public"."waitlist" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "waitlist_select_own" ON "public"."waitlist" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));











ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."contract_messages";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."accept_applicant"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_applicant"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_applicant"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_job_application"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_job_application"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_job_application"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."accumulate_donation"() TO "anon";
GRANT ALL ON FUNCTION "public"."accumulate_donation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."accumulate_donation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_driver_documents_complete"("p_profile_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_driver_documents_complete"("p_profile_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_driver_documents_complete"("p_profile_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_rating_avg"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."compute_rating_avg"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_rating_avg"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_phone_change_rate_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_phone_change_rate_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_phone_change_rate_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_booking_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_booking_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_booking_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_booking_after"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_booking_after"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_booking_after"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_booking_before"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_booking_before"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_booking_before"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_post_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_post_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_post_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_strike_counter"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_strike_counter"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_strike_counter"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_active_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_active_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_contract_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_contract_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_contract_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_new_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_new_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_new_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_post_deleted"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_post_deleted"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_post_deleted"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_ekyash_payment"("p_order_id" "text", "p_transaction_id" "text", "p_callback_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."process_ekyash_payment"("p_order_id" "text", "p_transaction_id" "text", "p_callback_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_ekyash_payment"("p_order_id" "text", "p_transaction_id" "text", "p_callback_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_rating"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_applicant"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_applicant"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_applicant"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_job_application"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_job_application"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_job_application"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."report_road_report_gone"("report_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."report_road_report_gone"("report_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_road_report_gone"("report_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."switch_to_driver_role"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."switch_to_driver_role"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."switch_to_driver_role"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."road_reports" TO "anon";
GRANT ALL ON TABLE "public"."road_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."road_reports" TO "service_role";



GRANT ALL ON FUNCTION "public"."upvote_road_report"("report_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upvote_road_report"("report_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upvote_road_report"("report_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."gas_prices" TO "anon";
GRANT ALL ON TABLE "public"."gas_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."gas_prices" TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_gas_price"("price_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_gas_price"("price_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_gas_price"("price_id" "uuid") TO "service_role";
























GRANT ALL ON TABLE "public"."admin_actions" TO "anon";
GRANT ALL ON TABLE "public"."admin_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_actions" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."contract_events" TO "anon";
GRANT ALL ON TABLE "public"."contract_events" TO "authenticated";
GRANT ALL ON TABLE "public"."contract_events" TO "service_role";



GRANT ALL ON TABLE "public"."contract_messages" TO "anon";
GRANT ALL ON TABLE "public"."contract_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."contract_messages" TO "service_role";



GRANT ALL ON TABLE "public"."contracts" TO "anon";
GRANT ALL ON TABLE "public"."contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."contracts" TO "service_role";



GRANT ALL ON TABLE "public"."donation_totals" TO "anon";
GRANT ALL ON TABLE "public"."donation_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."donation_totals" TO "service_role";



GRANT ALL ON TABLE "public"."driver_checkins" TO "anon";
GRANT ALL ON TABLE "public"."driver_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_checkins" TO "service_role";



GRANT ALL ON TABLE "public"."driver_details" TO "anon";
GRANT ALL ON TABLE "public"."driver_details" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_details" TO "service_role";



GRANT ALL ON TABLE "public"."driver_documents" TO "anon";
GRANT ALL ON TABLE "public"."driver_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_documents" TO "service_role";



GRANT ALL ON TABLE "public"."ekyash_transactions" TO "anon";
GRANT ALL ON TABLE "public"."ekyash_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."ekyash_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."email_receipts" TO "anon";
GRANT ALL ON TABLE "public"."email_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."email_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."flags" TO "anon";
GRANT ALL ON TABLE "public"."flags" TO "authenticated";
GRANT ALL ON TABLE "public"."flags" TO "service_role";



GRANT ALL ON TABLE "public"."gas_price_verifications" TO "anon";
GRANT ALL ON TABLE "public"."gas_price_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."gas_price_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."profiles_public" TO "anon";
GRANT ALL ON TABLE "public"."profiles_public" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles_public" TO "service_role";



GRANT ALL ON TABLE "public"."ratings" TO "anon";
GRANT ALL ON TABLE "public"."ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."ratings" TO "service_role";



GRANT ALL ON TABLE "public"."ratings_public" TO "anon";
GRANT ALL ON TABLE "public"."ratings_public" TO "authenticated";
GRANT ALL ON TABLE "public"."ratings_public" TO "service_role";



GRANT ALL ON TABLE "public"."rider_documents" TO "anon";
GRANT ALL ON TABLE "public"."rider_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."rider_documents" TO "service_role";



GRANT ALL ON TABLE "public"."road_report_gone_votes" TO "anon";
GRANT ALL ON TABLE "public"."road_report_gone_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."road_report_gone_votes" TO "service_role";



GRANT ALL ON TABLE "public"."road_report_votes" TO "anon";
GRANT ALL ON TABLE "public"."road_report_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."road_report_votes" TO "service_role";



GRANT ALL ON TABLE "public"."strikes" TO "anon";
GRANT ALL ON TABLE "public"."strikes" TO "authenticated";
GRANT ALL ON TABLE "public"."strikes" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































