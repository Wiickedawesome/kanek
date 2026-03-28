-- 00008_email_receipts.sql
-- Email receipt tracking

CREATE TABLE email_receipts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contract_id    uuid NOT NULL REFERENCES contracts(id),
  email          text NOT NULL,
  resend_id      text,
  sent_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_email_receipts_user ON email_receipts(user_id);
CREATE INDEX idx_email_receipts_contract ON email_receipts(contract_id);
