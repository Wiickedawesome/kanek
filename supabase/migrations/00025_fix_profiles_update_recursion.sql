-- 00025_fix_profiles_update_recursion.sql
--
-- Fix "infinite recursion detected in policy for relation profiles" at signup.
--
-- Root cause: migration 00023's profiles_update_own WITH CHECK re-reads the
-- same table (profiles) in six subselects (role, account_status, strikes_soft,
-- strikes_hard, rating_avg, punctuality_pct). Evaluating those subselects
-- re-invokes the SELECT policy (which calls is_admin(), which reads profiles
-- again) -> infinite recursion. The failing statement during signup is a plain
-- `UPDATE profiles SET first_name/last_name` in role-select.
--
-- Fix:
--   1. Simplify profiles_update_own to just "own row" (id = auth.uid()).
--   2. Enforce the protected columns via a BEFORE UPDATE trigger instead of
--      policy subselects — no same-table policy recursion.

DROP POLICY IF EXISTS "profiles_update_own" ON "public"."profiles";

CREATE POLICY "profiles_update_own" ON "public"."profiles"
FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

-- Trigger function: blocks non-admin changes to protected columns.
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
    -- SECURITY DEFINER means is_admin() reads bypass RLS; no recursion here.
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'protected profile columns are not editable'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_protected_columns ON public.profiles;
CREATE TRIGGER profiles_protected_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_protected_profile_columns();
