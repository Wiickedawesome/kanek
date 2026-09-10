-- ==============================================================================
-- Migration 00020: Fix PL/pgSQL Lint Errors in Database Functions
-- ==============================================================================
-- 1. admin_review_driver: Cast action expression to admin_action_type enum
-- 2. admin_review_rider_doc: Cast action expression to admin_action_type enum
-- 3. check_user_availability: Explicitly cast mins expression to integer for make_interval
-- 4. upvote_road_report: Qualify report_id to resolve ambiguous column reference
-- 5. verify_gas_price: Qualify price_id to resolve ambiguous column reference
-- ==============================================================================

-- 1. admin_review_driver
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
    (p_action || '_driver')::admin_action_type,
    'driver',
    p_driver_id,
    COALESCE(p_reason, '')
  );

  RETURN 'OK: driver ' || p_driver_id || ' ' || p_action || 'd';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_review_driver(p_driver_id uuid, p_action text, p_reason text, p_admin_id uuid) FROM PUBLIC, anon;

-- 2. admin_review_rider_doc
CREATE OR REPLACE FUNCTION public.admin_review_rider_doc(
  p_doc_id   uuid,
  p_action   text,
  p_reason   text DEFAULT NULL,
  p_admin_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
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

  SELECT user_id INTO v_user_id FROM rider_documents WHERE id = p_doc_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Rider document not found: %', p_doc_id;
  END IF;

  IF p_action = 'approve' THEN
    UPDATE rider_documents SET
      review_status = 'approved',
      verified      = true,
      reviewed_by   = p_admin_id
    WHERE id = p_doc_id;

    UPDATE profiles SET account_status = 'active' WHERE id = v_user_id;

    INSERT INTO notifications (user_id, type, title, body, data) VALUES (
      v_user_id,
      'rider_verified',
      'ID document approved',
      'Your ID document was approved. Your account is now verified.',
      jsonb_build_object('userId', v_user_id::text)
    );

  ELSE
    UPDATE rider_documents SET
      review_status    = 'rejected',
      rejection_reason = p_reason,
      verified         = false,
      reviewed_by      = p_admin_id
    WHERE id = p_doc_id;

    INSERT INTO notifications (user_id, type, title, body, data) VALUES (
      v_user_id,
      'rider_document_rejected',
      'ID document needs changes',
      'Your ID document was rejected: ' || p_reason,
      jsonb_build_object('userId', v_user_id::text)
    );
  END IF;

  INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES (
    p_admin_id,
    (CASE p_action WHEN 'approve' THEN 'approve_rider_doc' ELSE 'reject_rider_doc' END)::admin_action_type,
    'rider_documents',
    p_doc_id,
    p_reason
  );

  RETURN 'OK: rider doc ' || p_doc_id || ' ' || p_action || 'd';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_review_rider_doc(p_doc_id uuid, p_action text, p_reason text, p_admin_id uuid) FROM PUBLIC, anon;

-- 3. check_user_availability
CREATE OR REPLACE FUNCTION public.check_user_availability(
  p_user_id     uuid,
  p_at          timestamptz,
  p_duration_min integer
)
RETURNS TABLE (
  contract_id   uuid,
  post_id       uuid,
  post_title    text,
  post_type     public.post_type,
  departure_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_buffer_min constant integer := 15;
  v_proposed_start timestamptz;
  v_proposed_end   timestamptz;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_caller <> p_user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM bookings b
       JOIN posts p ON p.id = b.post_id
       WHERE b.user_id = p_user_id
         AND b.status = 'pending'
         AND p.author_id = v_caller
    ) THEN
      RAISE EXCEPTION 'Not authorised to check availability for this user';
    END IF;
  END IF;

  v_proposed_start := p_at - make_interval(mins => v_buffer_min);
  v_proposed_end   := p_at + make_interval(mins => (COALESCE(p_duration_min, 60) + v_buffer_min)::integer);

  RETURN QUERY
  SELECT
    c.id,
    p.id,
    COALESCE(p.title, 'Another trip'),
    p.type,
    COALESCE(c.departure_at, p.departure_at)
  FROM contracts c
  JOIN posts p ON p.id = c.post_id
  WHERE p_user_id = ANY (c.parties)
    AND c.status = 'active'
    AND p.type IN ('route_offer', 'route_request', 'errand', 'package')
    AND COALESCE(c.departure_at, p.departure_at) IS NOT NULL
    AND (
      COALESCE(c.departure_at, p.departure_at)
        - make_interval(mins => v_buffer_min)
    ) < v_proposed_end
    AND v_proposed_start < (
      COALESCE(c.departure_at, p.departure_at)
        + make_interval(
            mins => (COALESCE(p.route_duration_min,
                     CASE WHEN p.type IN ('errand','package') THEN 90 ELSE 60 END)::numeric
                    + v_buffer_min)::integer
          )
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_user_availability(p_user_id uuid, p_at timestamp with time zone, p_duration_min integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_user_availability(p_user_id uuid, p_at timestamp with time zone, p_duration_min integer) TO authenticated;

-- 4. upvote_road_report
CREATE OR REPLACE FUNCTION public.upvote_road_report(report_id uuid)
RETURNS public.road_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_column
DECLARE
  caller_id   UUID := auth.uid();
  updated_report road_reports;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert vote; conflict means already voted → no-op
  INSERT INTO road_report_votes (user_id, report_id)
  VALUES (caller_id, upvote_road_report.report_id)
  ON CONFLICT (user_id, report_id) DO NOTHING;

  -- Only increment counter when the insert actually happened
  IF FOUND THEN
    UPDATE road_reports
    SET upvotes = upvotes + 1
    WHERE road_reports.id = upvote_road_report.report_id
    RETURNING * INTO updated_report;
  ELSE
    SELECT * INTO updated_report FROM road_reports WHERE road_reports.id = upvote_road_report.report_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Road report not found';
  END IF;

  RETURN updated_report;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upvote_road_report(report_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upvote_road_report(report_id uuid) TO authenticated;

-- 5. verify_gas_price
CREATE OR REPLACE FUNCTION public.verify_gas_price(price_id uuid)
RETURNS public.gas_prices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_column
DECLARE
  caller_id    UUID := auth.uid();
  updated_price gas_prices;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert verification; conflict means already verified → no-op
  INSERT INTO gas_price_verifications (user_id, price_id)
  VALUES (caller_id, verify_gas_price.price_id)
  ON CONFLICT (user_id, price_id) DO NOTHING;

  IF FOUND THEN
    UPDATE gas_prices
    SET verified_count = verified_count + 1
    WHERE gas_prices.id = verify_gas_price.price_id
    RETURNING * INTO updated_price;
  ELSE
    SELECT * INTO updated_price FROM gas_prices WHERE gas_prices.id = verify_gas_price.price_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gas price not found';
  END IF;

  RETURN updated_price;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_gas_price(price_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_gas_price(price_id uuid) TO authenticated;
