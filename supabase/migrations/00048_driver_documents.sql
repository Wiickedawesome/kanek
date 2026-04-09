-- Driver documents: per-document tracking with expiration dates
-- Required for driver role: drivers_license, vehicle_insurance, vehicle_registration, police_record

-- Enum for driver document types
CREATE TYPE driver_document_type AS ENUM (
  'drivers_license',
  'vehicle_insurance',
  'vehicle_registration',
  'police_record'
);

CREATE TABLE driver_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type   driver_document_type NOT NULL,
  document_url    text NOT NULL,
  document_number text,                          -- license #, policy #, registration #, record #
  expiration_date date,                          -- NULL for police_record (we compute 6-month validity from uploaded_at)
  review_status   review_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  reviewed_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- One active document per type per user
  UNIQUE (profile_id, document_type)
);

-- Index for lookups by profile
CREATE INDEX idx_driver_documents_profile ON driver_documents(profile_id);

-- Index for admin review queue
CREATE INDEX idx_driver_documents_review ON driver_documents(review_status) WHERE review_status = 'pending';

-- RLS
ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;

-- Users can read their own documents
CREATE POLICY driver_documents_select ON driver_documents
  FOR SELECT USING (auth.uid() = profile_id);

-- Users can insert their own documents
CREATE POLICY driver_documents_insert ON driver_documents
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Users can update their own documents (re-upload)
CREATE POLICY driver_documents_update ON driver_documents
  FOR UPDATE USING (auth.uid() = profile_id);

-- Admins can read all documents (for review)
CREATE POLICY driver_documents_admin_select ON driver_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update any document (approve/reject)
CREATE POLICY driver_documents_admin_update ON driver_documents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Helper view: check if a user has all required driver documents approved
CREATE OR REPLACE FUNCTION check_driver_documents_complete(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*) = 4
  FROM driver_documents
  WHERE profile_id = p_profile_id
    AND review_status = 'approved'
    AND document_type IN ('drivers_license', 'vehicle_insurance', 'vehicle_registration', 'police_record');
$$;
