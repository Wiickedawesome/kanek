# Phase 2 — Database & RLS Audit Report

**Date:** 2025-07-26
**Scope:** 49 migrations, RLS policies, constraints, triggers, indexes, storage policies
**Tables Audited:** 23
**RLS Policies Reviewed:** 52
**SECURITY DEFINER Functions Reviewed:** 22
**Storage Buckets Reviewed:** 3

---

## RLS Coverage Matrix

| Table | RLS Enabled | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|:-----------:|--------|--------|--------|--------|-------|
| profiles | ✅ | ✅ `USING (true)` | ❌ none (trigger) | ✅ own (`id = auth.uid()`) | ❌ none | **C-01, C-03**: SELECT exposes PII; UPDATE unrestricted columns |
| posts | ✅ | ✅ `USING (true)` | ✅ own + active | ✅ own (`author_id`) | ✅ own (`author_id`) | Public read intentional; **M-03**: UPDATE unrestricted |
| bookings | ✅ | ✅ involved | ✅ own + active | ✅ involved | ❌ none | **H-01**: UPDATE allows self-confirm |
| contracts | ✅ | ✅ party (`uid = ANY(parties)`) | ❌ none (trigger) | ❌ none | ❌ none | Properly locked down |
| ratings | ✅ | ✅ `USING (true)` | ✅ party + own | ❌ none | ❌ none | **H-02**: Public read exposes rater_id |
| strikes | ✅ | ✅ own + admin | ❌ none (trigger) | ❌ none | ❌ none | Properly restricted |
| road_reports | ✅ | ✅ `USING (true)` | ✅ auth'd + own | ✅ owner | ✅ owner | Public read intentional |
| gas_prices | ✅ | ✅ `USING (true)` | ✅ auth'd + own | ✅ owner | ❌ none | Public read intentional |
| ekyash_transactions | ✅ | ✅ involved (payer/payee) | ❌ none (service) | ❌ none | ❌ none | Properly scoped |
| donation_totals | ✅ | ✅ `USING (true)` | ❌ none (trigger) | ❌ none | ❌ none | Public read intentional |
| notifications | ✅ | ✅ own (`user_id`) | ❌ none (trigger) | ✅ own | ❌ none | Properly scoped |
| waitlist | ✅ | ✅ own | ✅ own | ❌ none | ✅ own | OK |
| email_receipts | ✅ | ✅ own (`user_id`) | ❌ none (service) | ❌ none | ❌ none | OK |
| driver_details | ✅ | ✅ own + admin | ✅ own | ✅ own | ❌ none | OK |
| rider_documents | ✅ | ✅ own + admin | ✅ own | ❌ none | ❌ none | OK |
| flags | ✅ | ✅ admin only | ✅ auth'd + own | ✅ admin only | ❌ none | Properly scoped |
| admin_actions | ✅ | ✅ admin only | ❌ none (service) | ❌ none | ❌ none | OK |
| driver_checkins | ✅ | ✅ contract parties | ✅ own (`driver_id`) | ❌ none | ❌ none | OK |
| contract_messages | ✅ | ✅ contract party | ✅ party + own | ❌ none | ❌ none | OK |
| contract_events | ✅ | ✅ contract party | ✅ party + own + active | ❌ none | ❌ none | OK |
| driver_documents | ✅ | ✅ own + admin | ✅ own | ✅ own (**no WITH CHECK**) + admin | ❌ none | **C-02**: User can self-approve |
| road_report_votes | ✅ | ✅ own | ✅ own | ❌ none | ❌ none | Dedup junction table |
| gas_price_verifications | ✅ | ✅ own | ✅ own | ❌ none | ❌ none | Dedup junction table |

**Summary:** 23/23 tables have RLS enabled. 3 Critical, 2 High, 1 Medium policy-level issues found.

---

## Critical Findings

### C-01 — profiles UPDATE Policy Allows Role Self-Escalation to Admin

- **Severity:** Critical
- **Migration(s):** `00009_add_rls_policies.sql`
- **Table:** `profiles`
- **Description:** The `profiles_update_own` policy uses `USING (id = auth.uid())` with no `WITH CHECK` clause and no column restrictions. A user can change any column on their own profile row, including `role`, `account_status`, `strikes_soft`, `strikes_hard`, `rating_avg`, and `punctuality_pct`.
- **Evidence:**
  ```sql
  -- Migration 00009
  CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (id = auth.uid());
  -- No WITH CHECK clause = defaults to USING = any column can be changed
  ```
- **Attack Vectors:**
  1. **Privilege escalation:** `UPDATE profiles SET role = 'admin' WHERE id = auth.uid();` — grants admin access to flags, admin_actions, driver_details, rider_documents, driver_documents via `is_admin()` checks
  2. **Ban evasion:** `UPDATE profiles SET account_status = 'active' WHERE id = auth.uid();` — bypasses `is_active_account()` checks on posts/bookings INSERT
  3. **Strike clearing:** `UPDATE profiles SET strikes_soft = 0, strikes_hard = 0 WHERE id = auth.uid();`
  4. **Rating manipulation:** `UPDATE profiles SET rating_avg = 5.0, punctuality_pct = 100 WHERE id = auth.uid();`
