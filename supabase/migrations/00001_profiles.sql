-- 00001_profiles.sql
-- User profiles table, linked to Supabase Auth

-- Enums
CREATE TYPE role AS ENUM ('rider', 'driver', 'admin');
CREATE TYPE account_status AS ENUM ('pending', 'active', 'restricted', 'suspended', 'dormant');

-- Profiles table
CREATE TABLE profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone            text UNIQUE NOT NULL,
  first_name       text,
  last_name        text,
  role             role NOT NULL DEFAULT 'rider',
  avatar_url       text,
  email            text,
  rating_avg       numeric(2,1) DEFAULT 0,
  punctuality_pct  integer DEFAULT 100,
  strikes_soft     integer DEFAULT 0,
  strikes_hard     integer DEFAULT 0,
  account_status   account_status NOT NULL DEFAULT 'pending',
  emergency_contact text,
  last_active_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on auth signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, phone)
  VALUES (NEW.id, NEW.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_account_status ON profiles(account_status);
CREATE INDEX idx_profiles_phone ON profiles(phone);
