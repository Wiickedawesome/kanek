-- Add driver-specific fields to posts for route_offer type
ALTER TABLE posts
  ADD COLUMN vehicle_description text,
  ADD COLUMN pickup_notes       text,
  ADD COLUMN is_round_trip       boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN posts.vehicle_description IS 'Driver car description (make, model, color) for route offers';
COMMENT ON COLUMN posts.pickup_notes        IS 'Specific pickup location instructions';
COMMENT ON COLUMN posts.is_round_trip       IS 'Whether the route offer includes a return trip';