- **Impact:** Full privilege escalation. Any authenticated user can become admin and access all admin-only data. Any banned user can unban themselves.
- **Remediation:**
  ```sql
  -- New migration: restrict profiles UPDATE to safe columns only
  DROP POLICY "profiles_update_own" ON profiles;

  CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    -- Ensure protected columns cannot be changed
    role = (SELECT role FROM profiles WHERE id = auth.uid()) AND
    account_status = (SELECT account_status FROM profiles WHERE id = auth.uid()) AND
    strikes_soft = (SELECT strikes_soft FROM profiles WHERE id = auth.uid()) AND
    strikes_hard = (SELECT strikes_hard FROM profiles WHERE id = auth.uid()) AND
    rating_avg = (SELECT rating_avg FROM profiles WHERE id = auth.uid()) AND
    punctuality_pct = (SELECT punctuality_pct FROM profiles WHERE id = auth.uid()) AND
    total_rides = (SELECT total_rides FROM profiles WHERE id = auth.uid())
  );
  ```
  **Alternative (simpler, use a BEFORE UPDATE trigger):**
  ```sql
  CREATE OR REPLACE FUNCTION prevent_protected_profile_changes()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change role';
    END IF;
    IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
      RAISE EXCEPTION 'Cannot change account_status';
    END IF;
    IF NEW.strikes_soft IS DISTINCT FROM OLD.strikes_soft
       OR NEW.strikes_hard IS DISTINCT FROM OLD.strikes_hard THEN
      RAISE EXCEPTION 'Cannot change strikes';
    END IF;
    IF NEW.rating_avg IS DISTINCT FROM OLD.rating_avg
       OR NEW.punctuality_pct IS DISTINCT FROM OLD.punctuality_pct
       OR NEW.total_rides IS DISTINCT FROM OLD.total_rides THEN
      RAISE EXCEPTION 'Cannot change computed rating fields';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

  CREATE TRIGGER protect_profile_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_protected_profile_changes();
  ```

---

### C-02 — driver_documents UPDATE Allows User Self-Approval

- **Severity:** Critical
- **Migration(s):** `00048_driver_documents.sql`
- **Table:** `driver_documents`
- **Description:** The user UPDATE policy on `driver_documents` uses `USING (profile_id = auth.uid())` with no `WITH CHECK` clause. A driver can set their own documents to `review_status = 'approved'`, bypassing the admin document review workflow entirely.
- **Evidence:**
  ```sql
  -- Migration 00048
  CREATE POLICY "Users can update their own documents" ON driver_documents FOR UPDATE
  USING (profile_id = auth.uid());
  -- No WITH CHECK = user can change review_status, reviewed_by, reviewed_at
  ```
- **Attack Vector:**
  ```sql
  UPDATE driver_documents
  SET review_status = 'approved', reviewed_at = now()
  WHERE profile_id = auth.uid();
  ```
- **Impact:** Drivers can self-approve their license, insurance, and vehicle registration documents without admin review, bypassing the entire verification workflow. The `check_driver_documents_complete()` function would then see all documents as approved.
- **Remediation:**
  ```sql
  DROP POLICY "Users can update their own documents" ON driver_documents;

  CREATE POLICY "Users can update their own documents" ON driver_documents FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (
    -- Users can only re-upload, not change review status
    review_status = 'pending'
  );
  ```

---

### C-03 — profiles SELECT Exposes PII to All Authenticated Users

- **Severity:** Critical
- **Migration(s):** `00009_add_rls_policies.sql`, `00044_profiles_public_view.sql`
- **Table:** `profiles`
- **Description:** The `profiles_select` policy uses `USING (true)`, exposing every column of every profile to all authenticated users. Sensitive PII includes: `phone`, `email`, `push_token`, `emergency_contact_name`, `emergency_contact_phone`. Migration 00044 created a `profiles_public` view with safe columns, but the underlying table policy was never tightened — any Supabase client or PostgREST query can bypass the view and read all columns directly.
- **Evidence:**
  ```sql
  -- Migration 00009
  CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (true);
  -- Exposes ALL columns to ALL authenticated users
  
  -- Migration 00044 created a safe view but didn't restrict the table policy
  CREATE VIEW profiles_public AS
  SELECT id, first_name, last_name, avatar_url, role, account_status, ...
  FROM profiles;
  ```
- **Attack Vector:**
  ```sql
  -- Any authenticated user can run:
  SELECT phone, email, push_token, emergency_contact_name, emergency_contact_phone
  FROM profiles;
  -- Returns PII for ALL users in the system
  ```
- **Impact:** Mass PII exposure. Phone numbers, emails, push notification tokens, and emergency contact information for all users are readable by any authenticated user. Push tokens could be used for notification spoofing.
- **Remediation:**
  ```sql
  DROP POLICY "profiles_select" ON profiles;

  -- Own profile: full access
  CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  USING (id = auth.uid());

  -- Other profiles: safe columns only via view or function
  -- Option A: Direct users to profiles_public view (already exists)
  -- Option B: Column-masking function for direct table access
  
  -- Since RLS can't restrict columns, use the view + restrict direct table access:
  CREATE POLICY "profiles_select_other" ON profiles FOR SELECT
  USING (
    id = auth.uid() OR is_admin()
  );
  ```
  **Note:** The app's `profilesApi.ts` already selects safe columns for public profiles (line 50), but the RLS policy must enforce this server-side. Tightening to own + admin may require updating queries that join profiles (e.g., post author info). Consider using the `profiles_public` view for all cross-user lookups combined with explicit joins on the view rather than the table.

