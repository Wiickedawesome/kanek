-- =============================================================================
-- Migration: Admin Studio Migration
-- Purpose: Replace Next.js admin panel with SQL views (for Studio Table Editor)
--          and SQL functions (for Studio SQL Editor).
--
-- After this migration, all admin operations are performed via Supabase Studio:
--   - READ:  Browse admin_* views in Table Editor
--   - WRITE: Call admin_* functions in SQL Editor
--   - AUTH:  Create users in Studio Auth > Users panel
--   - FILES: Browse documents in Studio Storage browser
--
-- Usage example (SQL Editor):
--   SELECT admin_review_driver('driver-uuid', 'approve', NULL, 'your-admin-uuid');
--   SELECT admin_moderate_flag('flag-uuid', 'dismiss', 'Not actionable', 'your-admin-uuid');
-- =============================================================================

-- =============================================================================
-- 1. ENUM FIX: Add missing 'invite_admin' to admin_action_type
--    (admin invite route uses this value but it was never in the enum)
--    Note: ALTER TYPE ADD VALUE works in transactions from PG 12+.
--    The new value is not referenced in this migration, so no visibility issue.
-- =============================================================================
ALTER TYPE public.admin_action_type ADD VALUE IF NOT EXISTS 'invite_admin';

-- =============================================================================
-- 2. VIEWS: Admin read-only views for Studio Table Editor
-- =============================================================================

-- 2a. Dashboard stats — single-row summary
--     Replaces: admin/app/(admin)/page.tsx (6 count queries)
CREATE OR REPLACE VIEW public.admin_dashboard_stats AS
SELECT
  (SELECT count(*) FROM public.profiles)::int AS total_users,
  (SELECT count(*) FROM public.driver_details WHERE review_status = 'pending')::int AS pending_drivers,
  (SELECT count(*) FROM public.rider_documents WHERE review_status = 'pending')::int AS pending_rider_docs,
  (SELECT count(*) FROM public.flags WHERE status = 'pending')::int AS pending_flags,
  (SELECT count(*) FROM public.posts WHERE status IN ('open', 'activated', 'in_progress'))::int AS active_posts,
  (SELECT count(*) FROM public.contracts WHERE status = 'completed')::int AS completed_contracts;

COMMENT ON VIEW public.admin_dashboard_stats IS
  'Single-row admin dashboard summary. Usage: SELECT * FROM admin_dashboard_stats;';


-- 2b. Drivers list — driver applications with profile info
--     Replaces: admin/app/(admin)/drivers/page.tsx
CREATE OR REPLACE VIEW public.admin_drivers_list AS
SELECT
  dd.id,
  dd.review_status,
  dd.verified,
  dd.verified_at,
  dd.vehicle_make,
  dd.vehicle_model,
  dd.vehicle_year,
  dd.vehicle_color,
  dd.vehicle_plate,
  dd.rejection_reason,
  p.first_name,
  p.last_name,
  p.phone,
  p.account_status,
  p.created_at
FROM public.driver_details dd
JOIN public.profiles p ON p.id = dd.id
ORDER BY
  CASE dd.review_status
    WHEN 'pending'  THEN 0
    WHEN 'rejected' THEN 1
    WHEN 'approved' THEN 2
  END,
  p.created_at DESC;

COMMENT ON VIEW public.admin_drivers_list IS
  'Driver applications with profile info, sorted pending-first. Use Studio Storage browser to view document files (license_url, insurance_url, id_document_url paths from driver_details table).';


-- 2c. Rider documents list — ID document review queue
--     Replaces: admin/app/(admin)/riders/page.tsx
CREATE OR REPLACE VIEW public.admin_rider_docs_list AS
SELECT
  rd.id,
  rd.user_id,
  rd.document_url,
  rd.review_status,
  rd.verified,
  rd.rejection_reason,
  rd.uploaded_at,
  p.first_name,
  p.last_name,
  p.phone,
  p.account_status
