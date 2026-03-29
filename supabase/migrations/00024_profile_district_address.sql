-- 00024_profile_district_address.sql
-- Add district and address fields to profiles for location-based feed sorting

CREATE TYPE belize_district AS ENUM (
  'belize',
  'cayo',
  'corozal',
  'orange_walk',
  'stann_creek',
  'toledo'
);

ALTER TABLE profiles
  ADD COLUMN district     belize_district,
  ADD COLUMN address_line text;

CREATE INDEX idx_profiles_district ON profiles(district);