---

## High Findings

### H-01 — bookings UPDATE Allows Booker to Self-Confirm

- **Severity:** High
- **Migration(s):** `00009_add_rls_policies.sql`, `00045_universal_applicant_review.sql`
- **Table:** `bookings`
- **Description:** The bookings UPDATE policy allows both the booker (`user_id = auth.uid()`) and the post author to update any column. Since migration 00045 made all bookings start as `'pending'` with accept/reject handled via RPCs (`accept_applicant`/`reject_applicant`), a booker can bypass the review by directly updating their booking status.
- **Evidence:**
  ```sql
  -- Migration 00009 (still active)
  CREATE POLICY "bookings_update" ON bookings FOR UPDATE
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM posts WHERE posts.id = bookings.post_id AND posts.author_id = auth.uid())
  );
  -- No WITH CHECK = any column can be changed by either party
  ```
- **Attack Vector:**
  ```sql
  -- Booker self-confirms without post author approval:
  UPDATE bookings SET status = 'confirmed' WHERE id = 'my-booking-id' AND user_id = auth.uid();
  -- handle_booking_status_change AFTER trigger fires and may create a contract
  ```
- **Impact:** Undermines the entire applicant review flow. The AFTER UPDATE trigger (`handle_booking_status_change`) will process the status change as legitimate, potentially creating contracts. Post authors lose control over who participates in their routes.
- **Remediation:**
  ```sql
  DROP POLICY "bookings_update" ON bookings;

  -- Bookers can only cancel their own bookings
  CREATE POLICY "bookings_update_own" ON bookings FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (status = 'cancelled');

  -- Post authors manage via RPCs only (accept_applicant / reject_applicant)
  -- No direct UPDATE policy for post authors
  ```

---

### H-02 — Anonymous Ratings Expose rater_id via Public SELECT

- **Severity:** High
- **Migration(s):** `00036_anonymous_ratings.sql`, `00009_add_rls_policies.sql`
- **Table:** `ratings`
- **Description:** Migration 00036 added `is_anonymous` boolean to allow anonymous ratings. However, the SELECT policy on ratings uses `USING (true)` (public read), and the `rater_id` column is always included in query results. The anonymity is cosmetic — the app UI hides the name, but the data is accessible to anyone.
- **Evidence:**
  ```sql
  -- ratings SELECT policy (00009, unchanged)
  CREATE POLICY "ratings_select" ON ratings FOR SELECT USING (true);
  -- rater_id is a regular column, always visible
  
  -- ratingsApi.ts queries include rater join:
  -- .select('*, rater:profiles!ratings_rater_id_fkey(id, first_name, last_name, avatar_url)')
  ```
- **Impact:** Users who chose to rate anonymously have their identity exposed through direct DB queries. Potential for retaliation in a small Belizean community.
- **Remediation:**
  ```sql
  -- Replace public SELECT with a view that masks anonymous raters
  CREATE OR REPLACE VIEW ratings_public AS
  SELECT
    id, contract_id, rated_id, stars, was_on_time, comment, is_anonymous, created_at,
    CASE WHEN is_anonymous THEN NULL ELSE rater_id END AS rater_id
  FROM ratings;

  -- Tighten table-level SELECT to parties only
  DROP POLICY "ratings_select" ON ratings;
  CREATE POLICY "ratings_select_party" ON ratings FOR SELECT
  USING (
    rater_id = auth.uid() OR
    rated_id = auth.uid() OR
    is_admin()
  );
  ```
  **App change:** Update `ratingsApi.ts` to query `ratings_public` view for displaying ratings to third parties, and direct table for the rater's own ratings.

---

### H-03 — 18 SECURITY DEFINER Functions Missing SET search_path

- **Severity:** High
- **Migration(s):** Various (00004, 00006, 00009, 00026, 00034, 00038, 00045, 00046, 00047, 00049)
- **Description:** 18 of 22 SECURITY DEFINER functions do not include `SET search_path = public`. In PostgreSQL, a SECURITY DEFINER function executes with the privileges of the function owner (typically superuser). Without a fixed search_path, an attacker who can manipulate the session search_path could redirect table references to shadow tables, potentially escalating privileges or exfiltrating data.
- **Evidence — Functions WITHOUT `SET search_path`:**

  | Function | Migration | Risk |
  |----------|-----------|------|
  | `handle_new_user()` | 00026 | Creates profile with attacker-controlled defaults |
  | `recalculate_rating()` | 00004 | Manipulate rating calculations |
  | `increment_strike_counter()` | 00004 | Redirect strike logic |
  | `accumulate_donation()` | 00006 | Redirect donation tracking |
  | `is_admin()` | 00009 | **Return true for non-admin** — grants admin access |
  | `is_active_account()` | 00046 | **Return true for banned users** — bypass account gates |
  | `handle_new_booking_before()` | 00045 | Bypass booking validation |
  | `handle_new_booking_after()` | 00045 | Contract creation manipulation |
  | `handle_booking_status_change()` | 00045 | Status transition manipulation |
  | `handle_post_status_change()` | 00045 | Post lifecycle manipulation |
  | `notify_on_new_message()` | 00034 | Notification injection |
  | `notify_on_post_deleted()` | 00038 | Notification injection |
  | `notify_contract_event()` | 00047 | Notification injection |
  | `accept_applicant()` | 00045 | Booking approval bypass |
  | `reject_applicant()` | 00045 | Booking rejection bypass |
  | `accept_job_application()` | 00045 | Wrapper, delegates to accept_applicant |
  | `reject_job_application()` | 00045 | Wrapper, delegates to reject_applicant |
  | `check_driver_documents_complete()` | 00049 | Document check bypass |

  **Functions WITH `SET search_path = public` (correct):**
  `upvote_road_report`, `report_road_report_gone`, `verify_gas_price`, `enforce_phone_change_rate_limit`

