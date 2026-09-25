-- 00032: Restore cross-user reads on public.profiles_public.
--
-- Root cause: 00019 (audit remediation) set `security_invoker = true` on
-- public.profiles_public. With invoker semantics the base table's RLS applies,
-- and the only SELECT policy on public.profiles is `profiles_select_own`
-- (own row OR admin — 00023 §13). Every cross-user join therefore returned no
-- row, so author/driver/rider names, avatars, ratings and taxi badges came back
-- null in postsApi, bookingsApi, contractEventsApi, messagesApi and
-- profilesApi.getPublicProfile.
--
-- Fix: this view exists precisely to publish a column-whitelisted projection of
-- profiles, so it must resolve rows as its owner (the pre-00019 behaviour).
--
-- Trade-offs and guard rails:
--   * The column whitelist below IS the security boundary. Never add phone,
--     email, push_token, emergency_contact, strikes_soft, strikes_hard, or
--     address_line to it.
--   * `address_line` is dropped: no caller selects it and it is
--     location-revealing. (PostgreSQL cannot drop a column with CREATE OR
--     REPLACE VIEW, hence DROP + CREATE. No other object depends on this view.)
--   * Do NOT "fix" this by granting SELECT on public.profiles itself — RLS is
--     row-level only, so any permissive policy there exposes every column
--     (phone, email, push_token) for every row.
--   * anon loses access. The mobile app and the admin backend are always
--     authenticated; anonymous profile reads are not a requirement.
--   * Supabase's linter reports `security_definer_view` against this view.
--     That is expected and accepted here; the whitelist is the control.
--
-- Down:
--   DROP VIEW IF EXISTS public.profiles_public;
--   CREATE VIEW public.profiles_public AS SELECT ... (00022 definition);
--   ALTER VIEW public.profiles_public SET (security_invoker = true);
--   GRANT ALL ON TABLE public.profiles_public TO anon, authenticated, service_role;

DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public AS
  SELECT id,
    first_name,
    last_name,
    avatar_url,
    role,
    account_status,
    rating_avg,
    punctuality_pct,
    district,
    last_active_at,
    created_at,
    taxi_association_name,
    taxi_association_verified
  FROM public.profiles;

-- Rows resolve as the view owner, not as the caller, so joins from other users'
-- rows work. Replaces 00019's `security_invoker = true`.
ALTER VIEW public.profiles_public SET (security_invoker = false);

-- Signed-in users only.
REVOKE ALL ON TABLE public.profiles_public FROM anon;
GRANT SELECT ON TABLE public.profiles_public TO authenticated, service_role;

COMMENT ON VIEW public.profiles_public IS
  'Public projection of profiles. The column whitelist is the security boundary — never add phone, email, push_token, emergency_contact, strikes_*, or address_line. Reads resolve as the view owner so cross-user joins work (see 00032).';
