-- 00013_fix_email_receipts.sql
-- Align email_receipts table with edge function and PLAN spec

-- Make contract_id nullable (ekyash refunds may not have a contract)
ALTER TABLE email_receipts ALTER COLUMN contract_id DROP NOT NULL;

-- Add ekyash_txn_id FK
ALTER TABLE email_receipts
  ADD COLUMN ekyash_txn_id uuid REFERENCES ekyash_transactions(id);

-- Rename email -> email_to to match edge function field name
ALTER TABLE email_receipts RENAME COLUMN email TO email_to;

-- Add receipt type
ALTER TABLE email_receipts
  ADD COLUMN type text NOT NULL DEFAULT 'payment';

-- Add delivery status
ALTER TABLE email_receipts
  ADD COLUMN status text NOT NULL DEFAULT 'sent';

-- Add error details for failed sends
ALTER TABLE email_receipts
  ADD COLUMN error text;

-- Index on ekyash_txn_id for lookups
CREATE INDEX idx_email_receipts_ekyash_txn ON email_receipts(ekyash_txn_id);
