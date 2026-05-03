-- 00015_scrub_invalid_coords.sql
--
-- One-time scrub of legacy/garbage coordinates on user-generated rows.
--
-- Context: prior to this migration there was no enforcement that pinned
-- coordinates fall inside Belize, and a few rows ended up with (0,0) or
-- with values clearly outside the country (caused live tracking and
-- static map images to render the Gulf of Guinea / Africa). The mobile
-- app now validates coords at every form/picker boundary and at render
-- time, but existing rows still need cleaning.
--
-- Strategy: NULL out the lat/lng pair on offending rows rather than
-- delete the row. The rest of the post / gas-price content (text,
-- prices, schedule, etc.) is still useful; the user can re-pin the
-- location through the app.
--
-- Belize bounding box (matches BELIZE_BBOX in src/lib/constants.ts):
--   north  18.497
--   south  15.889
--   east  -87.485
--   west  -89.225
--
-- Reversible: no. The bad coordinate values are intentionally discarded.
-- A pre-migration audit query is included at the bottom (commented) so
-- operators can sample affected rows before applying.

BEGIN;

-- ---- posts.origin_*  ----------------------------------------------------
UPDATE public.posts
SET origin_lat = NULL,
    origin_lng = NULL
WHERE origin_lat IS NOT NULL
  AND origin_lng IS NOT NULL
  AND (
    origin_lat NOT BETWEEN 15.889 AND 18.497
    OR origin_lng NOT BETWEEN -89.225 AND -87.485
    OR (origin_lat = 0 AND origin_lng = 0)
  );

-- ---- posts.dest_*  ------------------------------------------------------
UPDATE public.posts
SET dest_lat = NULL,
    dest_lng = NULL
WHERE dest_lat IS NOT NULL
  AND dest_lng IS NOT NULL
  AND (
    dest_lat NOT BETWEEN 15.889 AND 18.497
    OR dest_lng NOT BETWEEN -89.225 AND -87.485
    OR (dest_lat = 0 AND dest_lng = 0)
  );

-- ---- gas_prices.station_*  ---------------------------------------------
-- station_lat / station_lng are NOT NULL on this table; bad rows are
-- deleted instead of nulled, since a gas-price report without a location
-- has no value to other users.
DELETE FROM public.gas_prices
WHERE station_lat IS NOT NULL
  AND station_lng IS NOT NULL
  AND (
    station_lat NOT BETWEEN 15.889 AND 18.497
    OR station_lng NOT BETWEEN -89.225 AND -87.485
    OR (station_lat = 0 AND station_lng = 0)
  );

COMMIT;

-- ---- Validate the existing NOT VALID bbox constraints  ------------------
-- After the scrub there should be no offending rows, so we promote the
-- existing CHECK constraints from NOT VALID -> VALID. This is run
-- outside the scrub transaction because VALIDATE acquires a SHARE
-- UPDATE EXCLUSIVE lock and we want it to be independent.
ALTER TABLE public.posts
  VALIDATE CONSTRAINT posts_origin_bbox;
ALTER TABLE public.posts
  VALIDATE CONSTRAINT posts_dest_bbox;
ALTER TABLE public.gas_prices
  VALIDATE CONSTRAINT gas_prices_bbox;

-- ---- Pre-migration audit (commented; run manually if desired) ----------
-- SELECT id, origin_lat, origin_lng, dest_lat, dest_lng FROM public.posts
--   WHERE (origin_lat IS NOT NULL AND (
--          origin_lat NOT BETWEEN 15.889 AND 18.497
--       OR origin_lng NOT BETWEEN -89.225 AND -87.485
--       OR (origin_lat = 0 AND origin_lng = 0)))
--      OR (dest_lat IS NOT NULL AND (
--          dest_lat NOT BETWEEN 15.889 AND 18.497
--       OR dest_lng NOT BETWEEN -89.225 AND -87.485
--       OR (dest_lat = 0 AND dest_lng = 0)));
--
-- SELECT id, station_name, station_lat, station_lng FROM public.gas_prices
--   WHERE station_lat NOT BETWEEN 15.889 AND 18.497
--      OR station_lng NOT BETWEEN -89.225 AND -87.485
--      OR (station_lat = 0 AND station_lng = 0);
