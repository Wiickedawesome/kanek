-- 00009_rls_policies.sql
-- Row Level Security policies + driver/rider document tables + flags + admin actions

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE road_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE gas_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekyash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_receipts ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════
-- Driver details & Rider documents
-- ═══════════════════════════════════

CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE driver_details (
  id                uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  license_url       text,
  insurance_url     text,
  id_document_url   text,
  vehicle_make      text,
  vehicle_model     text,
  vehicle_year      integer,
  vehicle_color     text,
  vehicle_plate     text,
  verified          boolean DEFAULT false,
  verified_at       timestamptz,
  verified_by       uuid REFERENCES profiles(id),
  rejection_reason  text,
  review_status     review_status NOT NULL DEFAULT 'pending'
);

ALTER TABLE driver_details ENABLE ROW LEVEL SECURITY;

CREATE TABLE rider_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_url     text NOT NULL,
  verified         boolean DEFAULT false,
  review_status    review_status NOT NULL DEFAULT 'pending',
  reviewed_by      uuid REFERENCES profiles(id),
  rejection_reason text,
  uploaded_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rider_documents ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════
-- Flags (community moderation)
-- ═══════════════════════════════════

CREATE TYPE flag_target AS ENUM ('post', 'user', 'booking');
CREATE TYPE flag_reason AS ENUM ('spam', 'scam', 'harassment', 'fake_account', 'safety', 'other');
CREATE TYPE flag_status AS ENUM ('pending', 'reviewed', 'action_taken', 'dismissed');

CREATE TABLE flags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid NOT NULL REFERENCES profiles(id),
  target_type  flag_target NOT NULL,
  target_id    uuid NOT NULL,
  reason       flag_reason NOT NULL,
  description  text CHECK (char_length(description) <= 500),
  status       flag_status NOT NULL DEFAULT 'pending',
  reviewed_by  uuid REFERENCES profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE flags ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════
-- Admin actions (audit trail)
-- ═══════════════════════════════════

CREATE TYPE admin_action_type AS ENUM (
  'approve_driver', 'reject_driver',
  'approve_rider_doc', 'reject_rider_doc',
  'suspend_user', 'unsuspend_user',
  'remove_post', 'dismiss_flag', 'issue_strike'
);

CREATE TABLE admin_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES profiles(id),
  action      admin_action_type NOT NULL,
  target_type text NOT NULL,
  target_id   uuid NOT NULL,
  reason      text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════
-- Helper: check if user is admin
-- ═══════════════════════════════════

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ═══════════════════════════════════
-- PROFILES policies
-- ═══════════════════════════════════

-- Anyone authenticated can see public profile fields
CREATE POLICY "profiles_select_public" ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ═══════════════════════════════════
-- DRIVER DETAILS policies
-- ═══════════════════════════════════

CREATE POLICY "driver_details_select_own_or_admin" ON driver_details
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "driver_details_insert_own" ON driver_details
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "driver_details_update_own" ON driver_details
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ═══════════════════════════════════
-- RIDER DOCUMENTS policies
-- ═══════════════════════════════════

CREATE POLICY "rider_documents_select_own_or_admin" ON rider_documents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "rider_documents_insert_own" ON rider_documents
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ═══════════════════════════════════
-- POSTS policies
-- ═══════════════════════════════════

CREATE POLICY "posts_select_all" ON posts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "posts_insert_authenticated" ON posts
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "posts_update_author" ON posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "posts_delete_author_open" ON posts
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() AND status = 'open');

-- ═══════════════════════════════════
-- BOOKINGS policies
-- ═══════════════════════════════════

CREATE POLICY "bookings_select_involved" ON bookings
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    post_id IN (SELECT id FROM posts WHERE author_id = auth.uid())
  );

CREATE POLICY "bookings_insert_authenticated" ON bookings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bookings_update_involved" ON bookings
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() OR
    post_id IN (SELECT id FROM posts WHERE author_id = auth.uid())
  );

