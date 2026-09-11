-- 00023_optimize_rls_initplan_and_security.sql
-- Optimizes RLS policies to use (SELECT auth.uid()) InitPlans instead of per-row evaluation.
-- Consolidates duplicate permissive policies and hardens SECURITY DEFINER function permissions.

-- ============================================================================
-- 1. CONTRACT MESSAGES
-- ============================================================================
DROP POLICY IF EXISTS "Contract parties can read messages" ON "public"."contract_messages";
CREATE POLICY "Contract parties can read messages" ON "public"."contract_messages"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "public"."contracts" c
    WHERE c.id = contract_messages.contract_id
      AND (SELECT auth.uid()) = ANY (c.parties)
  )
);

DROP POLICY IF EXISTS "contract_messages_insert" ON "public"."contract_messages";
CREATE POLICY "contract_messages_insert" ON "public"."contract_messages"
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND (SELECT is_active_account())
  AND EXISTS (
    SELECT 1 FROM "public"."contracts" c
    WHERE c.id = contract_messages.contract_id
      AND (SELECT auth.uid()) = ANY (c.parties)
  )
);

-- ============================================================================
-- 2. CONTRACT EVENTS
-- ============================================================================
DROP POLICY IF EXISTS "Parties can insert own events" ON "public"."contract_events";
CREATE POLICY "Parties can insert own events" ON "public"."contract_events"
FOR INSERT TO authenticated
WITH CHECK (
  actor_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM "public"."contracts" c
    WHERE c.id = contract_events.contract_id
      AND (SELECT auth.uid()) = ANY (c.parties)
  )
);

DROP POLICY IF EXISTS "Parties can view contract events" ON "public"."contract_events";
CREATE POLICY "Parties can view contract events" ON "public"."contract_events"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "public"."contracts" c
    WHERE c.id = contract_events.contract_id
      AND (SELECT auth.uid()) = ANY (c.parties)
  )
);

-- ============================================================================
-- 3. CONTRACTS
-- ============================================================================
DROP POLICY IF EXISTS "contracts_select_party" ON "public"."contracts";
CREATE POLICY "contracts_select_party" ON "public"."contracts"
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = ANY (parties));

-- ============================================================================
-- 4. BOOKINGS
-- ============================================================================
DROP POLICY IF EXISTS "bookings_insert_active_only" ON "public"."bookings";
CREATE POLICY "bookings_insert_active_only" ON "public"."bookings"
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND (SELECT is_active_account())
);

DROP POLICY IF EXISTS "bookings_select_involved" ON "public"."bookings";
CREATE POLICY "bookings_select_involved" ON "public"."bookings"
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM "public"."posts" p
    WHERE p.id = bookings.post_id
      AND p.author_id = (SELECT auth.uid())
  )
);

-- Consolidate duplicate permissive UPDATE policies into a single policy
DROP POLICY IF EXISTS "bookings_update_author" ON "public"."bookings";
DROP POLICY IF EXISTS "bookings_update_own" ON "public"."bookings";
CREATE POLICY "bookings_update" ON "public"."bookings"
FOR UPDATE TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM "public"."posts" p
    WHERE p.id = bookings.post_id
      AND p.author_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM "public"."posts" p
    WHERE p.id = bookings.post_id
      AND p.author_id = (SELECT auth.uid())
  ))
  OR (user_id = (SELECT auth.uid()) AND status = ANY (ARRAY['cancelled'::"public"."booking_status", 'completed'::"public"."booking_status"]))
);

-- ============================================================================
-- 5. DRIVER DETAILS
-- ============================================================================
DROP POLICY IF EXISTS "driver_details_insert_own" ON "public"."driver_details";
CREATE POLICY "driver_details_insert_own" ON "public"."driver_details"
FOR INSERT TO authenticated
WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "driver_details_select_own_or_admin" ON "public"."driver_details";
CREATE POLICY "driver_details_select_own_or_admin" ON "public"."driver_details"
FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) OR (SELECT is_admin()));

DROP POLICY IF EXISTS "driver_details_update_own" ON "public"."driver_details";
CREATE POLICY "driver_details_update_own" ON "public"."driver_details"
FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

