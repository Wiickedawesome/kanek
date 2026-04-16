-- Add set_initial_role RPC for onboarding.
-- Unlike switch_to_driver_role (which requires all docs approved),
-- this lets a new user declare their intended role during signup.
-- Driver docs are collected in subsequent onboarding steps.

CREATE OR REPLACE FUNCTION public.set_initial_role(p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_role NOT IN ('rider', 'driver') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  UPDATE public.profiles
  SET role = p_role::public.role, updated_at = now()
  WHERE id = auth.uid();
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.set_initial_role(text) TO authenticated;
