-- 00003_bookings_contracts.sql
-- Bookings (joining posts) and Contracts (source of truth for agreed terms)

-- Enums
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'no_show', 'completed');
CREATE TYPE booking_role AS ENUM ('rider', 'driver');
CREATE TYPE payment_method AS ENUM ('cash', 'ekyash');
CREATE TYPE contract_status AS ENUM ('active', 'completed', 'disputed', 'cancelled');

-- Bookings table
CREATE TABLE bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id          uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role             booking_role NOT NULL,
  status           booking_status NOT NULL DEFAULT 'pending',
  seats_booked     integer DEFAULT 1 CHECK (seats_booked >= 1 AND seats_booked <= 20),
  payment_method   payment_method,
  ekyash_invoice_id text,
  cancelled_at     timestamptz,
  cancel_reason    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- No duplicate bookings on same post
CREATE UNIQUE INDEX idx_bookings_unique_user_post
  ON bookings(post_id, user_id)
  WHERE status NOT IN ('cancelled');

CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Contracts table
CREATE TABLE contracts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           uuid NOT NULL REFERENCES posts(id),
  booking_id        uuid NOT NULL REFERENCES bookings(id),
  parties           uuid[] NOT NULL,
  origin_address    text,
  origin_coords     point,
  dest_address      text,
  dest_coords       point,
  agreed_price_cents integer NOT NULL CHECK (agreed_price_cents >= 0),
  departure_at      timestamptz,
  terms             jsonb,
  status            contract_status NOT NULL DEFAULT 'active',
  created_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz
);

-- Indexes
CREATE INDEX idx_bookings_post ON bookings(post_id);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_contracts_parties ON contracts USING GIN (parties);
CREATE INDEX idx_contracts_status ON contracts(status);
