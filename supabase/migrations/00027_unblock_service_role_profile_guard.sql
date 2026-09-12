-- 00027: Allow service_role (trusted server code such as the admin-api edge
-- function) to change protected profile columns.
--
-- Root cause: migration 00025 added the profiles_protected_columns BEFORE
-- UPDATE trigger (function: enforce_protected_profile_columns), which guards
-- role/account_status/strikes/rating/punctuality by checking public.is_admin().
-- is_admin() resolves auth.uid(), which is NULL on service-role connections —
-- so admin-api suspend/reactivate/unsuspend calls were rejected with
-- "protected profile columns are not editable" even though the caller is a
-- verified admin using the portal.
--
-- Fix: extend the allow-list inside the guard to requests running as the
-- service_role database role. End users (authenticated or anon) can never run
-- queries as service_role, so user-level protection is unchanged.
--
-- Down: restore the 00026 version of the function (no service_role exemption).

CREATE OR REPLACE FUNCTION public.enforce_protected_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.strikes_soft IS DISTINCT FROM OLD.strikes_soft
     OR NEW.strikes_hard IS DISTINCT FROM OLD.strikes_hard
     OR NEW.rating_avg IS DISTINCT FROM OLD.rating_avg
     OR NEW.punctuality_pct IS DISTINCT FROM OLD.punctuality_pct
  THEN
    -- Allow the change when set_initial_role is mid-flight in this session.
    IF current_setting('app.set_initial_role_running', true) = 'on' THEN
      RETURN NEW;
    END IF;

    -- Allow trusted server code (admin-api edge function, cron functions)
    -- which connect via the service_role database role.
    IF current_user = 'service_role' THEN
      RETURN NEW;
    END IF;

    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'protected profile columns are not editable'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