FROM public.rider_documents rd
JOIN public.profiles p ON p.id = rd.user_id
ORDER BY
  CASE rd.review_status
    WHEN 'pending'  THEN 0
    WHEN 'rejected' THEN 1
    WHEN 'approved' THEN 2
  END,
  rd.uploaded_at DESC;

COMMENT ON VIEW public.admin_rider_docs_list IS
  'Rider ID documents with user info, sorted pending-first. Use Studio Storage browser to view document files.';


-- 2d. Flags list — moderation queue
--     Replaces: admin/app/(admin)/flags/page.tsx
CREATE OR REPLACE VIEW public.admin_flags_list AS
SELECT
  f.id,
  f.target_type,
  f.target_id,
  f.reason,
  f.description,
  f.status,
  f.reviewed_at,
  f.created_at,
  rp.first_name AS reporter_first_name,
  rp.last_name AS reporter_last_name
FROM public.flags f
LEFT JOIN public.profiles rp ON rp.id = f.reporter_id
ORDER BY
  CASE f.status
    WHEN 'pending'      THEN 0
    WHEN 'reviewed'     THEN 1
    WHEN 'action_taken' THEN 2
    WHEN 'dismissed'    THEN 3
  END,
  f.created_at DESC;

COMMENT ON VIEW public.admin_flags_list IS
  'Community flags with reporter info, sorted pending-first.';


-- 2e. Flag detail — flag with reporter + polymorphic target info
--     Replaces: admin/app/(admin)/flags/[id]/page.tsx
CREATE OR REPLACE VIEW public.admin_flag_detail AS
SELECT
  f.id,
  f.reporter_id,
  f.target_type,
  f.target_id,
  f.reason,
  f.description,
  f.status,
  f.reviewed_by,
  f.reviewed_at,
  f.created_at,
  -- Reporter info
  rp.first_name AS reporter_first_name,
  rp.last_name  AS reporter_last_name,
  -- Target post info (NULL when target is not a post)
  tp.title              AS target_post_title,
  tp.type               AS target_post_type,
  tp.status             AS target_post_status,
  tap.id                AS target_post_author_id,
  tap.first_name        AS target_post_author_first_name,
  tap.last_name         AS target_post_author_last_name,
  -- Target user info (NULL when target is not a user)
  tu.first_name         AS target_user_first_name,
  tu.last_name          AS target_user_last_name,
  tu.account_status     AS target_user_account_status,
  tu.role               AS target_user_role
FROM public.flags f
LEFT JOIN public.profiles rp  ON rp.id = f.reporter_id
LEFT JOIN public.posts    tp  ON f.target_type = 'post' AND tp.id = f.target_id
LEFT JOIN public.profiles tap ON tp.author_id = tap.id
LEFT JOIN public.profiles tu  ON f.target_type = 'user' AND tu.id = f.target_id;

COMMENT ON VIEW public.admin_flag_detail IS
  'Flag with reporter + polymorphic target info. Usage: SELECT * FROM admin_flag_detail WHERE id = ''flag-uuid'';';


-- 2f. Transactions list — E-Kyash payments with payer/payee names
--     Replaces: admin/app/(admin)/transactions/page.tsx
CREATE OR REPLACE VIEW public.admin_transactions_list AS
SELECT
  t.id,
  t.contract_id,
  t.order_id,
  t.invoice_id,
  t.transaction_id,
  t.amount_cents,
  t.platform_fee_cents,
  t.donation_cents,
  t.currency,
  t.status,
  t.created_at,
  pp.first_name AS payer_first_name,
  pp.last_name  AS payer_last_name,
  pe.first_name AS payee_first_name,
  pe.last_name  AS payee_last_name
FROM public.ekyash_transactions t
LEFT JOIN public.profiles pp ON pp.id = t.payer_id
LEFT JOIN public.profiles pe ON pe.id = t.payee_id
ORDER BY t.created_at DESC;

COMMENT ON VIEW public.admin_transactions_list IS
  'E-Kyash transactions with payer/payee names. For donation total: SELECT total_cents FROM donation_totals WHERE id = 1;';


