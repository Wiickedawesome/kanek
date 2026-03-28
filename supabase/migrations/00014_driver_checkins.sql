-- 00014_driver_checkins.sql
-- Driver selfie check-in for active contracts

CREATE TABLE driver_checkins (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contract_id  uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  selfie_url   text NOT NULL,
  lat          numeric(10,7),
  lng          numeric(10,7),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Each driver can only check in once per contract
CREATE UNIQUE INDEX idx_driver_checkin_unique ON driver_checkins(driver_id, contract_id);
CREATE INDEX idx_driver_checkins_contract ON driver_checkins(contract_id);

-- RLS
ALTER TABLE driver_checkins ENABLE ROW LEVEL SECURITY;

-- Drivers can insert their own check-ins
CREATE POLICY "drivers_insert_own_checkins"
  ON driver_checkins FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

-- Contract parties can view check-ins
CREATE POLICY "contract_parties_view_checkins"
  ON driver_checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = driver_checkins.contract_id
        AND auth.uid() = ANY(contracts.parties)
    )
  );

-- Storage bucket for selfie photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('checkin-selfies', 'checkin-selfies', false)
ON CONFLICT (id) DO NOTHING;

-- Drivers can upload to their own folder
CREATE POLICY "drivers_upload_selfies"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'checkin-selfies'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Contract parties can view selfie photos
CREATE POLICY "parties_view_selfies"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'checkin-selfies');
