-- 00022_taxi_associations.sql
-- Adds taxi associations directory, driver association affiliations, and document type

-- 1. Add taxi_association_card to driver_document_type enum if not exists
ALTER TYPE "public"."driver_document_type" ADD VALUE IF NOT EXISTS 'taxi_association_card';

-- 2. Create taxi_associations table
CREATE TABLE IF NOT EXISTS "public"."taxi_associations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL UNIQUE,
    "district" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE "public"."taxi_associations" ENABLE ROW LEVEL SECURITY;

-- Allow public read of active taxi associations
CREATE POLICY "taxi_associations_select"
ON "public"."taxi_associations" FOR SELECT
TO public
USING (true);

-- Allow admins to manage taxi associations
CREATE POLICY "taxi_associations_admin"
ON "public"."taxi_associations" FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "public"."profiles"
    WHERE "profiles"."id" = auth.uid()
    AND "profiles"."role" = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "public"."profiles"
    WHERE "profiles"."id" = auth.uid()
    AND "profiles"."role" = 'admin'
  )
);

-- 3. Add association fields to profiles (for safe public display on feed and public profile)
ALTER TABLE "public"."profiles"
  ADD COLUMN IF NOT EXISTS "taxi_association_name" TEXT,
  ADD COLUMN IF NOT EXISTS "taxi_association_verified" BOOLEAN NOT NULL DEFAULT false;

-- 4. Recreate profiles_public view to expose safe taxi association badge attributes
CREATE OR REPLACE VIEW "public"."profiles_public" AS
  SELECT "id",
    "first_name",
    "last_name",
    "avatar_url",
    "role",
    "account_status",
    "rating_avg",
    "punctuality_pct",
    "district",
    "address_line",
    "last_active_at",
    "created_at",
    "taxi_association_name",
    "taxi_association_verified"
  FROM "public"."profiles";

ALTER VIEW "public"."profiles_public" SET (security_invoker = true);

-- 5. Add association fields to driver_details (for private admin audit and verification)
ALTER TABLE "public"."driver_details"
  ADD COLUMN IF NOT EXISTS "taxi_association_id" UUID REFERENCES "public"."taxi_associations"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "taxi_association_name" TEXT,
  ADD COLUMN IF NOT EXISTS "taxi_association_member_id" TEXT,
  ADD COLUMN IF NOT EXISTS "taxi_association_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "taxi_association_verified_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "taxi_association_verified_by" UUID REFERENCES "public"."profiles"("id");

-- 6. Trigger to keep profiles taxi association badge attributes in sync with driver_details
CREATE OR REPLACE FUNCTION sync_driver_association_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "public"."profiles"
  SET
    taxi_association_name = COALESCE(NEW.taxi_association_name, "profiles"."taxi_association_name"),
    taxi_association_verified = NEW.taxi_association_verified
  WHERE "id" = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_driver_association ON "public"."driver_details";
CREATE TRIGGER trg_sync_driver_association
AFTER INSERT OR UPDATE OF taxi_association_name, taxi_association_verified
ON "public"."driver_details"
FOR EACH ROW
EXECUTE FUNCTION sync_driver_association_to_profile();