-- 2g. Recent admin actions — audit log
--     Replaces: admin/app/(admin)/page.tsx (recent actions section)
CREATE OR REPLACE VIEW public.admin_recent_actions AS
SELECT
  aa.id,
  aa.action,
  aa.target_type,
  aa.target_id,
  aa.reason,
  aa.metadata,
  aa.created_at,
  p.first_name AS admin_first_name,
  p.last_name  AS admin_last_name
FROM public.admin_actions aa
LEFT JOIN public.profiles p ON p.id = aa.admin_id
ORDER BY aa.created_at DESC;

COMMENT ON VIEW public.admin_recent_actions IS
  'Admin audit log with admin names, sorted most-recent first.';


-- 2h. Posts list — posts with author info
--     Replaces: admin/app/(admin)/posts/page.tsx
CREATE OR REPLACE VIEW public.admin_posts_list AS
SELECT
  po.id,
  po.type,
  po.status,
  po.title,
  po.price_cents,
  po.seats_total,
  po.seats_filled,
  po.departure_at,
  po.created_at,
  p.first_name AS author_first_name,
  p.last_name  AS author_last_name
FROM public.posts po
LEFT JOIN public.profiles p ON p.id = po.author_id
ORDER BY po.created_at DESC;

COMMENT ON VIEW public.admin_posts_list IS
  'Posts with author names for admin browsing.';


-- =============================================================================
-- 3. FUNCTIONS: Admin write operations for Studio SQL Editor
-- =============================================================================

