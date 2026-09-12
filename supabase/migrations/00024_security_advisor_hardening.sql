-- 00024_security_advisor_hardening.sql
-- Addresses remaining Supabase Security Advisor warnings AND adds the
-- 'mark_flag_action_taken' enum value used by admin-api /moderation/review-flag
-- (kanek.bz) when an admin marks a report as "Action taken".
--
-- NOTE: this migration was previously applied out-of-band to the live DB but
-- never recorded in the migration ledger; statements are guarded so the
-- recorded replay is idempotent.
--
-- Fixes:
--   1. sync_driver_association_to_profile: mutable search_path
--   2. checkin-selfies bucket: restrict directory listing to contract parties only
--   3. All user-callable SECURITY DEFINER functions: set search_path to include pg_temp
--      (prevents temp-object hijacking; does NOT revoke EXECUTE since the app calls them via RPC)

-- ============================================================================
-- 1. FIX MUTABLE SEARCH_PATH ON TRIGGER FUNCTION
-- ============================================================================
-- The Security Advisor flags this function because it was created in migration
-- 00022 without an explicit search_path. Trigger functions run as the table
-- owner (postgres) with SECURITY DEFINER, so a mutable search_path allows a
-- malicious temp-schema object to shadow a real table.

ALTER FUNCTION public.sync_driver_association_to_profile()
  SET search_path = public, pg_temp;

-- ============================================================================
-- 2. TIGHTEN CHECKIN-SELFIES STORAGE BUCKET
-- ============================================================================
-- The "Public Bucket Allows Listing" warning fires because the SELECT policy
-- on checkin-selfies grants read to all authenticated users with no path
-- restriction. Check-in selfies should only be visible to the driver who took
-- them and to the other party in the contract (rider/poster).
--
-- We replace the broad policy with a scoped one: owner OR contract party.

DROP POLICY IF EXISTS "checkin_selfies_select_authenticated" ON storage.objects;

DO $merge$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'checkin_selfies_select_party'
  ) THEN
    CREATE POLICY "checkin_selfies_select_party" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'checkin-selfies'
      AND (
        -- Owner: the driver who uploaded the selfie
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        -- Contract party: the other user in the contract that this check-in belongs to
        OR EXISTS (
          SELECT 1 FROM public.driver_checkins dc
          JOIN public.contracts c ON c.id = dc.contract_id
          WHERE dc.selfie_url LIKE '%' || storage.filename(name) || '%'
            AND (SELECT auth.uid()) = ANY(c.parties)
        )
        -- Admin
        OR (SELECT public.is_admin())
      )
    );
  END IF;
END
$merge$;

-- ============================================================================
-- 3. HARDEN search_path ON ALL USER-CALLABLE SECURITY DEFINER FUNCTIONS
-- ============================================================================
-- The Security Advisor warns about SECURITY DEFINER functions callable by
-- authenticated users. We cannot revoke EXECUTE because the mobile app calls
-- these via supabase.rpc(). However, we CAN harden them by ensuring pg_temp
-- is in the search_path (prevents temp-object privilege escalation).
--
-- Functions that already have search_path=public, pg_temp (is_admin, is_active_account)
-- are skipped. Functions that only have search_path=public get pg_temp added.

ALTER FUNCTION public.accept_applicant(p_booking_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.accept_job_application(p_booking_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.cancel_route_short(p_post_id uuid, p_reason text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.check_driver_documents_complete(p_profile_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.check_user_availability(p_user_id uuid, p_at timestamptz, p_duration_min integer)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.confirm_recurring_route(p_post_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.proceed_route(p_post_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.process_ekyash_payment(p_order_id text, p_transaction_id text, p_callback_payload jsonb)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.reactivate_account()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.reject_applicant(p_booking_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.reject_job_application(p_booking_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.set_initial_role(p_role text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.switch_to_driver_role(p_user_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.switch_to_rider_role(p_user_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.verify_gas_price(price_id uuid)
  SET search_path = public, pg_temp;

-- Also harden trigger/internal functions that still only had search_path=public
ALTER FUNCTION public._admin_check(p_admin_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.accumulate_donation()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.compute_rating_avg(p_user_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.enforce_phone_change_rate_limit()
  SET search_path = public, pg_temp;

-- ============================================================================
-- 4. ADD MISSING ENUM VALUE FOR FLAG "ACTION TAKEN" AUDIT LOG
-- ============================================================================
-- admin-api (kanek.bz) inserts action = 'mark_flag_action_taken' when an admin
-- marks a report as "Action taken". The enum lacked this value, so the insert
-- failed and the whole admin action errored out.

ALTER TYPE public.admin_action_type ADD VALUE IF NOT EXISTS 'mark_flag_action_taken';

ALTER FUNCTION public.handle_booking_status_change()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.handle_new_booking_after()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.handle_new_booking_before()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.handle_new_user()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.handle_post_status_change()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.increment_strike_counter()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.notify_contract_event()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.notify_on_new_message()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.notify_on_post_deleted()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.recalculate_rating()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.admin_moderate_flag(p_flag_id uuid, p_action text, p_reason text, p_admin_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.admin_review_driver(p_driver_id uuid, p_action text, p_reason text, p_admin_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.admin_review_rider_doc(p_doc_id uuid, p_action text, p_reason text, p_admin_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.admin_user_action(p_user_id uuid, p_action text, p_reason text, p_admin_id uuid)
  SET search_path = public, pg_temp;
