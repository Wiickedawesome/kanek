-- Migration: Add storage bucket policies for documents and avatars
-- The buckets were created via Supabase dashboard but lack RLS policies,
-- causing "new row violates row-level security policy" on upload.

-- Ensure buckets exist (no-op if already created via dashboard)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DOCUMENTS bucket policies (private — ID photos)
-- ============================================================

-- Users can upload documents to their own folder: {user_id}/*
CREATE POLICY "documents_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can view their own documents
CREATE POLICY "documents_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update (overwrite) their own documents
CREATE POLICY "documents_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- AVATARS bucket policies (public — profile photos)
-- ============================================================

-- Users can upload avatars to their own folder: {user_id}/*
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Anyone can view avatars (public bucket)
CREATE POLICY "avatars_select_public"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'avatars'
);

-- Users can update (overwrite) their own avatars
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
