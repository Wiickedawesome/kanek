-- Migration: Server-side role switch validation
-- Ensures user can only switch to driver if all required documents are approved
-- Also adds CHECK constraint and CASCADE FK on email_receipts (P2-I-04)

-- 1. Validated role switch function
CREATE OR REPLACE FUNCTION switch_to_driver_role(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 2. email_receipts: ensure at least one FK reference is non-null
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_receipts_has_reference'
  ) THEN
    ALTER TABLE email_receipts
      ADD CONSTRAINT email_receipts_has_reference
      CHECK (contract_id IS NOT NULL OR ekyash_txn_id IS NOT NULL);
  END IF;
END$$;

-- 3. email_receipts: change ekyash_txn_id FK to CASCADE on delete
-- Drop and recreate the FK constraint
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'email_receipts'::regclass
    AND contype = 'f'
    AND (SELECT attname FROM pg_attribute WHERE attrelid = conrelid AND attnum = ANY(conkey) LIMIT 1) = 'ekyash_txn_id';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE email_receipts DROP CONSTRAINT %I', v_constraint_name);
    ALTER TABLE email_receipts
      ADD CONSTRAINT email_receipts_ekyash_txn_id_fkey
      FOREIGN KEY (ekyash_txn_id) REFERENCES ekyash_transactions(id) ON DELETE CASCADE;
  END IF;
END$$;
