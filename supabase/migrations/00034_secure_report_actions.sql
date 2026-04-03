-- 00034_secure_report_actions.sql

-- Drop the insecure update and delete policies
DROP POLICY IF EXISTS "road_reports_update_upvote" ON road_reports;
DROP POLICY IF EXISTS "gas_prices_update_verify" ON gas_prices;
DROP POLICY IF EXISTS "road_reports_delete_authenticated" ON road_reports;

-- Re-create a safe update policy for users to edit their own reports (if they want to)
CREATE POLICY "road_reports_update_owner" ON road_reports
  FOR UPDATE TO authenticated
  USING (auth.uid() = reporter_id)
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "gas_prices_update_owner" ON gas_prices
  FOR UPDATE TO authenticated
  USING (auth.uid() = reporter_id)
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "road_reports_delete_owner" ON road_reports
  FOR DELETE TO authenticated
  USING (auth.uid() = reporter_id);

-- Secure RPC function: upvote a road report
CREATE OR REPLACE FUNCTION upvote_road_report(report_id UUID)
RETURNS road_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_report road_reports;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE road_reports
  SET upvotes = upvotes + 1
  WHERE id = report_id
  RETURNING * INTO updated_report;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Road report not found';
  END IF;

  RETURN updated_report;
END;
$$;

-- Secure RPC function: report road report gone
CREATE OR REPLACE FUNCTION report_road_report_gone(report_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INT;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the row for update
  SELECT gone_count INTO current_count
  FROM road_reports
  WHERE id = report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Road report not found';
  END IF;

  IF (current_count + 1) >= 3 THEN
    -- Delete the report if threshold reached
    DELETE FROM road_reports WHERE id = report_id;
  ELSE
    -- Increment the gone count
    UPDATE road_reports
    SET gone_count = gone_count + 1
    WHERE id = report_id;
  END IF;
END;
$$;

-- Secure RPC function: verify gas price
CREATE OR REPLACE FUNCTION verify_gas_price(price_id UUID)
RETURNS gas_prices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_price gas_prices;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE gas_prices
  SET verified_count = verified_count + 1
  WHERE id = price_id
  RETURNING * INTO updated_price;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gas price not found';
  END IF;

  RETURN updated_price;
END;
$$;