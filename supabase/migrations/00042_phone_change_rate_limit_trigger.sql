-- Migration: 00042_phone_change_rate_limit_trigger
-- Fix H-3: Enforce the 30-day phone-change rate limit at the database level.
-- A BEFORE UPDATE trigger on profiles.phone_changed_at raises an exception when
-- the column is updated within 30 days of its previous non-null value.
-- This prevents the client-side bypass via direct supabase.auth.updateUser() calls.

CREATE OR REPLACE FUNCTION enforce_phone_change_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when phone_changed_at is actually being set to a new non-null value
  IF NEW.phone_changed_at IS NOT NULL
     AND OLD.phone_changed_at IS NOT NULL
     AND NEW.phone_changed_at IS DISTINCT FROM OLD.phone_changed_at
  THEN
    IF OLD.phone_changed_at > (NOW() - INTERVAL '30 days') THEN
      RAISE EXCEPTION
        'Phone number can only be changed once every 30 days. Next allowed change: %',
        (OLD.phone_changed_at + INTERVAL '30 days')::date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_phone_change_rate_limit ON profiles;

CREATE TRIGGER enforce_phone_change_rate_limit
  BEFORE UPDATE OF phone_changed_at ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_phone_change_rate_limit();