- **Impact:** While Supabase's API layer provides some mitigation (the postgrest search_path is controlled), direct database connections or compromised edge functions could exploit this. The `is_admin()` and `is_active_account()` functions are particularly dangerous since they gate access control decisions.
- **Remediation:**
  ```sql
  -- Add SET search_path to all 18 functions. Example for critical ones:
  
  CREATE OR REPLACE FUNCTION is_admin()
  RETURNS boolean AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    );
  $$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;
  
  CREATE OR REPLACE FUNCTION is_active_account()
  RETURNS boolean AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND account_status = 'active'
    );
  $$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;
  
  -- Repeat for all 18 functions, preserving existing logic
  ```

---

## Medium Findings

### M-01 — report_road_report_gone Lacks Per-User Deduplication

- **Severity:** Medium
- **Migration(s):** `00041_road_report_gas_price_rpc.sql`, `00042_dedup_community_actions.sql`
- **Table:** `road_reports`, `road_report_votes`
- **Description:** Migration 00042 added deduplication tables for upvotes (`road_report_votes`) and gas price verifications (`gas_price_verifications`), but the `report_road_report_gone()` RPC has no per-user deduplication. A single user can call this function 3 times (the `gone_count` threshold) to trigger deletion of any road report.
- **Evidence:**
  ```sql
  -- report_road_report_gone (00041) has no dedup check:
  UPDATE road_reports SET gone_count = gone_count + 1 WHERE id = report_id;
  -- Deletes when gone_count >= 3
  
  -- Compare: upvote_road_report (00042) checks road_report_votes first
  -- verify_gas_price (00042) checks gas_price_verifications first
  ```
- **Impact:** One malicious user can delete any road report by calling the RPC 3 times. Community safety reports (accidents, road closures) could be suppressed.
- **Remediation:**
  ```sql
  -- Create dedup table
  CREATE TABLE IF NOT EXISTS road_report_gone_votes (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    report_id uuid REFERENCES road_reports(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, report_id),
    created_at timestamptz DEFAULT now()
  );
  ALTER TABLE road_report_gone_votes ENABLE ROW LEVEL SECURITY;
  
  -- Update RPC to check dedup
  CREATE OR REPLACE FUNCTION report_road_report_gone(report_id uuid)
  RETURNS void AS $$
  BEGIN
    INSERT INTO road_report_gone_votes (user_id, report_id)
    VALUES (auth.uid(), report_road_report_gone.report_id)
    ON CONFLICT DO NOTHING;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Already reported as gone';
    END IF;
    
    UPDATE road_reports
    SET gone_count = gone_count + 1
    WHERE id = report_road_report_gone.report_id;
    
    DELETE FROM road_reports
    WHERE id = report_road_report_gone.report_id AND gone_count >= 3;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  ```

---

### M-02 — Missing Indexes on FK and Commonly Queried Columns

- **Severity:** Medium
- **Migration(s):** All (no explicit `CREATE INDEX` found in any migration)
- **Description:** PostgreSQL does NOT auto-create indexes on foreign key columns (only on PK/UNIQUE targets). No migration in the project creates explicit indexes. At scale, this causes full table scans on JOINs, FK-based lookups, and filtered queries.
- **Missing Indexes (by query impact):**

  | Table | Column(s) | Query Pattern | Priority |
  |-------|-----------|---------------|----------|
  | posts | `author_id` | My posts, author join | High |
  | posts | `status` | Feed filter, expiration cron | High |
  | posts | `type` | Feed filter by post type | Medium |
  | posts | `created_at` | Feed ordering | Medium |
  | bookings | `post_id` | Bookings for post | High |
  | bookings | `user_id` | My bookings | High |
  | bookings | `status` | Status filter | Medium |
  | bookings | `(post_id, status)` | Composite: bookings for post by status | High |
  | contracts | `booking_id` | Contract lookup by booking | High |
  | contracts | `post_id` | Contracts for post | Medium |
  | contracts | `parties` | Party lookup (needs GIN) | High |
  | ratings | `rated_id` | User ratings display | High |
  | ratings | `contract_id` | Rating per contract check | Medium |
  | notifications | `user_id` | User notifications list | High |
  | notifications | `(user_id, read)` | Unread count | High |
  | contract_messages | `contract_id` | Messages for contract | High |
  | contract_events | `contract_id` | Events for contract | Medium |
  | ekyash_transactions | `order_id` | Payment lookup (5 edge functions) | High |
  | ekyash_transactions | `contract_id` | Transaction for contract | Medium |
  | driver_documents | `profile_id` | Documents for driver | Medium |
  | driver_checkins | `contract_id` | Checkins for contract | Medium |
  | strikes | `user_id` | User strikes display | Medium |
  | road_reports | `expires_at` | Expiration cron filter | Medium |

