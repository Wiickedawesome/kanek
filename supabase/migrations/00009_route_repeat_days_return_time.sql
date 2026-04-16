-- Add return_time and repeat_days columns to posts for recurring route support.
-- return_time: when the driver returns (only for round trips)
-- repeat_days: bitmask or array of days the route repeats (Mon-Sun)

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS return_time timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS repeat_days smallint[] DEFAULT NULL;

COMMENT ON COLUMN public.posts.return_time IS 'Return departure time for round-trip routes';
COMMENT ON COLUMN public.posts.repeat_days IS 'Array of ISO weekday numbers (1=Mon..7=Sun) for recurring routes';
