-- Rename user-facing "route" → "ride" in DB trigger/function notification text.
-- Does NOT change column names, enum values, or any schema — only user-visible strings.

-- 1. handle_new_booking_after: "offered to drive your route" → "offered to drive your ride"
CREATE OR REPLACE FUNCTION public.handle_new_booking_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    v_notif_body  := v_booker_name || ' offered to drive your ride "' || v_post_title || '". Review and accept.';

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

-- 2. admin_review_driver: "post routes" → "post rides"
CREATE OR REPLACE FUNCTION public.admin_review_driver(
  p_driver_id uuid,
  p_action    text,
  p_reason    text DEFAULT NULL,
  p_admin_id  uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'p_admin_id is required';
  END IF;
  PERFORM _admin_check(p_admin_id);

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be approve or reject.', p_action;
  END IF;
  IF p_action = 'reject' AND (p_reason IS NULL OR trim(p_reason) = '') THEN
    RAISE EXCEPTION 'Reason is required for rejection';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM driver_details WHERE id = p_driver_id) THEN
    RAISE EXCEPTION 'Driver not found: %', p_driver_id;
  END IF;

  IF p_action = 'approve' THEN
    UPDATE driver_details SET
      review_status = 'approved',
      verified      = true,
      verified_at   = now(),
      verified_by   = p_admin_id
    WHERE id = p_driver_id;

    UPDATE profiles SET account_status = 'active' WHERE id = p_driver_id;

    INSERT INTO notifications (user_id, type, title, body, data) VALUES (
      p_driver_id,
      'driver_verified',
      'Driver documents approved',
      'Your driver documents were approved. You can now post rides and accept bookings.',
      jsonb_build_object('userId', p_driver_id::text)
    );

  ELSE
    UPDATE driver_details SET
      review_status    = 'rejected',
      rejection_reason = p_reason,
      verified         = false,
      verified_by      = p_admin_id
    WHERE id = p_driver_id;

    INSERT INTO notifications (user_id, type, title, body, data) VALUES (
      p_driver_id,
      'driver_verification_rejected',
      'Driver documents need changes',
      'Your driver documents were rejected: ' || p_reason,
      jsonb_build_object('userId', p_driver_id::text)
    );
  END IF;

  INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES (
    p_admin_id,
    p_action || '_driver',
    'driver',
    p_driver_id,
    COALESCE(p_reason, '')
  );

  RETURN p_action || 'd';
END;
$$;
