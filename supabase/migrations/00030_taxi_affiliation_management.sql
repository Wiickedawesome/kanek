-- 00030_taxi_affiliation_management.sql
-- Lets drivers manage their taxi affiliation after onboarding:
--  - set / switch association (clears verification so admin re-reviews)
--  - remove affiliation entirely
-- Switching or removing MUST invalidate the taxi_association_verified badge;
-- otherwise drivers could swap associations and keep a stale verified badge.

CREATE OR REPLACE FUNCTION public.update_taxi_association(
  p_association_name TEXT,        -- NULL = remove affiliation
  p_association_id UUID DEFAULT NULL,
  p_member_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only drivers can hold an affiliation
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = v_user AND profiles.role = 'driver'
  ) THEN
    RAISE EXCEPTION 'Only drivers can manage a taxi affiliation';
  END IF;

  -- If naming an association, resolve/verify the id against the directory
  IF p_association_name IS NOT NULL THEN
    IF p_association_id IS NULL THEN
      SELECT id INTO p_association_id
      FROM public.taxi_associations
      WHERE name = p_association_name AND is_active = true;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.taxi_associations
      WHERE id = p_association_id AND name = p_association_name AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Association id and name do not match the directory';
    END IF;

    -- Custom/free-text associations are allowed (as in onboarding) but have no directory id
    IF p_association_id IS NULL AND NOT EXISTS (
      SELECT 1 FROM public.taxi_associations WHERE name = p_association_name
    ) THEN
      NULL; -- custom association: keep id null
    END IF;
  END IF;

  -- Upsert driver_details affiliation; verification resets on any change
  INSERT INTO public.driver_details AS dd (id, taxi_association_id, taxi_association_name, taxi_association_member_id,
                                            taxi_association_verified, taxi_association_verified_at, taxi_association_verified_by)
  VALUES (v_user, p_association_id, p_association_name, p_association_member_id, false, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET
    taxi_association_id = EXCLUDED.taxi_association_id,
    taxi_association_name = EXCLUDED.taxi_association_name,
    taxi_association_member_id = EXCLUDED.taxi_association_member_id,
    taxi_association_verified = false,
    taxi_association_verified_at = NULL,
    taxi_association_verified_by = NULL,
    updated_at = now();

  -- Keep profiles badge columns in sync (same semantics as the 00022 trigger)
  UPDATE public.profiles
  SET taxi_association_name = p_association_name,
      taxi_association_verified = false,
      updated_at = now()
  WHERE id = v_user;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_taxi_association FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_taxi_association TO authenticated;

-- Down (run manually if rollback needed):
-- DROP FUNCTION IF EXISTS public.update_taxi_association(TEXT, UUID, TEXT);
