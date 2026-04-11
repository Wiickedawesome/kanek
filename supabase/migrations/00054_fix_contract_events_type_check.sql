-- Fix contract_events_type_check to include all event types used by the app.
-- The original constraint (migration 00050) only allowed ride-centric types.
-- The app uses post-type-specific event sequences defined in src/lib/tripEvents.ts.

ALTER TABLE contract_events DROP CONSTRAINT IF EXISTS contract_events_type_check;

ALTER TABLE contract_events ADD CONSTRAINT contract_events_type_check
  CHECK (event_type IN (
    -- route_offer / route_request events
    'en_route', 'arrived_pickup', 'departed', 'arrived_destination',
    'driver_confirmed',
    -- errand events
    'accepted_errand', 'arrived_location', 'picked_up', 'returning', 'delivered',
    -- package events (picked_up, en_route, arrived_destination, delivered already listed)
    -- job events
    'checked_in', 'started_work', 'completed_work',
    -- legacy / original constraint types kept for backward compat
    'started_ride', 'picked_up_rider', 'completed_ride',
    -- universal events
    'cancelled', 'delayed', 'rerouted', 'emergency', 'custom'
  ));