- **Remediation:**
  ```sql
  -- High priority indexes
  CREATE INDEX idx_posts_author_id ON posts(author_id);
  CREATE INDEX idx_posts_status ON posts(status);
  CREATE INDEX idx_bookings_post_id_status ON bookings(post_id, status);
  CREATE INDEX idx_bookings_user_id ON bookings(user_id);
  CREATE INDEX idx_contracts_booking_id ON contracts(booking_id);
  CREATE INDEX idx_contracts_parties ON contracts USING GIN(parties);
  CREATE INDEX idx_ratings_rated_id ON ratings(rated_id);
  CREATE INDEX idx_notifications_user_id_read ON notifications(user_id, read);
  CREATE INDEX idx_contract_messages_contract_id ON contract_messages(contract_id);
  CREATE INDEX idx_ekyash_transactions_order_id ON ekyash_transactions(order_id);

  -- Medium priority indexes
  CREATE INDEX idx_posts_type ON posts(type);
  CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
  CREATE INDEX idx_ratings_contract_id ON ratings(contract_id);
  CREATE INDEX idx_contract_events_contract_id ON contract_events(contract_id);
  CREATE INDEX idx_ekyash_transactions_contract_id ON ekyash_transactions(contract_id);
  CREATE INDEX idx_driver_documents_profile_id ON driver_documents(profile_id);
  CREATE INDEX idx_driver_checkins_contract_id ON driver_checkins(contract_id);
  CREATE INDEX idx_strikes_user_id ON strikes(user_id);
  CREATE INDEX idx_road_reports_expires_at ON road_reports(expires_at);
  ```

---

### M-03 — posts UPDATE Allows Author to Manipulate Status and Core Fields

- **Severity:** Medium
- **Migration(s):** `00009_add_rls_policies.sql`
- **Table:** `posts`
- **Description:** The `posts_update_own` policy allows the author to update any column on their own posts, including `status`, `seats_filled`, `seats_available`, `expires_at`, and `price_cents`. An author can self-activate routes (bypassing `min_riders` checks by the cron function), re-open expired posts, or change prices after bookings are made.
- **Evidence:**
  ```sql
  CREATE POLICY "posts_update_own" ON posts FOR UPDATE
  USING (author_id = auth.uid());
  -- No WITH CHECK = any column can be changed
  ```
- **Impact:** Bypasses route activation requirements. Price changes after booking could mislead riders. Re-opening expired posts bypasses cron-enforced lifecycle.
- **Remediation:**
  ```sql
  -- BEFORE UPDATE trigger to protect computed/system fields
  CREATE OR REPLACE FUNCTION prevent_protected_post_changes()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'activated' THEN
      RAISE EXCEPTION 'Cannot self-activate; use check-route-activation';
    END IF;
    IF NEW.status = 'open' AND OLD.status IN ('expired', 'completed') THEN
      RAISE EXCEPTION 'Cannot re-open expired/completed posts';
    END IF;
    IF NEW.seats_filled IS DISTINCT FROM OLD.seats_filled THEN
      RAISE EXCEPTION 'seats_filled is managed by triggers';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  
  CREATE TRIGGER protect_post_fields
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION prevent_protected_post_changes();
  ```

---

### M-04 — Missing CHECK Constraints on Prices, Seats, and Coordinates

- **Severity:** Medium
- **Migration(s):** `00002_posts.sql`, `00005_road_reports.sql`, `00006_ekyash.sql`
- **Description:** No CHECK constraints exist on critical business-rule columns. While the app validates at form boundaries, direct PostgREST queries or compromised edge functions could insert invalid data.
- **Missing Constraints:**

  | Table | Column | Expected Constraint |
  |-------|--------|-------------------|
  | posts | `price_cents` | `CHECK (price_cents >= 0 AND price_cents <= 999900)` |
  | posts | `seats_available` | `CHECK (seats_available BETWEEN 1 AND 20)` |
  | posts | `seats_filled` | `CHECK (seats_filled >= 0)` |
  | posts | `origin_lat`, `origin_lng` | `CHECK (origin_lat BETWEEN 15.889 AND 18.497)`, etc. |
  | posts | `dest_lat`, `dest_lng` | Same bounding box |
  | ekyash_transactions | `amount_cents` | `CHECK (amount_cents > 0)` |
  | ekyash_transactions | `platform_fee_cents` | `CHECK (platform_fee_cents >= 0)` |
  | road_reports | `lat`, `lng` | Belize bounding box |
  | gas_prices | `regular_cents`, `premium_cents`, `diesel_cents` | `CHECK (x > 0)` |
  | gas_prices | `station_lat`, `station_lng` | Belize bounding box |

