-- Fix switch_to_driver_role: the original RPC (from 00001) referenced
-- `driver_documents.user_id`, but that table uses `profile_id`.
-- This caused "column user_id does not exist" when users tried to switch to driver role.

CREATE OR REPLACE FUNCTION public.switch_to_driver_role(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_gov_id_ok boolean;
  v_driver_docs_ok boolean;
BEGIN
  -- Check government ID is approved (rider_documents uses user_id)
  SELECT EXISTS(
    SELECT 1 FROM rider_documents
    WHERE user_id = p_user_id AND review_status = 'approved'
  ) INTO v_gov_id_ok;

  IF NOT v_gov_id_ok THEN
    RAISE EXCEPTION 'Government ID not approved';
  END IF;

  -- Check all required driver doc types are approved (driver_documents uses profile_id)
  SELECT (
    SELECT COUNT(DISTINCT document_type)
    FROM driver_documents
    WHERE profile_id = p_user_id
      AND review_status = 'approved'
      AND document_type IN ('drivers_license', 'vehicle_registration', 'vehicle_insurance')
  ) = 3 INTO v_driver_docs_ok;

  IF NOT v_driver_docs_ok THEN
    RAISE EXCEPTION 'Not all required driver documents are approved';
  END IF;

  UPDATE profiles SET role = 'driver', updated_at = now() WHERE id = p_user_id;
END;
$$;
