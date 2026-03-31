-- 00033_contract_messages.sql
-- Chat messages tied to contracts for communication between parties

CREATE TABLE contract_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  sender_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body         text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 2000),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_contract_messages_contract ON contract_messages(contract_id, created_at);
CREATE INDEX idx_contract_messages_sender ON contract_messages(sender_id);

-- RLS
ALTER TABLE contract_messages ENABLE ROW LEVEL SECURITY;

-- Only contract parties can read messages
CREATE POLICY "Contract parties can read messages"
  ON contract_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts WHERE id = contract_id AND auth.uid() = ANY(parties)
    )
  );

-- Only contract parties can send messages
CREATE POLICY "Contract parties can insert messages"
  ON contract_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM contracts WHERE id = contract_id AND auth.uid() = ANY(parties)
    )
  );

-- Enable realtime for contract_messages
ALTER PUBLICATION supabase_realtime ADD TABLE contract_messages;