- **Remediation:**
  ```sql
  ALTER TABLE posts ADD CONSTRAINT posts_price_check
    CHECK (price_cents IS NULL OR (price_cents >= 0 AND price_cents <= 999900));
  ALTER TABLE posts ADD CONSTRAINT posts_seats_check
    CHECK (seats_available IS NULL OR (seats_available BETWEEN 1 AND 20));
  ALTER TABLE posts ADD CONSTRAINT posts_seats_filled_check
    CHECK (seats_filled >= 0);
  ALTER TABLE posts ADD CONSTRAINT posts_origin_bbox
    CHECK (origin_lat BETWEEN 15.889 AND 18.497 AND origin_lng BETWEEN -89.225 AND -87.485);
  ALTER TABLE posts ADD CONSTRAINT posts_dest_bbox
    CHECK (dest_lat IS NULL OR (dest_lat BETWEEN 15.889 AND 18.497 AND dest_lng BETWEEN -89.225 AND -87.485));
  
  ALTER TABLE ekyash_transactions ADD CONSTRAINT ekyash_amount_check
    CHECK (amount_cents > 0);
  ALTER TABLE ekyash_transactions ADD CONSTRAINT ekyash_fee_check
    CHECK (platform_fee_cents >= 0);
  
  ALTER TABLE road_reports ADD CONSTRAINT road_reports_bbox
    CHECK (lat BETWEEN 15.889 AND 18.497 AND lng BETWEEN -89.225 AND -87.485);
  
  ALTER TABLE gas_prices ADD CONSTRAINT gas_prices_bbox
    CHECK (station_lat BETWEEN 15.889 AND 18.497 AND station_lng BETWEEN -89.225 AND -87.485);
  ```

---

### M-05 — contract_events Has No Validation Constraints

- **Severity:** Medium
- **Migration(s):** `00047_contract_events.sql`
- **Table:** `contract_events`
- **Description:** The `event_type` column is free-form `text` with no CHECK constraint (expected values: `started_ride`, `arrived_pickup`, `picked_up_rider`, `arrived_destination`, `completed_ride`, etc.). The `note` column has no length limit.
- **Impact:** Arbitrary event types could be injected, potentially confusing the app or enabling abuse. Unbounded `note` field could be used for data stuffing.
- **Remediation:**
  ```sql
  ALTER TABLE contract_events ADD CONSTRAINT contract_events_type_check
    CHECK (event_type IN (
      'started_ride', 'arrived_pickup', 'picked_up_rider',
      'arrived_destination', 'completed_ride', 'cancelled',
      'delayed', 'rerouted', 'emergency', 'custom'
    ));
  ALTER TABLE contract_events ADD CONSTRAINT contract_events_note_length
    CHECK (note IS NULL OR char_length(note) <= 500);
  ```

---

## Low Findings

### L-01 — Avatars Storage Bucket Has No MIME Type Restriction

- **Severity:** Low
- **Migration(s):** `00039_avatars_bucket.sql`
- **Bucket:** `avatars` (public)
- **Description:** The avatars bucket allows any file type to be uploaded. While Supabase Storage serves files with appropriate headers (preventing XSS from HTML uploads), allowing arbitrary file types is unnecessary. Config.toml limits to 5MiB globally.
- **Remediation:** Add MIME type restriction via Supabase dashboard or config:
  ```toml
  [storage.buckets.avatars]
  public = true
  file_size_limit = "1MiB"
  allowed_mime_types = ["image/jpeg", "image/png", "image/webp"]
  ```

---

### L-02 — reject_applicant RPC Not Gated Behind is_active_account()

- **Severity:** Low
- **Migration(s):** `00045_universal_applicant_review.sql`, `00046_active_account_gate.sql`
- **Description:** Migration 00046 gates `handle_new_booking_before` behind `is_active_account()`, but neither `accept_applicant` nor `reject_applicant` RPCs check active status. A suspended user could still manage applicants on their existing posts.
- **Impact:** Low — suspended users managing existing obligations may be acceptable. But `accept_applicant` creating new contracts for a banned user is more concerning.
- **Remediation:**
  ```sql
  -- Add active check to accept_applicant:
  CREATE OR REPLACE FUNCTION accept_applicant(p_booking_id uuid)
  RETURNS void AS $$
  BEGIN
    IF NOT is_active_account() THEN
      RAISE EXCEPTION 'Account is not active';
    END IF;
    -- ... existing logic
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  ```

---

### L-03 — contract_messages INSERT Not Gated Behind Active Account

- **Severity:** Low
- **Migration(s):** `00033_contract_messages.sql`, `00046_active_account_gate.sql`
- **Table:** `contract_messages`
- **Description:** A suspended/banned user can still send messages in existing contracts. While completing existing contracts is reasonable, a banned-for-abuse user sending messages could be problematic.
- **Remediation:**
  ```sql
  DROP POLICY "contract_messages_insert" ON contract_messages;
  CREATE POLICY "contract_messages_insert" ON contract_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND is_active_account()
    AND EXISTS (
      SELECT 1 FROM contracts WHERE id = contract_id AND auth.uid() = ANY(parties)
    )
  );
  ```

---

### L-04 — Local Auth Captcha Disabled

