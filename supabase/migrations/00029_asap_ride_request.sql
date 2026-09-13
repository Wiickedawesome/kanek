-- 00029: ASAP ride requests + driver last-known-position presence.
--
-- 1. posts.asap — marks a route_request as "needed now". Feed bumps ASAP
--    requests to the top of their district; matching drivers get a push
--    notification from an edge function step (district + radius targeting).
--    No dispatch penalties; no_show strike types (from 00001) cover
--    accepted-but-absent drivers.
--
-- 2. profiles.last_lat / last_lng — driver presence snapshot. Written by the
--    driver app on a throttle whenever location is available; consumers
--    (notify targeting, "N drivers active nearby", feed) treat values older
--    than ~24h as stale. Readability is world-readable-anon via postgis-free
--    plain numerics; writes are owner-only via existing profile triggers.
--
-- Down: drop columns (data loss of position snapshots is acceptable — they
-- are ephemeral by design).

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS asap boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_lat numeric(10,7);
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_lng numeric(10,7);

COMMENT ON COLUMN public.posts.asap IS 'True when the ride is needed immediately (ASAP) rather than at a scheduled departure time.';
COMMENT ON COLUMN public.profiles.last_lat IS 'Driver last-known latitude, written by the driver app while location permission is granted.';
COMMENT ON COLUMN public.profiles.last_lng IS 'Driver last-known longitude, written by the driver app while location permission is granted.';
