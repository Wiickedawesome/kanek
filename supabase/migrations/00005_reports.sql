-- 00005_reports.sql
-- Road/traffic reports and crowdsourced gas prices

-- Enums
CREATE TYPE road_report_type AS ENUM ('accident', 'checkpoint', 'traffic', 'flooding', 'construction', 'road_damage');

-- Road reports
CREATE TABLE road_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type         road_report_type NOT NULL,
  lat          numeric(10,7) NOT NULL,
  lng          numeric(10,7) NOT NULL,
  description  text CHECK (char_length(description) <= 500),
  upvotes      integer DEFAULT 1,
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT road_report_in_belize CHECK (
    lat BETWEEN 15.889 AND 18.497 AND lng BETWEEN -89.225 AND -87.485
  )
);

-- Gas prices
CREATE TABLE gas_prices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  station_name   text NOT NULL,
  station_lat    numeric(10,7) NOT NULL,
  station_lng    numeric(10,7) NOT NULL,
  regular_cents  integer,
  premium_cents  integer,
  diesel_cents   integer,
  verified_count integer DEFAULT 1,
  reported_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gas_price_in_belize CHECK (
    station_lat BETWEEN 15.889 AND 18.497 AND station_lng BETWEEN -89.225 AND -87.485
  )
);

-- Indexes
CREATE INDEX idx_road_reports_coords ON road_reports(lat, lng);
CREATE INDEX idx_road_reports_type ON road_reports(type);
CREATE INDEX idx_road_reports_expires ON road_reports(expires_at) WHERE expires_at > now();
CREATE INDEX idx_gas_prices_station ON gas_prices(station_lat, station_lng);
CREATE INDEX idx_gas_prices_recent ON gas_prices(reported_at DESC);