- **Severity:** Low
- **Migration(s):** N/A (`supabase/config.toml`)
- **Description:** `[auth.captcha] enabled = false` in config.toml. This is expected for local development but should be verified as enabled in production Supabase dashboard with hCaptcha configured.
- **Action:** Verify production Supabase dashboard has captcha enabled with the correct hCaptcha site key.

---

## Info Findings

### I-01 — Types Sync: booking_status Enum Missing 'rejected'

- **Severity:** Info
- **Description:** Migration 00045 adds `'rejected'` to the `booking_status` enum, but `src/types/database.ts` only contains: `"pending" | "confirmed" | "cancelled" | "no_show" | "completed"`.
- **Action:** Regenerate types: `supabase gen types typescript --project-id tlggdherqjvybpddsqjj > src/types/database.ts`

---

### I-02 — Types Sync: Functions Missing accept_applicant and reject_applicant

- **Severity:** Info
- **Description:** The Functions section in `database.ts` lists 6 RPCs but is missing `accept_applicant` and `reject_applicant` (added in migration 00045). The app calls these via `supabase.rpc()` in `bookingsApi.ts`.
- **Action:** Regenerate types (same command as I-01).

---

### I-03 — Possible Dead Code: contracts INSERT in bookingsApi

- **Severity:** Info
- **Description:** `bookingsApi.ts` (line ~519) contains a contracts INSERT operation, but the contracts table has no INSERT RLS policy — contracts are created only by the `handle_new_booking_after` trigger. This INSERT would fail at the RLS level.
- **Action:** Verify whether this code path is actually reached. If it's dead code, remove it to avoid confusion.

---

### I-04 — Known Deferred Issues (Tracking Only)

These were documented in Phase 1 and remain unchanged:
- `flags.target_id` — polymorphic FK with no constraint (intentional pattern)
- `email_receipts` — both `contract_id` and `ekyash_txn_id` can be NULL (needs CHECK)
- `ekyash_txn_id` FK defaults to RESTRICT (consider CASCADE)

---

## Constraint Coverage Report

| Table | PK | FKs | NOT NULL (critical) | CHECK | UNIQUE | Notes |
|-------|:--:|:---:|:-------------------:|:-----:|:------:|-------|
| profiles | ✅ uuid | ✅ auth.users | ✅ role, phone | ❌ none | ✅ phone | Missing CHECK on role values |
| posts | ✅ uuid | ✅ profiles | ✅ author_id, type, status | ❌ **none** | ❌ none | **M-04**: No price/seats/coord checks |
| bookings | ✅ uuid | ✅ posts, profiles | ✅ post_id, user_id, role | ❌ none | ❌ none | No seats_booked CHECK |
| contracts | ✅ uuid | ✅ booking, post | ✅ booking_id, parties | ❌ none | ❌ none | — |
| ratings | ✅ uuid | ✅ contract, profiles×2 | ✅ stars, contract_id | ❌ none | ❌ none | No CHECK (stars BETWEEN 1 AND 5) |
| strikes | ✅ uuid | ✅ profiles, contracts | ✅ user_id, type | ❌ none | ❌ none | — |
| road_reports | ✅ uuid | ✅ profiles | ✅ reporter_id, type, lat, lng | ❌ **none** | ❌ none | **M-04**: No coord bbox CHECK |
| gas_prices | ✅ uuid | ✅ profiles | ✅ reporter_id, station_name | ❌ **none** | ❌ none | **M-04**: No price/coord CHECK |
| ekyash_transactions | ✅ uuid | ✅ contract, profiles×2 | ✅ amount_cents, status | ❌ **none** | ✅ order_id | **M-04**: No amount CHECK |
| donation_totals | ✅ uuid | ❌ none | ✅ total_cents | ❌ none | ❌ none | Singleton pattern |
| notifications | ✅ uuid | ✅ profiles | ✅ user_id, type, title | ❌ none | ❌ none | — |
| waitlist | ✅ uuid | ✅ posts, profiles | ✅ post_id, user_id | ❌ none | ✅ (post_id, user_id) | — |
| email_receipts | ✅ uuid | ✅ profiles, contract, ekyash | ✅ user_id | ❌ none | ❌ none | Both FKs nullable (deferred) |
| driver_details | ✅ uuid (= profile FK) | ✅ profiles | ✅ id | ❌ none | ❌ none | — |
| rider_documents | ✅ uuid | ✅ profiles | ✅ user_id, doc_type | ❌ none | ❌ none | — |
| flags | ✅ uuid | ✅ profiles (reporter) | ✅ target_type, target_id | ❌ none | ❌ none | target_id polymorphic (deferred) |
| admin_actions | ✅ uuid | ✅ profiles (admin) | ✅ admin_id, action_type | ❌ none | ❌ none | — |
| driver_checkins | ✅ uuid | ✅ profiles, contracts | ✅ driver_id, contract_id | ❌ none | ❌ none | No coord CHECK |
| contract_messages | ✅ uuid | ✅ contracts, profiles | ✅ contract_id, sender_id, body | ❌ none | ❌ none | No body length CHECK |
| contract_events | ✅ uuid | ✅ contracts, profiles | ✅ contract_id, actor_id, event_type | ❌ **none** | ❌ none | **M-05**: No type/note CHECK |
| driver_documents | ✅ uuid | ✅ profiles | ✅ profile_id, document_type | ❌ none | ❌ none | No review_status CHECK |
| road_report_votes | ✅ composite | ✅ auth.users, road_reports | ✅ (PK) | ❌ none | ✅ (PK) | Dedup junction |
| gas_price_verifications | ✅ composite | ✅ auth.users, gas_prices | ✅ (PK) | ❌ none | ✅ (PK) | Dedup junction |

