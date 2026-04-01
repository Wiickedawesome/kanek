-- 00034_message_notifications.sql
-- Auto-create a notification when a contract message is sent

CREATE OR REPLACE FUNCTION notify_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _recipient_id uuid;
  _sender_name  text;
BEGIN
  -- Find the recipient: the contract party who is NOT the sender
  SELECT party
    INTO _recipient_id
    FROM contracts c, unnest(c.parties) AS party
   WHERE c.id = NEW.contract_id
     AND party <> NEW.sender_id
   LIMIT 1;

  -- If no recipient found (shouldn't happen), bail out
  IF _recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get sender display name
  SELECT COALESCE(p.first_name, 'Someone')
    INTO _sender_name
    FROM profiles p
   WHERE p.id = NEW.sender_id;

  -- Insert notification for recipient
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    _recipient_id,
    'new_message',
    _sender_name || ' sent you a message',
    LEFT(NEW.body, 100),
    jsonb_build_object('contract_id', NEW.contract_id, 'message_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_message_notification
  AFTER INSERT ON contract_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_new_message();
