-- Remove police_record from driver document requirements
-- Police records cost money and time for Belizean users to obtain

-- Update the completeness check function: now requires 3 docs instead of 4
CREATE OR REPLACE FUNCTION check_driver_documents_complete(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*) = 3
  FROM driver_documents
  WHERE profile_id = p_profile_id
    AND review_status = 'approved'
    AND document_type IN ('drivers_license', 'vehicle_insurance', 'vehicle_registration');
$$;

-- Delete any existing police_record documents
DELETE FROM driver_documents WHERE document_type = 'police_record';

-- Remove the enum value (Postgres doesn't support DROP VALUE from enum directly,
-- but we can leave it in the enum safely — it just won't be used or accepted by the app)
-- The app-layer changes prevent new police_record entries from being created.
COMMENT ON TYPE driver_document_type IS 'police_record value is deprecated and no longer used';