-- ============================================================================
-- 6. DRIVER DOCUMENTS (Consolidate multiple permissive policies)
-- ============================================================================
DROP POLICY IF EXISTS "driver_documents_insert" ON "public"."driver_documents";
CREATE POLICY "driver_documents_insert" ON "public"."driver_documents"
FOR INSERT TO authenticated
WITH CHECK (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "driver_documents_select" ON "public"."driver_documents";
DROP POLICY IF EXISTS "driver_documents_admin_select" ON "public"."driver_documents";
CREATE POLICY "driver_documents_select" ON "public"."driver_documents"
FOR SELECT TO authenticated
USING (profile_id = (SELECT auth.uid()) OR (SELECT is_admin()));

DROP POLICY IF EXISTS "driver_documents_update" ON "public"."driver_documents";
DROP POLICY IF EXISTS "driver_documents_admin_update" ON "public"."driver_documents";
CREATE POLICY "driver_documents_update" ON "public"."driver_documents"
FOR UPDATE TO authenticated
USING (profile_id = (SELECT auth.uid()) OR (SELECT is_admin()))
WITH CHECK ((SELECT is_admin()) OR review_status = 'pending'::"public"."review_status");

-- ============================================================================
-- 7. DRIVER CHECKINS
-- ============================================================================
DROP POLICY IF EXISTS "drivers_insert_own_checkins" ON "public"."driver_checkins";
CREATE POLICY "drivers_insert_own_checkins" ON "public"."driver_checkins"
FOR INSERT TO authenticated
WITH CHECK (driver_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "contract_parties_view_checkins" ON "public"."driver_checkins";
CREATE POLICY "contract_parties_view_checkins" ON "public"."driver_checkins"
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "public"."contracts" c
    WHERE c.id = driver_checkins.contract_id
      AND (SELECT auth.uid()) = ANY (c.parties)
  )
);

-- ============================================================================
-- 8. EMAIL RECEIPTS & E-KYASH TRANSACTIONS
-- ============================================================================
DROP POLICY IF EXISTS "email_receipts_select_own" ON "public"."email_receipts";
CREATE POLICY "email_receipts_select_own" ON "public"."email_receipts"
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "ekyash_select_involved" ON "public"."ekyash_transactions";
CREATE POLICY "ekyash_select_involved" ON "public"."ekyash_transactions"
FOR SELECT TO authenticated
USING (payer_id = (SELECT auth.uid()) OR payee_id = (SELECT auth.uid()));

-- ============================================================================
-- 9. FLAGS
-- ============================================================================
DROP POLICY IF EXISTS "flags_insert_authenticated" ON "public"."flags";
CREATE POLICY "flags_insert_authenticated" ON "public"."flags"
FOR INSERT TO authenticated
WITH CHECK (reporter_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "flags_select_admin" ON "public"."flags";
CREATE POLICY "flags_select_admin" ON "public"."flags"
FOR SELECT TO authenticated
USING ((SELECT is_admin()));

DROP POLICY IF EXISTS "flags_update_admin" ON "public"."flags";
CREATE POLICY "flags_update_admin" ON "public"."flags"
FOR UPDATE TO authenticated
USING ((SELECT is_admin()));

-- ============================================================================
-- 10. GAS PRICES & VERIFICATIONS
-- ============================================================================
DROP POLICY IF EXISTS "gas_price_verifications_insert_own" ON "public"."gas_price_verifications";
CREATE POLICY "gas_price_verifications_insert_own" ON "public"."gas_price_verifications"
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "gas_price_verifications_select_own" ON "public"."gas_price_verifications";
CREATE POLICY "gas_price_verifications_select_own" ON "public"."gas_price_verifications"
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "gas_prices_insert_authenticated" ON "public"."gas_prices";
CREATE POLICY "gas_prices_insert_authenticated" ON "public"."gas_prices"
FOR INSERT TO authenticated
WITH CHECK (reporter_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "gas_prices_update_owner" ON "public"."gas_prices";
CREATE POLICY "gas_prices_update_owner" ON "public"."gas_prices"
FOR UPDATE TO authenticated
USING (reporter_id = (SELECT auth.uid()))
WITH CHECK (reporter_id = (SELECT auth.uid()));

-- ============================================================================
-- 11. NOTIFICATIONS
-- ============================================================================
DROP POLICY IF EXISTS "notifications_select_own" ON "public"."notifications";
CREATE POLICY "notifications_select_own" ON "public"."notifications"
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "notifications_update_own" ON "public"."notifications";
CREATE POLICY "notifications_update_own" ON "public"."notifications"
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- 12. POSTS
-- ============================================================================
DROP POLICY IF EXISTS "posts_delete_author" ON "public"."posts";
CREATE POLICY "posts_delete_author" ON "public"."posts"
FOR DELETE TO authenticated
USING (author_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "posts_insert_active_only" ON "public"."posts";
CREATE POLICY "posts_insert_active_only" ON "public"."posts"
FOR INSERT TO authenticated
WITH CHECK (
  author_id = (SELECT auth.uid())
  AND (SELECT is_active_account())
);

DROP POLICY IF EXISTS "posts_update_author" ON "public"."posts";
CREATE POLICY "posts_update_author" ON "public"."posts"
FOR UPDATE TO authenticated
USING (author_id = (SELECT auth.uid()))
WITH CHECK (
  author_id = (SELECT auth.uid())
  AND (NOT (seats_filled IS DISTINCT FROM (SELECT p.seats_filled FROM "public"."posts" p WHERE p.id = posts.id)))
  AND (NOT (status = 'activated'::"public"."post_status" AND (SELECT p.status FROM "public"."posts" p WHERE p.id = posts.id) <> 'activated'::"public"."post_status"))
  AND (NOT (status = 'open'::"public"."post_status" AND (SELECT p.status FROM "public"."posts" p WHERE p.id = posts.id) = ANY (ARRAY['expired'::"public"."post_status", 'completed'::"public"."post_status"])))
);

-- ============================================================================
-- 13. PROFILES
-- ============================================================================
DROP POLICY IF EXISTS "profiles_insert_own" ON "public"."profiles";
CREATE POLICY "profiles_insert_own" ON "public"."profiles"
FOR INSERT TO authenticated
WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "profiles_select_own" ON "public"."profiles";
CREATE POLICY "profiles_select_own" ON "public"."profiles"
FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) OR (SELECT is_admin()));

DROP POLICY IF EXISTS "profiles_update_own" ON "public"."profiles";
CREATE POLICY "profiles_update_own" ON "public"."profiles"
FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (
  id = (SELECT auth.uid())
  AND (NOT (role IS DISTINCT FROM (SELECT p.role FROM "public"."profiles" p WHERE p.id = (SELECT auth.uid()))))
  AND (NOT (account_status IS DISTINCT FROM (SELECT p.account_status FROM "public"."profiles" p WHERE p.id = (SELECT auth.uid()))))
  AND (NOT (strikes_soft IS DISTINCT FROM (SELECT p.strikes_soft FROM "public"."profiles" p WHERE p.id = (SELECT auth.uid()))))
  AND (NOT (strikes_hard IS DISTINCT FROM (SELECT p.strikes_hard FROM "public"."profiles" p WHERE p.id = (SELECT auth.uid()))))
  AND (NOT (rating_avg IS DISTINCT FROM (SELECT p.rating_avg FROM "public"."profiles" p WHERE p.id = (SELECT auth.uid()))))
  AND (NOT (punctuality_pct IS DISTINCT FROM (SELECT p.punctuality_pct FROM "public"."profiles" p WHERE p.id = (SELECT auth.uid()))))
);

-- ============================================================================
-- 14. RATINGS
-- ============================================================================
DROP POLICY IF EXISTS "ratings_insert_party" ON "public"."ratings";
CREATE POLICY "ratings_insert_party" ON "public"."ratings"
FOR INSERT TO authenticated
WITH CHECK (
  rater_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM "public"."contracts" c
    WHERE c.id = ratings.contract_id
      AND (SELECT auth.uid()) = ANY (c.parties)
  )
);

