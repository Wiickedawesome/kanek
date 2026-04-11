-- ═══════════════════════════════════════════════════════════════════
-- Migration 00050: Phase 2 Database & RLS Audit Security Fixes
-- ═══════════════════════════════════════════════════════════════════
-- Audit Report: docs/audit-reports/phase2-database-rls.md
-- Fixes: C-01, C-02, C-03, H-01, H-02, H-03, M-01 through M-05,
--         L-02, L-03
-- ═══════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────
-- C-01: Prevent profiles role/status/strikes/rating self-escalation
-- ─────────────────────────────────────────────────────────────────
-- WITH CHECK on RLS policy ensures users cannot change protected
-- columns. SECURITY DEFINER functions bypass RLS and can still
-- update these columns internally.

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role IS NOT DISTINCT FROM (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
  AND account_status IS NOT DISTINCT FROM (SELECT p.account_status FROM profiles p WHERE p.id = auth.uid())
  AND strikes_soft IS NOT DISTINCT FROM (SELECT p.strikes_soft FROM profiles p WHERE p.id = auth.uid())
  AND strikes_hard IS NOT DISTINCT FROM (SELECT p.strikes_hard FROM profiles p WHERE p.id = auth.uid())
  AND rating_avg IS NOT DISTINCT FROM (SELECT p.rating_avg FROM profiles p WHERE p.id = auth.uid())
  AND punctuality_pct IS NOT DISTINCT FROM (SELECT p.punctuality_pct FROM profiles p WHERE p.id = auth.uid())
  AND total_rides IS NOT DISTINCT FROM (SELECT p.total_rides FROM profiles p WHERE p.id = auth.uid())
);


-- ─────────────────────────────────────────────────────────────────
-- C-02: driver_documents UPDATE — prevent user self-approval
-- ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "driver_documents_update" ON driver_documents;
CREATE POLICY "driver_documents_update" ON driver_documents FOR UPDATE
USING (auth.uid() = profile_id)
WITH CHECK (review_status = 'pending');


-- ─────────────────────────────────────────────────────────────────
-- C-03: Restrict profiles SELECT to own row + admin
-- ─────────────────────────────────────────────────────────────────
-- Cross-user profile lookups must use the profiles_public view
-- (created in 00044), which bypasses table RLS via view owner.

DROP POLICY IF EXISTS "profiles_select_public" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
USING (id = auth.uid() OR is_admin());


-- ─────────────────────────────────────────────────────────────────
-- H-01: Split bookings UPDATE — prevent booker self-confirm
-- ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "bookings_update_involved" ON bookings;

-- Bookers: cancel or complete only (no self-confirm)
CREATE POLICY "bookings_update_own" ON bookings FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (status IN ('cancelled', 'completed'));

-- Post authors: complete, no_show, or cancel (accept/reject via RPCs)
CREATE POLICY "bookings_update_author" ON bookings FOR UPDATE
USING (EXISTS (SELECT 1 FROM posts WHERE posts.id = bookings.post_id AND posts.author_id = auth.uid()))
WITH CHECK (status IN ('completed', 'no_show', 'cancelled'));


-- ─────────────────────────────────────────────────────────────────
-- H-02: Anonymous ratings — mask rater_id + restrict table SELECT
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW ratings_public AS
SELECT
  r.id, r.contract_id, r.rated_id, r.stars, r.was_on_time, r.comment,
  r.is_anonymous, r.created_at,
  CASE WHEN r.is_anonymous THEN NULL ELSE r.rater_id END AS rater_id,
  CASE WHEN r.is_anonymous THEN NULL ELSE p.first_name END AS rater_first_name,
  CASE WHEN r.is_anonymous THEN NULL ELSE p.last_name END AS rater_last_name,
  CASE WHEN r.is_anonymous THEN NULL ELSE p.avatar_url END AS rater_avatar_url,
  CASE WHEN r.is_anonymous THEN NULL ELSE p.role END AS rater_role
FROM ratings r
LEFT JOIN profiles p ON p.id = r.rater_id;