-- ═══════════════════════════════════
-- CONTRACTS policies
-- ═══════════════════════════════════

CREATE POLICY "contracts_select_party" ON contracts
  FOR SELECT TO authenticated
  USING (auth.uid() = ANY(parties));

-- ═══════════════════════════════════
-- RATINGS policies
-- ═══════════════════════════════════

-- Public: anyone can see ratings
CREATE POLICY "ratings_select_all" ON ratings
  FOR SELECT TO authenticated
  USING (true);

-- Insert: rater must be a party in the contract
CREATE POLICY "ratings_insert_party" ON ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    rater_id = auth.uid() AND
    contract_id IN (SELECT id FROM contracts WHERE auth.uid() = ANY(parties))
  );

-- ═══════════════════════════════════
-- STRIKES policies
-- ═══════════════════════════════════

-- Users can see their own strikes
CREATE POLICY "strikes_select_own" ON strikes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- ═══════════════════════════════════
-- ROAD REPORTS policies
-- ═══════════════════════════════════

CREATE POLICY "road_reports_select_all" ON road_reports
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "road_reports_insert_authenticated" ON road_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- ═══════════════════════════════════
-- GAS PRICES policies
-- ═══════════════════════════════════

CREATE POLICY "gas_prices_select_all" ON gas_prices
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "gas_prices_insert_authenticated" ON gas_prices
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- ═══════════════════════════════════
-- E-KYASH TRANSACTIONS policies
-- ═══════════════════════════════════

CREATE POLICY "ekyash_select_involved" ON ekyash_transactions
  FOR SELECT TO authenticated
  USING (payer_id = auth.uid() OR payee_id = auth.uid());

-- Insert/Update via service_role only (edge functions)

-- ═══════════════════════════════════
-- DONATION TOTALS policies
-- ═══════════════════════════════════

-- Anyone authenticated can read the total
CREATE POLICY "donation_totals_select_all" ON donation_totals
  FOR SELECT TO authenticated
  USING (true);

-- ═══════════════════════════════════
-- NOTIFICATIONS policies
-- ═══════════════════════════════════

CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ═══════════════════════════════════
-- WAITLIST policies
-- ═══════════════════════════════════

CREATE POLICY "waitlist_select_own" ON waitlist
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "waitlist_insert_own" ON waitlist
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "waitlist_delete_own" ON waitlist
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════
-- EMAIL RECEIPTS policies
-- ═══════════════════════════════════

CREATE POLICY "email_receipts_select_own" ON email_receipts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════
-- FLAGS policies
-- ═══════════════════════════════════

-- Anyone can submit a flag
CREATE POLICY "flags_insert_authenticated" ON flags
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Only admin can view and update flags
CREATE POLICY "flags_select_admin" ON flags
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "flags_update_admin" ON flags
  FOR UPDATE TO authenticated
  USING (is_admin());

-- ═══════════════════════════════════
-- ADMIN ACTIONS policies
-- ═══════════════════════════════════

CREATE POLICY "admin_actions_select_admin" ON admin_actions
  FOR SELECT TO authenticated
  USING (is_admin());

-- Insert via service_role only (edge functions handle admin actions)

-- ═══════════════════════════════════
-- Storage policies (documents bucket)
-- ═══════════════════════════════════

-- Create the documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder
CREATE POLICY "documents_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own documents; admin can read all
CREATE POLICY "documents_read_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents' AND
    ((storage.foldername(name))[1] = auth.uid()::text OR is_admin())
  );

-- Indexes for new tables
CREATE INDEX idx_driver_details_review ON driver_details(review_status);
CREATE INDEX idx_rider_documents_user ON rider_documents(user_id);
CREATE INDEX idx_rider_documents_review ON rider_documents(review_status);
CREATE INDEX idx_flags_status ON flags(status);
CREATE INDEX idx_flags_target ON flags(target_type, target_id);
CREATE INDEX idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX idx_admin_actions_target ON admin_actions(target_type, target_id);