-- 3a. Internal helper: verify admin role
CREATE OR REPLACE FUNCTION public._admin_check(p_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.role;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = p_admin_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Admin profile not found: %', p_admin_id;
  END IF;
  IF v_role != 'admin' THEN
    RAISE EXCEPTION 'User % is not an admin (role: %)', p_admin_id, v_role;
  END IF;
END;
$$;


-- 3b. Review driver application
--     Replaces: admin/app/api/drivers/review/route.ts
--     Usage: SELECT admin_review_driver('driver-uuid', 'approve', NULL, 'admin-uuid');
--            SELECT admin_review_driver('driver-uuid', 'reject', 'Blurry license photo', 'admin-uuid');
CREATE OR REPLACE FUNCTION public.admin_review_driver(
  p_driver_id uuid,
  p_action    text,
  p_reason    text DEFAULT NULL,
  p_admin_id  uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'p_admin_id is required';
  END IF;
  PERFORM _admin_check(p_admin_id);

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be approve or reject.', p_action;
  END IF;
  IF p_action = 'reject' AND (p_reason IS NULL OR trim(p_reason) = '') THEN
    RAISE EXCEPTION 'Reason is required for rejection';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM driver_details WHERE id = p_driver_id) THEN
    RAISE EXCEPTION 'Driver not found: %', p_driver_id;
  END IF;

  IF p_action = 'approve' THEN
    UPDATE driver_details SET
      review_status = 'approved',
      verified      = true,
      verified_at   = now(),
      verified_by   = p_admin_id
    WHERE id = p_driver_id;

    UPDATE profiles SET account_status = 'active' WHERE id = p_driver_id;

    INSERT INTO notifications (user_id, type, title, body, data) VALUES (
      p_driver_id,
      'driver_verified',
      'Driver documents approved',
      'Your driver documents were approved. You can now post routes and accept bookings.',
      jsonb_build_object('userId', p_driver_id::text)
    );

  ELSE -- reject
    UPDATE driver_details SET
      review_status    = 'rejected',
      rejection_reason = p_reason,
      verified         = false,
      verified_by      = p_admin_id
    WHERE id = p_driver_id;

    INSERT INTO notifications (user_id, type, title, body, data) VALUES (
      p_driver_id,
      'driver_verification_rejected',
      'Driver documents need changes',
      'Your driver documents were rejected: ' || p_reason,
      jsonb_build_object('userId', p_driver_id::text)
    );
  END IF;

  -- Audit log
  INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES (
    p_admin_id,
    CASE p_action WHEN 'approve' THEN 'approve_driver' ELSE 'reject_driver' END,
    'driver_details',
    p_driver_id,
    p_reason
  );

  RETURN 'OK: driver ' || p_driver_id || ' ' || p_action || 'd';
END;
$$;

COMMENT ON FUNCTION public.admin_review_driver IS
  'Approve or reject a driver application. Notifies driver and logs admin action.';


-- 3c. Review rider document
--     Replaces: admin/app/api/riders/review/route.ts
--     Usage: SELECT admin_review_rider_doc('doc-uuid', 'approve', NULL, 'admin-uuid');
--            SELECT admin_review_rider_doc('doc-uuid', 'reject', 'Photo too blurry', 'admin-uuid');
CREATE OR REPLACE FUNCTION public.admin_review_rider_doc(
  p_doc_id   uuid,
  p_action   text,
  p_reason   text DEFAULT NULL,
  p_admin_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Validate
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'p_admin_id is required';
  END IF;
  PERFORM _admin_check(p_admin_id);

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be approve or reject.', p_action;
  END IF;
  IF p_action = 'reject' AND (p_reason IS NULL OR trim(p_reason) = '') THEN
    RAISE EXCEPTION 'Reason is required for rejection';
  END IF;

  -- Fetch document owner
  SELECT user_id INTO v_user_id FROM rider_documents WHERE id = p_doc_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Rider document not found: %', p_doc_id;
  END IF;

  IF p_action = 'approve' THEN
    UPDATE rider_documents SET
      review_status = 'approved',
      verified      = true,
      reviewed_by   = p_admin_id
    WHERE id = p_doc_id;

    UPDATE profiles SET account_status = 'active' WHERE id = v_user_id;

    INSERT INTO notifications (user_id, type, title, body, data) VALUES (
      v_user_id,
      'rider_verified',
      'ID document approved',
      'Your ID document was approved. Your account is now verified.',
      jsonb_build_object('userId', v_user_id::text)
    );

  ELSE -- reject
    UPDATE rider_documents SET
      review_status    = 'rejected',
      rejection_reason = p_reason,
      verified         = false,
      reviewed_by      = p_admin_id
    WHERE id = p_doc_id;

    INSERT INTO notifications (user_id, type, title, body, data) VALUES (
      v_user_id,
      'rider_document_rejected',
      'ID document needs changes',
      'Your ID document was rejected: ' || p_reason,
      jsonb_build_object('userId', v_user_id::text)
    );
  END IF;

  -- Audit log
  INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES (
    p_admin_id,
    CASE p_action WHEN 'approve' THEN 'approve_rider_doc' ELSE 'reject_rider_doc' END,
    'rider_documents',
    p_doc_id,
    p_reason
  );

  RETURN 'OK: rider doc ' || p_doc_id || ' ' || p_action || 'd';
END;
$$;

COMMENT ON FUNCTION public.admin_review_rider_doc IS
  'Approve or reject a rider ID document. Notifies user and logs admin action.';


-- 3d. User action (suspend / unsuspend / approve)
--     Replaces: admin/app/api/users/action/route.ts
--     Usage: SELECT admin_user_action('user-uuid', 'suspend', 'Repeated no-shows', 'admin-uuid');
--            SELECT admin_user_action('user-uuid', 'unsuspend', NULL, 'admin-uuid');
--            SELECT admin_user_action('user-uuid', 'approve', NULL, 'admin-uuid');
CREATE OR REPLACE FUNCTION public.admin_user_action(
  p_user_id  uuid,
  p_action   text,
  p_reason   text DEFAULT NULL,
  p_admin_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role  public.role;
  v_new_status   public.account_status;
  v_notif_type   text;
  v_notif_title  text;
  v_notif_body   text;
  v_admin_action public.admin_action_type;
BEGIN
  -- Validate
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'p_admin_id is required';
  END IF;
  PERFORM _admin_check(p_admin_id);

  IF p_action NOT IN ('suspend', 'unsuspend', 'approve') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be suspend, unsuspend, or approve.', p_action;
  END IF;
  IF p_action = 'suspend' AND (p_reason IS NULL OR trim(p_reason) = '') THEN
    RAISE EXCEPTION 'Reason is required for suspension';
  END IF;

  -- Verify target exists and prevent admin suspension
  SELECT role INTO v_target_role FROM profiles WHERE id = p_user_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  IF p_action = 'suspend' AND v_target_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot suspend an admin account';
  END IF;

  -- Determine new status
  IF p_action = 'suspend' THEN
    v_new_status := 'suspended';
  ELSE
    v_new_status := 'active';
  END IF;

  UPDATE profiles SET account_status = v_new_status WHERE id = p_user_id;

  -- If approving, also mark pending rider documents as approved
  IF p_action = 'approve' THEN
    UPDATE rider_documents SET
      review_status = 'approved',
      verified      = true,
      reviewed_by   = p_admin_id
    WHERE user_id = p_user_id
      AND review_status = 'pending';
  END IF;

  -- Build notification
  CASE p_action
    WHEN 'approve' THEN
      v_notif_type  := 'account_approved';
      v_notif_title := 'Account approved';
      v_notif_body  := 'Your account has been approved. You can now create posts and book rides.';
      v_admin_action := 'approve_rider_doc';
    WHEN 'suspend' THEN
      v_notif_type  := 'account_suspended';
      v_notif_title := 'Account suspended';
      v_notif_body  := 'Your account was suspended: ' || p_reason;
      v_admin_action := 'suspend_user';
    WHEN 'unsuspend' THEN
      v_notif_type  := 'account_reactivated';
      v_notif_title := 'Account restored';
      v_notif_body  := 'Your account is active again.';
      v_admin_action := 'unsuspend_user';
  END CASE;

  INSERT INTO notifications (user_id, type, title, body, data) VALUES (
    p_user_id,
    v_notif_type,
    v_notif_title,
    v_notif_body,
    jsonb_build_object('userId', p_user_id::text)
  );

  INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES (
    p_admin_id,
    v_admin_action,
    'profiles',
    p_user_id,
    p_reason
  );

  RETURN 'OK: user ' || p_user_id || ' ' || p_action || 'd';
END;
$$;

COMMENT ON FUNCTION public.admin_user_action IS
  'Suspend, unsuspend, or approve a user. Notifies user and logs admin action.';


-- 3e. Moderate flag (dismiss / remove_post / suspend_user / issue_strike)
--     Replaces: admin/app/api/flags/action/route.ts
--     Usage: SELECT admin_moderate_flag('flag-uuid', 'dismiss', 'Not actionable', 'admin-uuid');
--            SELECT admin_moderate_flag('flag-uuid', 'remove_post', 'Spam', 'admin-uuid');
--            SELECT admin_moderate_flag('flag-uuid', 'suspend_user', 'Harassment', 'admin-uuid');
--            SELECT admin_moderate_flag('flag-uuid', 'issue_strike', 'First offense', 'admin-uuid');
CREATE OR REPLACE FUNCTION public.admin_moderate_flag(
  p_flag_id  uuid,
  p_action   text,
  p_reason   text DEFAULT NULL,
  p_admin_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_type  public.flag_target;
  v_target_id    uuid;
  v_flag_status  public.flag_status;
  v_post_author  uuid;
  v_target_role  public.role;
  v_strike_user  uuid;
BEGIN
  -- Validate
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'p_admin_id is required';
  END IF;
  PERFORM _admin_check(p_admin_id);

  IF p_action NOT IN ('dismiss', 'remove_post', 'suspend_user', 'issue_strike') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be dismiss, remove_post, suspend_user, or issue_strike.', p_action;
  END IF;

  -- Fetch flag
  SELECT target_type, target_id INTO v_target_type, v_target_id
  FROM flags WHERE id = p_flag_id;
  IF v_target_type IS NULL THEN
    RAISE EXCEPTION 'Flag not found: %', p_flag_id;
  END IF;

  -- Validate action/target compatibility
  IF p_action = 'remove_post' AND v_target_type != 'post' THEN
    RAISE EXCEPTION 'remove_post requires a post-type flag (got: %)', v_target_type;
  END IF;
  IF p_action = 'suspend_user' AND v_target_type != 'user' THEN
    RAISE EXCEPTION 'suspend_user requires a user-type flag (got: %)', v_target_type;
  END IF;

  -- Update flag status
  IF p_action = 'dismiss' THEN
    v_flag_status := 'dismissed';
  ELSE
    v_flag_status := 'action_taken';
  END IF;

  UPDATE flags SET
    status      = v_flag_status,
    reviewed_by = p_admin_id,
    reviewed_at = now()
  WHERE id = p_flag_id;

  -- Execute action
  CASE p_action
    WHEN 'dismiss' THEN
      INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES (
        p_admin_id, 'dismiss_flag', 'flags', p_flag_id, p_reason
      );

    WHEN 'remove_post' THEN
      -- Get post author for notification
      SELECT author_id INTO v_post_author FROM posts WHERE id = v_target_id;

      UPDATE posts SET status = 'cancelled' WHERE id = v_target_id;

      IF v_post_author IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, body, data) VALUES (
          v_post_author,
          'post_removed',
          'Post removed',
          CASE WHEN p_reason IS NOT NULL
            THEN 'One of your posts was removed: ' || p_reason
            ELSE 'One of your posts was removed after moderation review.'
          END,
          jsonb_build_object('postId', v_target_id::text)
        );
      END IF;

      INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES (
        p_admin_id, 'remove_post', 'posts', v_target_id, p_reason
      );

    WHEN 'suspend_user' THEN
      -- Prevent suspending admins
      SELECT role INTO v_target_role FROM profiles WHERE id = v_target_id;
      IF v_target_role = 'admin' THEN
        RAISE EXCEPTION 'Cannot suspend an admin account';
      END IF;

      UPDATE profiles SET account_status = 'suspended' WHERE id = v_target_id;

      INSERT INTO notifications (user_id, type, title, body, data) VALUES (
        v_target_id,
        'account_suspended',
        'Account suspended',
        CASE WHEN p_reason IS NOT NULL
          THEN 'Your account was suspended: ' || p_reason
          ELSE 'Your account was suspended after moderation review.'
        END,
        jsonb_build_object('userId', v_target_id::text)
      );

      INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES (
        p_admin_id, 'suspend_user', 'profiles', v_target_id, p_reason
      );

    WHEN 'issue_strike' THEN
      -- Resolve user ID: if target is a post, strike the author
      IF v_target_type = 'post' THEN
        SELECT author_id INTO v_strike_user FROM posts WHERE id = v_target_id;
        IF v_strike_user IS NULL THEN
          RAISE EXCEPTION 'Could not resolve post author for strike';
        END IF;
      ELSE
        v_strike_user := v_target_id;
      END IF;

      INSERT INTO strikes (user_id, type, reason, auto_generated) VALUES (
        v_strike_user, 'soft', 'report', false
      );

      INSERT INTO notifications (user_id, type, title, body, data) VALUES (
        v_strike_user,
        'strike_received',
        'Strike issued',
        CASE WHEN p_reason IS NOT NULL
          THEN 'A strike was added to your account: ' || p_reason
          ELSE 'A strike was added to your account after moderation review.'
        END,
        jsonb_build_object('userId', v_strike_user::text, 'targetId', v_target_id::text, 'targetType', v_target_type::text)
      );

      INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason) VALUES (
        p_admin_id, 'issue_strike', 'profiles', v_strike_user, p_reason
      );

  END CASE;

  RETURN 'OK: flag ' || p_flag_id || ' — ' || p_action;
END;
$$;

COMMENT ON FUNCTION public.admin_moderate_flag IS
  'Moderate a community flag. Actions: dismiss, remove_post, suspend_user, issue_strike. Notifies affected users and logs admin action.';
