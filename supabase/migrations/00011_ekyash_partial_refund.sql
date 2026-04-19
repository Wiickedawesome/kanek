-- H-4: Support partial refunds by tracking cumulative refunded amount
-- Add refunded_amount_cents column and partially_refunded status

ALTER TABLE ekyash_transactions
  ADD COLUMN IF NOT EXISTS refunded_amount_cents integer NOT NULL DEFAULT 0;

-- Update the status check constraint to include 'partially_refunded'
-- First drop old constraint if it exists, then add new one
DO $$
BEGIN
  -- Try to drop old constraint (may not exist if status was unconstrained)
  BEGIN
    ALTER TABLE ekyash_transactions DROP CONSTRAINT IF EXISTS ekyash_transactions_status_check;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

ALTER TABLE ekyash_transactions
  ADD CONSTRAINT ekyash_transactions_status_check
  CHECK (status IN ('pending', 'approved', 'declined', 'refunded', 'partially_refunded', 'cancelled', 'expired'));
