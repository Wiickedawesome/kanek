-- 00018_notification_preferences.sql
-- Per-type notification preferences. Stored as a JSONB map on profiles
-- where { "<type>": false } means the user has muted that type. Missing
-- keys default to enabled, so the default '{}'::jsonb keeps existing
-- behavior intact for all current users.
--
-- Critical types (sos, strike_received, account_suspended, payment_*) are
-- enforced as always-on at the application layer (notify-user edge
-- function) and ignore this map.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Constrain to JSON object (not array / scalar) so the edge function can
-- safely treat it as a map.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_notification_preferences_is_object
  CHECK (jsonb_typeof(notification_preferences) = 'object');

COMMENT ON COLUMN public.profiles.notification_preferences IS
  'Per-type notification opt-out map. Shape: { "<type>": false }. Missing keys default to enabled. Critical types are enforced as always-on by the notify-user edge function.';
