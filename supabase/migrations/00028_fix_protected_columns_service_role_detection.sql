-- 00028: Fix service_role detection inside enforce_protected_profile_columns.
--
-- Root cause: 00027's exemption (`current_user = 'service_role'`) never fires.
-- The trigger function is SECURITY DEFINER, so inside the trigger body
-- current_user is the function owner (postgres), not the connecting role.
-- PostgREST sets the per-request role in `current_setting('role')`, so use
-- that for the exemption instead.
--
-- Down: restore the 00027 version of the function.

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

    -- Allow trusted server code (admin-api edge function, cron functions).
    -- Inside a SECURITY DEFINER function current_user is masked by the
    -- function owner, so detect the session role instead of current_user.
    IF current_user = 'service_role'
       OR current_setting('role', true) = 'service_role' THEN
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