GRANT SELECT ON ratings_public TO authenticated;

DROP POLICY IF EXISTS "ratings_select_all" ON ratings;
CREATE POLICY "ratings_select_party" ON ratings FOR SELECT
USING (
  rater_id = auth.uid()
  OR rated_id = auth.uid()
  OR is_admin()
);


-- ═══════════════════════════════════════════════════════════════════
-- H-03: SET search_path = public on SECURITY DEFINER functions
-- ═══════════════════════════════════════════════════════════════════
-- Recreate all SECURITY DEFINER functions that were missing
-- SET search_path. Preserves existing logic exactly.
-- ═══════════════════════════════════════════════════════════════════

-- ── Core auth utilities ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION is_active_account()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND account_status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ── Profile-related triggers ─────────────────────────────────────

CREATE OR REPLACE FUNCTION recalculate_rating()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION increment_strike_counter()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Payment triggers ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION accumulate_donation()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.donation_cents > 0 THEN
    UPDATE donation_totals
    SET total_cents = total_cents + NEW.donation_cents, updated_at = now()
    WHERE id = 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Booking triggers ─────────────────────────────────────────────

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Post triggers ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_post_status_change()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Notification triggers ────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_on_new_message()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION notify_on_post_deleted()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION notify_contract_event()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── RPCs ─────────────────────────────────────────────────────────

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- L-02: reject_applicant — add active account gate + SET search_path
CREATE OR REPLACE FUNCTION reject_applicant(p_booking_id uuid)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION accept_job_application(p_booking_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM accept_applicant(p_booking_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION reject_job_application(p_booking_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM reject_applicant(p_booking_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── Utility functions ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_driver_documents_complete(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) = 3
  FROM driver_documents
  WHERE profile_id = p_profile_id
    AND review_status = 'approved'
    AND document_type IN ('drivers_license', 'vehicle_insurance', 'vehicle_registration');
$$;


-- ─────────────────────────────────────────────────────────────────
-- M-01: Road report gone — per-user deduplication
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS road_report_gone_votes (
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id  uuid REFERENCES road_reports(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, report_id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE road_report_gone_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "road_report_gone_votes_select_own"
  ON road_report_gone_votes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_road_report_gone_votes_report
  ON road_report_gone_votes(report_id);

CREATE OR REPLACE FUNCTION report_road_report_gone(report_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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


-- ─────────────────────────────────────────────────────────────────
-- M-02: Missing indexes on FK and commonly queried columns
-- ─────────────────────────────────────────────────────────────────

-- High priority
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_bookings_post_id_status ON bookings(post_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_booking_id ON contracts(booking_id);
CREATE INDEX IF NOT EXISTS idx_contracts_parties ON contracts USING GIN(parties);
CREATE INDEX IF NOT EXISTS idx_ratings_rated_id ON ratings(rated_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_contract_messages_contract_id ON contract_messages(contract_id);
CREATE INDEX IF NOT EXISTS idx_ekyash_transactions_order_id ON ekyash_transactions(order_id);

-- Medium priority
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_contract_id ON ratings(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_events_contract_id ON contract_events(contract_id);
CREATE INDEX IF NOT EXISTS idx_ekyash_transactions_contract_id ON ekyash_transactions(contract_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_profile_id ON driver_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_driver_checkins_contract_id ON driver_checkins(contract_id);
CREATE INDEX IF NOT EXISTS idx_strikes_user_id ON strikes(user_id);
CREATE INDEX IF NOT EXISTS idx_road_reports_expires_at ON road_reports(expires_at);
CREATE INDEX IF NOT EXISTS idx_contracts_post_id ON contracts(post_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);


-- ─────────────────────────────────────────────────────────────────
-- M-03: Posts UPDATE protection — prevent self-activate, protect
--       seats_filled, prevent re-opening expired/completed
-- ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "posts_update_author" ON posts;
CREATE POLICY "posts_update_author" ON posts FOR UPDATE
USING (author_id = auth.uid())
WITH CHECK (
  author_id = auth.uid()
  -- seats_filled is managed by triggers; author cannot change it
  AND seats_filled IS NOT DISTINCT FROM (SELECT p.seats_filled FROM posts p WHERE p.id = posts.id)
  -- Cannot self-activate (must go through check-route-activation edge function)
  AND NOT (
    status = 'activated'
    AND (SELECT p.status FROM posts p WHERE p.id = posts.id) != 'activated'
  )
  -- Cannot re-open expired or completed posts
  AND NOT (
    status = 'open'
    AND (SELECT p.status FROM posts p WHERE p.id = posts.id) IN ('expired', 'completed')
  )
);


-- ─────────────────────────────────────────────────────────────────
-- M-04: CHECK constraints on prices, seats, and coordinates
-- ─────────────────────────────────────────────────────────────────
-- Using NOT VALID to avoid blocking on existing data; new rows
-- will be validated. Run VALIDATE CONSTRAINT separately if needed.

-- posts (seats_filled, origin/dest bounding box — price/seats_total already have CHECKs)
ALTER TABLE posts ADD CONSTRAINT posts_seats_filled_nonneg
  CHECK (seats_filled >= 0) NOT VALID;
ALTER TABLE posts ADD CONSTRAINT posts_origin_bbox
  CHECK (origin_lat IS NULL OR (origin_lat BETWEEN 15.889 AND 18.497 AND origin_lng BETWEEN -89.225 AND -87.485))
  NOT VALID;
ALTER TABLE posts ADD CONSTRAINT posts_dest_bbox
  CHECK (dest_lat IS NULL OR (dest_lat BETWEEN 15.889 AND 18.497 AND dest_lng BETWEEN -89.225 AND -87.485))
  NOT VALID;

-- ekyash_transactions (platform_fee — amount_cents already has CHECK > 0)
ALTER TABLE ekyash_transactions ADD CONSTRAINT ekyash_fee_nonneg
  CHECK (platform_fee_cents >= 0) NOT VALID;

-- gas_prices (price columns + bounding box)
ALTER TABLE gas_prices ADD CONSTRAINT gas_prices_regular_positive
  CHECK (regular_cents IS NULL OR regular_cents > 0) NOT VALID;
ALTER TABLE gas_prices ADD CONSTRAINT gas_prices_premium_positive
  CHECK (premium_cents IS NULL OR premium_cents > 0) NOT VALID;
ALTER TABLE gas_prices ADD CONSTRAINT gas_prices_diesel_positive
  CHECK (diesel_cents IS NULL OR diesel_cents > 0) NOT VALID;
ALTER TABLE gas_prices ADD CONSTRAINT gas_prices_bbox
  CHECK (station_lat BETWEEN 15.889 AND 18.497 AND station_lng BETWEEN -89.225 AND -87.485)
  NOT VALID;

-- road_reports (bounding box)
ALTER TABLE road_reports ADD CONSTRAINT road_reports_bbox
  CHECK (lat BETWEEN 15.889 AND 18.497 AND lng BETWEEN -89.225 AND -87.485)
  NOT VALID;


-- ─────────────────────────────────────────────────────────────────
-- M-05: contract_events — event_type + note constraints
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE contract_events ADD CONSTRAINT contract_events_type_check
  CHECK (event_type IN (
    'started_ride', 'arrived_pickup', 'picked_up_rider',
    'arrived_destination', 'completed_ride', 'cancelled',
    'delayed', 'rerouted', 'emergency', 'custom'
  )) NOT VALID;

ALTER TABLE contract_events ADD CONSTRAINT contract_events_note_length
  CHECK (note IS NULL OR char_length(note) <= 500) NOT VALID;


-- ─────────────────────────────────────────────────────────────────
-- L-03: Gate contract_messages INSERT behind active account
-- ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Contract parties can insert messages" ON contract_messages;
CREATE POLICY "contract_messages_insert" ON contract_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND is_active_account()
  AND EXISTS (
    SELECT 1 FROM contracts WHERE id = contract_id AND auth.uid() = ANY(parties)
  )
);
