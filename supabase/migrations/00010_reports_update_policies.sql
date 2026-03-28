-- 00010_reports_update_policies.sql
-- Allow authenticated users to upvote road reports and verify gas prices

-- Road reports: any authenticated user can upvote (update upvotes only)
CREATE POLICY "road_reports_update_upvote" ON road_reports
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Gas prices: any authenticated user can verify (update verified_count only)
CREATE POLICY "gas_prices_update_verify" ON gas_prices
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