DROP POLICY IF EXISTS "ratings_select_party" ON "public"."ratings";
CREATE POLICY "ratings_select_party" ON "public"."ratings"
FOR SELECT TO authenticated
USING (
  rater_id = (SELECT auth.uid())
  OR rated_id = (SELECT auth.uid())
  OR (SELECT is_admin())
);

-- ============================================================================
-- 15. RIDER DOCUMENTS & STRIKES & ADMIN ACTIONS
-- ============================================================================
DROP POLICY IF EXISTS "rider_documents_insert_own" ON "public"."rider_documents";
CREATE POLICY "rider_documents_insert_own" ON "public"."rider_documents"
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "rider_documents_select_own_or_admin" ON "public"."rider_documents";
CREATE POLICY "rider_documents_select_own_or_admin" ON "public"."rider_documents"
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT is_admin()));

DROP POLICY IF EXISTS "strikes_select_own" ON "public"."strikes";
CREATE POLICY "strikes_select_own" ON "public"."strikes"
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT is_admin()));

DROP POLICY IF EXISTS "admin_actions_select_admin" ON "public"."admin_actions";
CREATE POLICY "admin_actions_select_admin" ON "public"."admin_actions"
FOR SELECT TO authenticated
USING ((SELECT is_admin()));

-- ============================================================================
-- 16. TAXI ASSOCIATIONS
-- ============================================================================
DROP POLICY IF EXISTS "taxi_associations_admin" ON "public"."taxi_associations";
CREATE POLICY "taxi_associations_admin" ON "public"."taxi_associations"
FOR ALL TO authenticated
USING ((SELECT is_admin()))
WITH CHECK ((SELECT is_admin()));

-- ============================================================================
-- 17. SECURITY ADVISOR HARDENING
-- ============================================================================
-- Set search_path on key security helper functions
ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_active_account() SET search_path = public, pg_temp;

-- Revoke execute from public/anon on internal security definer admin functions
REVOKE EXECUTE ON FUNCTION public._admin_check(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_moderate_flag(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_review_driver(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_review_rider_doc(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_user_action(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._admin_check(uuid) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.admin_moderate_flag(uuid, text, text, uuid) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.admin_review_driver(uuid, text, text, uuid) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.admin_review_rider_doc(uuid, text, text, uuid) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.admin_user_action(uuid, text, text, uuid) TO service_role, postgres;
