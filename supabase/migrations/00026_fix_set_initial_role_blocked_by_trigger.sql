-- 00026_fix_set_initial_role_blocked_by_trigger.sql
--
-- Bug: migration 00025's profiles_protected_columns BEFORE UPDATE trigger
-- blocks ALL changes to profiles.role, including the legitimate onboarding
-- path: set_initial_role() RPC (SECURITY DEFINER) called by a brand-new user.
-- The trigger's is_admin() check is false for the new user, so the RPC raises
-- 'protected profile columns are not editable' → app shows "Could not set role"
-- and onboarding breaks at role-select.
--
-- Fix: set_initial_role sets a session flag around its UPDATE; the trigger
-- skips protected-column enforcement while that flag is set. The flag is
-- session-local (set_config ... , false), and the trigger only honors it when
-- the current session is already inside the SECURITY DEFINER function.

-- 1. Rebuild the trigger function with the flag exemption.
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
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'protected profile columns are not editable'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Rebuild set_initial_role to raise the flag around the UPDATE.
CREATE OR REPLACE FUNCTION public.set_initial_role(p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_role NOT IN ('rider', 'driver') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  PERFORM set_config('app.set_initial_role_running', 'on', false);
  UPDATE public.profiles
  SET role = p_role::public.role, updated_at = now()
  WHERE id = auth.uid();
  PERFORM set_config('app.set_initial_role_running', 'off', false);
END;
$function$;
