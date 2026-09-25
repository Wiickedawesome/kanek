-- 00033: Enforce expired driver documents server-side.
--
-- Problem: 00031 added `trg_driver_docs_expired_restrict`, which only fires on
-- INSERT or UPDATE OF expiration_date on driver_documents. A document that
-- simply ages past its expiration_date is never re-checked, because no row is
-- touched. The mobile client tried to compensate by writing
-- profiles.account_status = 'restricted' from useOnboardingStatus, but that
-- column is protected by `enforce_protected_profile_columns` (00025/00028), so
-- the write was rejected with SQLSTATE 42501 and silently discarded (it was a
-- fire-and-forget `void`). Net effect: an expired driver kept full access.
--
-- Fix, in two parts:
--   1. public.enforce_expired_driver_documents() — authoritative, idempotent
--      sweep that restricts every account holding an expired document. It is
--      invoked by the `expire-posts` cron edge function through the service-role
--      client, which is what lets the protected-column guard through
--      (`current_setting('role') = 'service_role'`).
--   2. Make the 00031 row trigger non-fatal. It runs inside the caller's session
--      — an authenticated driver saving a document — where the protected-column
--      guard rejects the status change and aborts the entire INSERT. The sweep
--      above is authoritative, so a document save must never be blocked over it.
--
-- Down:
--   DROP FUNCTION IF EXISTS public.enforce_expired_driver_documents();
--   CREATE OR REPLACE FUNCTION public.restrict_profile_on_expired_driver_doc()
--     ... (restore the 00031 body, without the exception handler);

-- ---------------------------------------------------------------------------
-- 1. Authoritative sweep
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_expired_driver_documents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  restricted_count integer;
BEGIN
  WITH expired_profiles AS (
    SELECT DISTINCT d.profile_id AS id
      FROM public.driver_documents d
     WHERE d.expiration_date IS NOT NULL
       AND d.expiration_date < CURRENT_DATE
  ), restricted AS (
    UPDATE public.profiles p
       SET account_status = 'restricted'
     WHERE p.id IN (SELECT id FROM expired_profiles)
       AND p.account_status IN ('pending', 'active', 'dormant')
    RETURNING 1
  )
  SELECT count(*) INTO restricted_count FROM restricted;

  RETURN COALESCE(restricted_count, 0);
END;
$function$;

COMMENT ON FUNCTION public.enforce_expired_driver_documents() IS
  'Restricts accounts whose stored driver documents are past expiration_date. Intended for the periodic cron sweep (called by the expire-posts edge function with the service-role client). Idempotent; returns the number of accounts newly restricted.';

-- Server-side only: never callable by app users.
REVOKE ALL ON FUNCTION public.enforce_expired_driver_documents() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_expired_driver_documents() TO service_role, postgres;

-- ---------------------------------------------------------------------------
-- 2. Make the per-row trigger non-fatal
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restrict_profile_on_expired_driver_doc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expiration_date IS NOT NULL AND NEW.expiration_date < CURRENT_DATE THEN
    BEGIN
      UPDATE public.profiles
         SET account_status = 'restricted'
       WHERE id = NEW.profile_id
         AND account_status IN ('pending', 'active', 'dormant');
    EXCEPTION
      -- enforce_protected_profile_columns rejects account_status changes made
      -- outside an admin/service-role session (SQLSTATE 42501). Never let that
      -- abort the driver's document save; the sweep above applies the
      -- restriction on the next cron pass instead.
      WHEN insufficient_privilege THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.restrict_profile_on_expired_driver_doc() IS
  'Row-level companion to enforce_expired_driver_documents(): restricts the account when an expired document is inserted/updated. Deliberately swallows insufficient_privilege so a document save is never blocked by the protected-column guard (see 00033).';
