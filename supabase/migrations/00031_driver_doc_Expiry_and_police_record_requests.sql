-- Driver document expiry enforcement + police record request request flag
-- This migration adds a profile-level request flag for admin-triggered
-- police-record follow-up and a trigger that restricts an account when
-- a stored driver document has an expired expiration_date.

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS police_record_requested boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS police_record_requested_at timestamptz;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS police_record_requested_by uuid NULL;

COMMENT ON COLUMN public.profiles.police_record_requested IS 'Whether an admin has requested a police record upload for this profile.';
COMMENT ON COLUMN public.profiles.police_record_requested_at IS 'When the admin requested the police record upload.';
COMMENT ON COLUMN public.profiles.police_record_requested_by IS 'Admin profile that requested the police record upload.';

CREATE OR REPLACE FUNCTION public.restrict_profile_on_expired_driver_doc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expiration_date IS NOT NULL AND NEW.expiration_date < CURRENT_DATE THEN
    UPDATE public.profiles
      SET account_status = 'restricted'
    WHERE id = NEW.profile_id
      AND account_status IN ('pending', 'active', 'dormant');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_docs_expired_restrict ON public.driver_documents;

CREATE TRIGGER trg_driver_docs_expired_restrict
AFTER INSERT OR UPDATE OF expiration_date ON public.driver_documents
FOR EACH ROW
EXECUTE FUNCTION public.restrict_profile_on_expired_driver_doc();
