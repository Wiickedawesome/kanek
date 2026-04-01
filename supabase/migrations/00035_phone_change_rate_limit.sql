-- 00035_phone_change_rate_limit.sql
-- Track when a user last changed their phone number for rate limiting (once per 30 days)

ALTER TABLE profiles ADD COLUMN phone_changed_at timestamptz;
