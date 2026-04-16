-- Soft-delete: 90-day recovery window, 1-year data retention, then hard purge.
-- Users can sign back in within 90 days to reactivate.
-- Data is anonymised after 90 days but kept for 1 year for compliance.
-- After 1 year the auth user + cascade deletes everything.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON public.profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;
