-- 00021_road_report_gone_count.sql
-- Add gone_count to road_reports so users can report an issue as gone.
-- After 5 "gone" reports the row is auto-deleted via app logic.

ALTER TABLE road_reports
  ADD COLUMN gone_count integer NOT NULL DEFAULT 0;
