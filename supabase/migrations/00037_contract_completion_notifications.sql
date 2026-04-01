-- 00037_contract_completion_notifications.sql
-- Auto-create a rating prompt notification when a contract is completed.
-- This catches both completion paths:
--   1. Direct contract completion from the contract screen
--   2. Booking completion cascading contract status to completed

CREATE OR REPLACE FUNCTION notify_on_contract_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _completed_by uuid;
  _recipient_id uuid;
  _actor_name text;
  _post_title text;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  _completed_by := auth.uid();

  IF _completed_by IS NULL OR NOT (_completed_by = ANY(NEW.parties)) THEN
    RETURN NEW;
  END IF;

  SELECT party
    INTO _recipient_id
    FROM unnest(NEW.parties) AS party
   WHERE party <> _completed_by
   LIMIT 1;

  IF _recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), 'Someone')
    INTO _actor_name
    FROM profiles
   WHERE id = _completed_by;

  SELECT title
    INTO _post_title
    FROM posts
   WHERE id = NEW.post_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    _recipient_id,
    'contract_completed',
    'Activity Completed',
    CASE
      WHEN _post_title IS NOT NULL AND _post_title <> '' THEN
        _actor_name || ' marked "' || _post_title || '" as completed. Tap to rate them.'
      ELSE
        _actor_name || ' marked your activity as completed. Tap to rate them.'
    END,
    jsonb_build_object(
      'contractId', NEW.id,
      'ratedId', _completed_by
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contract_completed_notification ON contracts;

CREATE TRIGGER trg_contract_completed_notification
  AFTER UPDATE OF status ON contracts
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_contract_completed();