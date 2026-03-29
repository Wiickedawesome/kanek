-- 00020_fix_selfie_privacy.sql
-- Fix overly permissive selfie storage policy.
-- Old policy allowed ANY authenticated user to view ALL selfies.
-- New policy restricts access to contract parties only.

DROP POLICY IF EXISTS "parties_view_selfies" ON storage.objects;

CREATE POLICY "parties_view_selfies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'checkin-selfies'
    AND EXISTS (
      SELECT 1 FROM driver_checkins dc
      JOIN contracts c ON c.id = dc.contract_id
      WHERE dc.driver_id = (storage.foldername(name))[1]::uuid
        AND auth.uid() = ANY(c.parties)
    )
  );
