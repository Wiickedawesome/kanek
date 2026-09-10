-- Migration 00019: Audit Remediation
-- Fixes security definer views, duplicate indexes, storage policies, and public function execution grants.

-- 1. Fix Security Definer Views (ERROR in Supabase linter)
-- Set security_invoker = true so views enforce RLS of the querying user.
ALTER VIEW "public"."profiles_public" SET (security_invoker = true);
ALTER VIEW "public"."ratings_public" SET (security_invoker = true);

-- 2. Drop 11 Duplicate Indexes
DROP INDEX IF EXISTS "public"."idx_bookings_user";
DROP INDEX IF EXISTS "public"."idx_driver_checkins_contract";
DROP INDEX IF EXISTS "public"."idx_driver_documents_profile";
DROP INDEX IF EXISTS "public"."idx_ekyash_contract";
DROP INDEX IF EXISTS "public"."idx_ekyash_order";
DROP INDEX IF EXISTS "public"."idx_posts_author";
DROP INDEX IF EXISTS "public"."idx_posts_created";
DROP INDEX IF EXISTS "public"."idx_ratings_contract";
DROP INDEX IF EXISTS "public"."idx_ratings_rated";
DROP INDEX IF EXISTS "public"."idx_road_reports_expires";
DROP INDEX IF EXISTS "public"."idx_strikes_user";

-- 3. Fix checkin-selfies Storage Bucket & Policies
-- Make bucket public so getPublicUrl() works for active trip participants, and add upload policy for drivers.
UPDATE storage.buckets SET public = true WHERE id = 'checkin-selfies';

DROP POLICY IF EXISTS "checkin_selfies_insert_driver" ON storage.objects;
CREATE POLICY "checkin_selfies_insert_driver"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'checkin-selfies' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

DROP POLICY IF EXISTS "checkin_selfies_select_authenticated" ON storage.objects;
CREATE POLICY "checkin_selfies_select_authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'checkin-selfies'
);

-- 4. Clean up legacy malformed document URLs (strip .blob:http suffix)
UPDATE "public"."driver_documents"
SET "document_url" = regexp_replace("document_url", '\.blob:http.*$', '.jpg')
WHERE "document_url" LIKE '%.blob:http%';

UPDATE "public"."driver_details"
SET "id_document_url" = regexp_replace("id_document_url", '\.blob:http.*$', '.jpg')
WHERE "id_document_url" LIKE '%.blob:http%';

-- 5. Revoke default PUBLIC / anon execution on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public._admin_check(p_admin_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_applicant(p_booking_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_job_application(p_booking_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accumulate_donation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_moderate_flag(p_flag_id uuid, p_action text, p_reason text, p_admin_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_driver(p_driver_id uuid, p_action text, p_reason text, p_admin_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_rider_doc(p_doc_id uuid, p_action text, p_reason text, p_admin_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_user_action(p_user_id uuid, p_action text, p_reason text, p_admin_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_route_short(p_post_id uuid, p_reason text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_driver_documents_complete(p_profile_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_user_availability(p_user_id uuid, p_at timestamp with time zone, p_duration_min integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.compute_rating_avg(p_user_id uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_recurring_route(p_post_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_phone_change_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_booking_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_booking_after() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_booking_before() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_post_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_strike_counter() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_active_account() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_contract_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_new_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_post_deleted() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.proceed_route(p_post_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_ekyash_payment(p_order_id text, p_transaction_id text, p_callback_payload jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reactivate_account() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_applicant(p_booking_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_job_application(p_booking_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.report_road_report_gone(report_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_initial_role(p_role text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.switch_to_driver_role(p_user_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.switch_to_rider_role(p_user_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upvote_road_report(report_id uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_gas_price(price_id uuid) FROM PUBLIC, anon;

-- Ensure authenticated role can execute user-facing RPCs
GRANT EXECUTE ON FUNCTION public.accept_applicant(p_booking_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_job_application(p_booking_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_route_short(p_post_id uuid, p_reason text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_availability(p_user_id uuid, p_at timestamp with time zone, p_duration_min integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_recurring_route(p_post_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.proceed_route(p_post_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_applicant(p_booking_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_job_application(p_booking_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_road_report_gone(report_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_initial_role(p_role text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.switch_to_driver_role(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.switch_to_rider_role(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upvote_road_report(report_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_gas_price(price_id uuid) TO authenticated;