**Summary:** 0/23 tables have CHECK constraints. All have PKs and appropriate FKs.

---

## Storage Policies

| Bucket | Public | INSERT | SELECT | UPDATE | DELETE | Issues |
|--------|:------:|--------|--------|--------|--------|--------|
| documents | ❌ | ✅ Own folder (`uid/`) | ✅ Own + admin | ❌ | ❌ | Properly scoped |
| checkin-selfies | ❌ | ✅ Own folder | ✅ Contract parties (via join) | ❌ | ❌ | Fixed in 00020 |
| avatars | ✅ | ✅ Own folder | ✅ Public | ✅ Own folder | ✅ Own folder | **L-01**: No MIME restriction |

---

## Trigger & Function Audit

### Triggers (Final State)

| Trigger | Table | Event | Function | SECURITY DEFINER | SET search_path |
|---------|-------|-------|----------|:----------------:|:---------------:|
| on_auth_user_created | auth.users | AFTER INSERT | handle_new_user | ✅ | ❌ |
| on_new_rating | ratings | AFTER INSERT | recalculate_rating | ✅ | ❌ |
| on_new_strike | strikes | AFTER INSERT | increment_strike_counter | ✅ | ❌ |
| on_new_ekyash_txn | ekyash_transactions | AFTER INSERT | accumulate_donation | ✅ | ❌ |
| before_booking_insert | bookings | BEFORE INSERT | handle_new_booking_before | ✅ | ❌ |
| after_booking_insert | bookings | AFTER INSERT | handle_new_booking_after | ✅ | ❌ |
| on_booking_status_change | bookings | AFTER UPDATE | handle_booking_status_change | ✅ | ❌ |
| on_post_status_change | posts | AFTER UPDATE | handle_post_status_change | ✅ | ❌ |
| on_new_message | contract_messages | AFTER INSERT | notify_on_new_message | ✅ | ❌ |
| on_post_deleted | posts | AFTER DELETE | notify_on_post_deleted | ✅ | ❌ |
| on_contract_event | contract_events | AFTER INSERT | notify_contract_event | ✅ | ❌ |
| enforce_phone_change_rate | profiles | BEFORE UPDATE | enforce_phone_change_rate_limit | ✅ | ✅ |

**Assessment:** All 12 triggers use SECURITY DEFINER (necessary since they execute in the context of the triggering user's session). 11/12 are missing `SET search_path` (see H-03).

### pg_cron Jobs

| Job | Schedule | Function Called |
|-----|----------|----------------|
| expire-posts | `*/30 * * * *` (every 30 min) | Edge function via HTTP |
| check-route-activation | `*/15 * * * *` (every 15 min) | Edge function via HTTP |

---

## Types Sync Issues

| Table/Column | DB Type (from migrations) | TS Type (database.ts) | Issue |
|-------------|---------------------------|----------------------|-------|
| `booking_status` enum | includes `'rejected'` (00045) | `"pending" \| "confirmed" \| "cancelled" \| "no_show" \| "completed"` | Missing `'rejected'` |
| Functions | includes `accept_applicant`, `reject_applicant` (00045) | Only 6 functions listed | Missing 2 RPCs |
| `driver_document_type` enum | 3 values (police_record removed in 00049) | `"drivers_license" \| "insurance" \| "vehicle_registration"` | ✅ Correct |

**Action:** Run `supabase gen types typescript --project-id tlggdherqjvybpddsqjj > src/types/database.ts` to sync.

---

## Summary

| Metric | Value |
|--------|-------|
| Tables with RLS | 23/23 ✅ |
| Tables without RLS | 0 |
| RLS policies reviewed | 52 |
| SECURITY DEFINER functions | 22 (18 missing SET search_path) |
| Missing FK indexes | 23+ |
| Missing CHECK constraints | 10+ tables |
| Types out of sync | 2 issues |
| Storage buckets | 3 (1 missing MIME restriction) |

### Findings by Severity

| Severity | Count | IDs |
|----------|:-----:|-----|
| Critical | 3 | C-01, C-02, C-03 |
| High | 3 | H-01, H-02, H-03 |
| Medium | 5 | M-01, M-02, M-03, M-04, M-05 |
| Low | 4 | L-01, L-02, L-03, L-04 |
| Info | 4 | I-01, I-02, I-03, I-04 |
| **Total** | **19** | |

### Recommended Fix Priority

1. **Immediate (Critical):** C-01 (profile role escalation), C-02 (document self-approval), C-03 (PII exposure)
2. **This Sprint (High):** H-01 (booking self-confirm), H-02 (anonymous rating leak), H-03 (search_path on all SECURITY DEFINER)
3. **Next Sprint (Medium):** M-01 through M-05 (dedup, indexes, constraints)
4. **Backlog (Low/Info):** L-01 through L-04, I-01 through I-04
