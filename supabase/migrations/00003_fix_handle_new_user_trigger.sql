-- Fix: Ensure the handle_new_user trigger exists on auth.users.
-- The trigger function was defined but never bound to auth.users in the initial schema dump.
-- Also adds a profiles INSERT policy so the client can auto-create a profile as a fallback.

-- 1. Re-create or replace the trigger function to handle both email and phone signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, email)
  VALUES (NEW.id, NEW.phone, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Create the trigger on auth.users (idempotent: drop if exists first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Allow authenticated users to insert their own profile row (fallback for missed triggers)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY "profiles_insert_own"
      ON public.profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (id = auth.uid());
  END IF;
END;
$$;

-- 4. Add switch_to_rider_role RPC (mirrors switch_to_driver_role but without doc checks)
CREATE OR REPLACE FUNCTION public.switch_to_rider_role(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot change another user''s role';
  END IF;

  UPDATE public.profiles
  SET role = 'rider', updated_at = now()
  WHERE id = p_user_id;
END;
$$;
