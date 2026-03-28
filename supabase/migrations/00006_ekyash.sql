-- 00006_ekyash.sql
-- E-Kyash payment records and donation counter

-- Enums
CREATE TYPE ekyash_status AS ENUM ('pending', 'approved', 'cancelled', 'refunded');

-- E-Kyash transactions
CREATE TABLE ekyash_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id         uuid NOT NULL REFERENCES contracts(id),
  payer_id            uuid NOT NULL REFERENCES profiles(id),
  payee_id            uuid NOT NULL REFERENCES profiles(id),
  order_id            text UNIQUE NOT NULL,
  invoice_id          text,
  transaction_id      text,
  amount_cents        integer NOT NULL CHECK (amount_cents > 0),
  platform_fee_cents  integer NOT NULL DEFAULT 0,
  donation_cents      integer NOT NULL DEFAULT 0,
  currency            text NOT NULL DEFAULT 'BZD',
  status              ekyash_status NOT NULL DEFAULT 'pending',
  callback_received   boolean DEFAULT false,
  callback_payload    jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_ekyash_updated_at
  BEFORE UPDATE ON ekyash_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Donation counter (materialized / cached — single row)
CREATE TABLE donation_totals (
  id           integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_cents  bigint NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO donation_totals (id, total_cents) VALUES (1, 0);

-- Auto-accumulate donations on approved transactions
CREATE OR REPLACE FUNCTION accumulate_donation()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.donation_cents > 0 THEN
    UPDATE donation_totals
    SET total_cents = total_cents + NEW.donation_cents, updated_at = now()
    WHERE id = 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_ekyash_approved
  AFTER UPDATE ON ekyash_transactions
  FOR EACH ROW EXECUTE FUNCTION accumulate_donation();

-- Indexes
CREATE INDEX idx_ekyash_contract ON ekyash_transactions(contract_id);
CREATE INDEX idx_ekyash_payer ON ekyash_transactions(payer_id);
CREATE INDEX idx_ekyash_payee ON ekyash_transactions(payee_id);
CREATE INDEX idx_ekyash_order ON ekyash_transactions(order_id);
CREATE INDEX idx_ekyash_status ON ekyash_transactions(status);
