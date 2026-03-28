-- 00011_job_fields.sql
-- Add job-specific columns to posts table

CREATE TYPE job_category AS ENUM (
  'skilled_trade',
  'cleaning',
  'delivery',
  'handyman',
  'landscaping',
  'moving',
  'tutoring',
  'tech',
  'other'
);

CREATE TYPE pay_type AS ENUM ('hourly', 'fixed');
CREATE TYPE job_timeline AS ENUM ('asap', 'today', 'this_week', 'flexible');

ALTER TABLE posts
  ADD COLUMN job_category   job_category,
  ADD COLUMN pay_rate_cents  integer CHECK (pay_rate_cents >= 0 AND pay_rate_cents <= 999900),
  ADD COLUMN pay_type        pay_type,
  ADD COLUMN job_timeline    job_timeline;
