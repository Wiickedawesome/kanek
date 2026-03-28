-- 00012_push_tokens.sql
-- Add push notification token to profiles

ALTER TABLE profiles
  ADD COLUMN push_token text;