-- 7. Seed official 26 Belize Taxi Associations
INSERT INTO "public"."taxi_associations" ("name", "district", "address", "phone", "notes")
VALUES
  ('Bus Terminal & Market Square Taxi Cooperative Society Ltd.', 'Belize District', '111 N. Front St., Belize City', '+501 675-0702', 'Belize''s largest taxi co-op; 52 members; est. 2004; BTB Gold Standard; busterminaltaxicooperative@gmail.com'),
  ('Radisson Fort George Taxi Association', 'Belize District', '2 Marine Parade, Belize City', '+501 223-3333', 'BTB Gold Standard certified; operates at Fort George Hotel area'),
  ('Belizean Taxi Cooperative', 'Belize District', 'Corner St. Thomas & 12th St., Belize City', '+501 601-9883', 'Licensed co-op; weekdays 7AM–6PM; Sat until 8PM'),
  ('Cinderella Plaza Taxi Stand', 'Belize District', 'Cinderella Plaza, Belize City', '+501 203-3340', 'Long-established stand; also listed at Freetown Rd location'),
  ('Freetown Taxi Stall', 'Belize District', '1 Kelly St., Belize City', NULL, 'Fort George neighborhood; listed in national business directories'),
  ('Five Star Taxi Service', 'Belize District', 'N. Front St., Belize City', NULL, 'Rated 4.5★; active stand near the water taxi terminal area'),
  ('Taxi Garage Services', 'Belize District', 'Belize City', '+501 227-3031', 'Long-standing Belize City taxi dispatch'),
  ('Majestic Taxi', 'Belize District', 'Belize City', '+501 203-4465', 'Documented dispatch service, Belize City'),
  ('Ladyville Airport Taxi Association / Ladyville Airport Taxi Union', 'Belize District', 'Philip S.W. Goldson International Airport, Ladyville', '+501 225-2125', 'Official airport taxi service since 1985; BTB Gold Standard; ladyvilleairporttaxiservices@gmail.com; belizeairporttaxi.bz'),
  ('Capital Taxi Association', 'Cayo District', 'Belmopan (near Market Square)', '+501 607-7033', 'Est. ~2023; Open 24 hours; rated 4.8★'),
  ('Green Lights Taxi Stand', 'Cayo District', 'Belmopan', NULL, 'Active stand in the capital city'),
  ('Belmopan Taxi Stand', 'Cayo District', 'Belmopan Market area', NULL, 'General taxi rank serving the capital'),
  ('Santa Elena & San Ignacio Taxi Federation', 'Cayo District', 'San Ignacio / Santa Elena', NULL, 'Active federation; operates across twin towns; Facebook page active'),
  ('Savannah Taxi Association', 'Cayo District', 'San Ignacio', NULL, 'Rated 4.0★; listed in national directories'),
  ('Benque Viejo Taxi Association(s)', 'Cayo District', 'Benque Viejo del Carmen', NULL, 'Formal associations registered and licensed under Benque Viejo Town Council'),
  ('Orange Walk Premier Taxi Association', 'Orange Walk District', 'Cr. Queen Victoria Ave & Arthur St., Orange Walk Town', '+501 630-3858', 'Rated 4.3★; orange-walks-premier-taxi-association.business.site'),
  ('Orange Walk Taxi Association', 'Orange Walk District', 'Queen Victoria Ave., Orange Walk Town', NULL, 'Separately listed in FindYello national directory as a distinct association'),
  ('Corozal Taxi Association', 'Corozal District', 'Park Street, Corozal Town', '+501 422-2642', 'Listed on FYIonBelize; Mon–Fri 9AM–5PM'),
  ('Corozal Bus Terminal Taxi Association', 'Corozal District', 'Corozal Town (Bus Terminal)', NULL, 'Formally listed as an association in the national FindYello directory'),
  ('Dangriga Taxi Operators', 'Stann Creek District', 'Dangriga Town', NULL, 'Informal association; operators active and licensed under the town'),
  ('Placencia Taxi Co-operative Society Limited', 'Stann Creek District', 'Placencia Peninsula', NULL, 'Officially registered April 6, 2024 by Dept. of Co-operatives; 20 members; serving Placencia and Seine Bight'),
  ('Punta Gorda Taxi Association', 'Toledo District', 'Near Central Park, Punta Gorda Town', NULL, 'Situated near Punta Gorda Airport and Central Park'),
  ('Amber Isle Taxi', 'Belize District', 'Pescador Drive, San Pedro', NULL, 'San Pedro-based taxi service; also operates bus routes since Oct 2025'),
  ('Felix Taxi', 'Belize District', 'Pescador Dr / Pelican St, San Pedro', NULL, 'Listed in FindYello national directory'),
  ('Island Taxi', 'Belize District', 'Pescador Drive, San Pedro', NULL, 'Golf cart–based island taxi service'),
  ('Caye Caulker Taxi Service', 'Belize District', 'Caye Caulker Village', NULL, 'Golf cart taxi service; meets passengers at the water taxi dock')
ON CONFLICT ("name") DO UPDATE SET
  "district" = EXCLUDED."district",
  "address" = EXCLUDED."address",
  "phone" = EXCLUDED."phone",
  "notes" = EXCLUDED."notes",
  "is_active" = EXCLUDED."is_active";
