-- 00017_add_route_metadata_columns.sql
-- Add route calculation metadata columns to posts table
-- (These were originally planned in a previous migration that was removed)

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS route_distance_km    numeric(10,2),
  ADD COLUMN IF NOT EXISTS route_duration_min   numeric(10,1),
  ADD COLUMN IF NOT EXISTS route_fuel_cost_cents integer CHECK (route_fuel_cost_cents >= 0);
