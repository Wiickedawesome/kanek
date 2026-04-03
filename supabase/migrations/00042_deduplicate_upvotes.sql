-- Migration: 00041_deduplicate_upvotes
-- Fix H-2: Add per-user deduplication for road report upvotes and gas price verifications.
-- Replaces simple counter increments with idempotent junction tables.

-- Junction table for road report upvotes
CREATE TABLE IF NOT EXISTS road_report_votes (
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES road_reports(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, report_id)
);

ALTER TABLE road_report_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "road_report_votes_insert_own" ON road_report_votes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "road_report_votes_select_own" ON road_report_votes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Junction table for gas price verifications
CREATE TABLE IF NOT EXISTS gas_price_verifications (
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_id UUID NOT NULL REFERENCES gas_prices(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, price_id)
);

ALTER TABLE gas_price_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gas_price_verifications_insert_own" ON gas_price_verifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gas_price_verifications_select_own" ON gas_price_verifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Replace upvote_road_report RPC with idempotent version
CREATE OR REPLACE FUNCTION upvote_road_report(report_id UUID)
RETURNS road_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id   UUID := auth.uid();
  updated_report road_reports;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert vote; conflict means already voted → no-op
  INSERT INTO road_report_votes (user_id, report_id)
  VALUES (caller_id, report_id)
  ON CONFLICT (user_id, report_id) DO NOTHING;

  -- Only increment counter when the insert actually happened
  IF FOUND THEN
    UPDATE road_reports
    SET upvotes = upvotes + 1
    WHERE id = report_id
    RETURNING * INTO updated_report;
  ELSE
    SELECT * INTO updated_report FROM road_reports WHERE id = report_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Road report not found';
  END IF;

  RETURN updated_report;
END;
$$;

-- Replace verify_gas_price RPC with idempotent version
CREATE OR REPLACE FUNCTION verify_gas_price(price_id UUID)
RETURNS gas_prices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id    UUID := auth.uid();
  updated_price gas_prices;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert verification; conflict means already verified → no-op
  INSERT INTO gas_price_verifications (user_id, price_id)
  VALUES (caller_id, price_id)
  ON CONFLICT (user_id, price_id) DO NOTHING;

  IF FOUND THEN
    UPDATE gas_prices
    SET verified_count = verified_count + 1
    WHERE id = price_id
    RETURNING * INTO updated_price;
  ELSE
    SELECT * INTO updated_price FROM gas_prices WHERE id = price_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gas price not found';
  END IF;

  RETURN updated_price;
END;
$$;
