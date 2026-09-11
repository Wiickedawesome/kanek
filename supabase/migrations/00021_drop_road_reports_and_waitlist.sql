-- 00021_drop_road_reports_and_waitlist.sql
-- Completely removes unused road reports and waitlist features.

-- 1. Drop road report vote tables (dependent on road_reports)
DROP TABLE IF EXISTS "public"."road_report_gone_votes" CASCADE;
DROP TABLE IF EXISTS "public"."road_report_votes" CASCADE;

-- 2. Drop road reports table
DROP TABLE IF EXISTS "public"."road_reports" CASCADE;

-- 3. Drop road report helper functions
DROP FUNCTION IF EXISTS "public"."report_road_report_gone"(uuid);
DROP FUNCTION IF EXISTS "public"."upvote_road_report"(uuid);

-- 4. Drop road report type enum
DROP TYPE IF EXISTS "public"."road_report_type";

-- 5. Drop waitlist table
DROP TABLE IF EXISTS "public"."waitlist" CASCADE;
