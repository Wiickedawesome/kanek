-- H-4: Support partial refunds by tracking cumulative refunded amount
-- Add partially_refunded to ekyash_status enum and add refunded_amount_cents column

-- Add new enum value (idempotent: IF NOT EXISTS prevents error on re-run)
ALTER TYPE ekyash_status ADD VALUE IF NOT EXISTS 'partially_refunded';

ALTER TABLE ekyash_transactions
  ADD COLUMN IF NOT EXISTS refunded_amount_cents integer NOT NULL DEFAULT 0;
