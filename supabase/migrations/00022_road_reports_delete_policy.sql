-- 00022_road_reports_delete_policy.sql
-- Allow authenticated users to delete road reports (used when gone_count >= 5)

CREATE POLICY "road_reports_delete_authenticated" ON road_reports
  FOR DELETE TO authenticated
  USING (gone_count >= 5);
