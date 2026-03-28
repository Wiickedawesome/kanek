-- 00002_posts.sql
-- Community board posts

-- Enums
CREATE TYPE post_type AS ENUM ('route_offer', 'route_request', 'errand', 'package', 'job');
CREATE TYPE post_status AS ENUM ('open', 'activated', 'in_progress', 'completed', 'cancelled', 'expired');
CREATE TYPE errand_category AS ENUM ('grocery', 'bill', 'pharmacy', 'document', 'delivery', 'food', 'hardware', 'other');
CREATE TYPE pickup_style AS ENUM ('single', 'multi_stop');

-- Posts table
CREATE TABLE posts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type             post_type NOT NULL,
  status           post_status NOT NULL DEFAULT 'open',
  title            text NOT NULL,
  description      text CHECK (char_length(description) <= 500),
  origin_address   text,
  origin_lat       numeric(10,7),
  origin_lng       numeric(10,7),
  dest_address     text,
  dest_lat         numeric(10,7),
  dest_lng         numeric(10,7),
  departure_at     timestamptz,
  price_cents      integer CHECK (price_cents >= 0 AND price_cents <= 999900),
  seats_total      integer CHECK (seats_total >= 1 AND seats_total <= 20),
  seats_filled     integer DEFAULT 0,
  min_riders       integer,
  pickup_style     pickup_style,
  errand_category  errand_category,
  errand_fee_cents integer CHECK (errand_fee_cents >= 0 AND errand_fee_cents <= 999900),
  item_cost_cents  integer CHECK (item_cost_cents >= 0),
  route_geometry   jsonb,
  expires_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Coordinate validation (must be within Belize bounding box)
ALTER TABLE posts ADD CONSTRAINT posts_origin_in_belize
  CHECK (
    origin_lat IS NULL OR (origin_lat BETWEEN 15.889 AND 18.497 AND origin_lng BETWEEN -89.225 AND -87.485)
  );

ALTER TABLE posts ADD CONSTRAINT posts_dest_in_belize
  CHECK (
    dest_lat IS NULL OR (dest_lat BETWEEN 15.889 AND 18.497 AND dest_lng BETWEEN -89.225 AND -87.485)
  );

-- Updated_at trigger
CREATE TRIGGER set_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_type ON posts(type);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_departure ON posts(departure_at) WHERE status = 'open';
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_origin_coords ON posts(origin_lat, origin_lng) WHERE origin_lat IS NOT NULL;
