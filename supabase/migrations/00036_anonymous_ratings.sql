-- Add anonymous option to ratings
ALTER TABLE ratings ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;
