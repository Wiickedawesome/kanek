-- Contract events: progress milestones per contract (e.g. "picked_up", "en_route", "delivered")
CREATE TABLE contract_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  actor_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_events_contract ON contract_events(contract_id, created_at);

-- RLS
ALTER TABLE contract_events ENABLE ROW LEVEL SECURITY;

-- Any party on the contract can read events
CREATE POLICY "Parties can view contract events"
  ON contract_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = contract_events.contract_id
        AND auth.uid() = ANY(c.parties)
    )
  );

-- Only a party on the contract can insert events (and must be the actor)
CREATE POLICY "Parties can insert own events"
  ON contract_events FOR INSERT
  WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = contract_events.contract_id
        AND auth.uid() = ANY(c.parties)
        AND c.status = 'active'
    )
  );

-- Insert notification for the other party when an event is created
CREATE OR REPLACE FUNCTION notify_contract_event()
RETURNS TRIGGER AS $$
DECLARE
  v_contract   RECORD;
  v_party_id   uuid;
  v_actor_name text;
BEGIN
  SELECT c.parties, p.title AS post_title, p.type AS post_type
    INTO v_contract
    FROM contracts c
    LEFT JOIN posts p ON p.id = c.post_id
    WHERE c.id = NEW.contract_id;

  -- Get actor name
  SELECT COALESCE(first_name || ' ' || last_name, 'Someone')
    INTO v_actor_name
    FROM profiles WHERE id = NEW.actor_id;

  -- Notify each other party
  FOREACH v_party_id IN ARRAY v_contract.parties
  LOOP
    IF v_party_id != NEW.actor_id THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_party_id,
        'contract_event',
        v_actor_name || ' updated the trip',
        REPLACE(REPLACE(NEW.event_type, '_', ' '), 'en route', 'en route'),
        jsonb_build_object(
          'contract_id', NEW.contract_id,
          'event_type', NEW.event_type,
          'actor_id', NEW.actor_id,
          'post_title', v_contract.post_title,
          'post_type', v_contract.post_type
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_contract_event_notify
  AFTER INSERT ON contract_events
  FOR EACH ROW
  EXECUTE FUNCTION notify_contract_event();
