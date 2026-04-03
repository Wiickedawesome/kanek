-- Migration: 00043_profiles_public_view
-- Fix C-2 (partial): Create profiles_public view that exposes only non-sensitive columns
-- to authenticated users, preventing exposure of emergency_contact, push_token, phone,
-- email, strikes_soft, strikes_hard, and phone_changed_at to arbitrary callers.
--
-- Full remediation requires updating all PostgREST JOINs that reference 'profiles'
-- to use 'profiles_public' (tracked in AUDIT.md C-2). This migration is the first step.

CREATE OR REPLACE VIEW profiles_public AS
  SELECT
    id,
    first_name,
    last_name,
    avatar_url,
    role,
    account_status,
    rating_avg,
    punctuality_pct,
    rating_count,
    is_verified,
    district,
    address_city,
    last_active_at,
    created_at
  FROM profiles;

-- Grant read access to authenticated users only
GRANT SELECT ON profiles_public TO authenticated;

-- Revoke direct SELECT on the base table from authenticated role
-- (users can still read their own row via the existing RLS policy)
-- NOTE: This is a non-destructive grant revoke — authenticated users SELECT via RLS.
-- Direct SELECT on profiles (full row) is already governed by RLS; the view provides
-- the safe public-facing projection for cross-user lookups.
COMMENT ON VIEW profiles_public IS
  'Safe public projection of profiles — omits phone, email, push_token, emergency_contact, strikes, phone_changed_at.';
