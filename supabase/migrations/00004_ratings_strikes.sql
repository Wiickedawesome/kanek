-- 00004_ratings_strikes.sql
-- Bidirectional ratings and strike system

-- Enums
CREATE TYPE strike_type AS ENUM ('soft', 'hard');
CREATE TYPE strike_reason AS ENUM ('late_cancel', 'no_show', 'early_leave', 'driver_no_show', 'report');

-- Ratings table
CREATE TABLE ratings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  rater_id     uuid NOT NULL REFERENCES profiles(id),
  rated_id     uuid NOT NULL REFERENCES profiles(id),
  stars        integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
  was_on_time  boolean,
  comment      text CHECK (char_length(comment) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- One rating per rater per contract
CREATE UNIQUE INDEX idx_ratings_unique ON ratings(contract_id, rater_id);

-- Strikes table
CREATE TABLE strikes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contract_id    uuid REFERENCES contracts(id),
  type           strike_type NOT NULL,
  reason         strike_reason NOT NULL,
  auto_generated boolean DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Function to recalculate user rating after new rating
CREATE OR REPLACE FUNCTION recalculate_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE profiles SET
    rating_avg = (
      SELECT ROUND(AVG(stars)::numeric, 1)
      FROM ratings WHERE rated_id = NEW.rated_id
    ),
    punctuality_pct = (
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE was_on_time = true) / NULLIF(COUNT(*) FILTER (WHERE was_on_time IS NOT NULL), 0)
      )::integer
      FROM ratings WHERE rated_id = NEW.rated_id
    )
  WHERE id = NEW.rated_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_rating_inserted
  AFTER INSERT ON ratings
  FOR EACH ROW EXECUTE FUNCTION recalculate_rating();

-- Function to increment strike counters on profiles
CREATE OR REPLACE FUNCTION increment_strike_counter()
RETURNS trigger AS $$
BEGIN
  IF NEW.type = 'soft' THEN
    UPDATE profiles SET strikes_soft = strikes_soft + 1 WHERE id = NEW.user_id;
  ELSE
    UPDATE profiles SET strikes_hard = strikes_hard + 1 WHERE id = NEW.user_id;
  END IF;

  -- Auto-restrict on 3 soft strikes
  IF (SELECT strikes_soft FROM profiles WHERE id = NEW.user_id) >= 3 THEN
    UPDATE profiles SET account_status = 'restricted' WHERE id = NEW.user_id;
  END IF;

  -- Auto-suspend on 2 hard strikes
  IF (SELECT strikes_hard FROM profiles WHERE id = NEW.user_id) >= 2 THEN
    UPDATE profiles SET account_status = 'suspended' WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_strike_created
  AFTER INSERT ON strikes
  FOR EACH ROW EXECUTE FUNCTION increment_strike_counter();

-- Indexes
CREATE INDEX idx_ratings_rated ON ratings(rated_id);
CREATE INDEX idx_ratings_contract ON ratings(contract_id);
CREATE INDEX idx_strikes_user ON strikes(user_id);
