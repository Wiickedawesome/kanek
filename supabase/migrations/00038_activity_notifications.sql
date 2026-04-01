-- 00038_activity_notifications.sql
-- Ensure completion and cancellation notifications are created server-side,
-- regardless of which client flow triggered the change.

CREATE OR REPLACE FUNCTION handle_booking_status_change()
RETURNS trigger AS $$
DECLARE
  v_post_type text;
  v_remaining_active bigint;
  v_author_id uuid;
  v_actor_id uuid;
  v_recipient_id uuid;
  v_actor_name text;
  v_post_title text;
  v_contract_id uuid;
  v_notif_title text;
  v_notif_body text;
BEGIN
  SELECT type, author_id, title
    INTO v_post_type, v_author_id, v_post_title
    FROM posts
   WHERE id = NEW.post_id;

  -- ═══════════════════════════════
  -- CANCELLATION
  -- ═══════════════════════════════
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    v_actor_id := auth.uid();

    IF v_actor_id IS NULL THEN
      v_actor_id := NEW.user_id;
    END IF;

    IF v_actor_id != NEW.user_id AND v_actor_id != v_author_id THEN
      v_actor_id := NEW.user_id;
    END IF;

    v_recipient_id := CASE
      WHEN v_actor_id = NEW.user_id THEN v_author_id
      ELSE NEW.user_id
    END;

    -- Delete contract for this booking (all types now have contracts)
    DELETE FROM contracts WHERE booking_id = NEW.id;

    IF v_post_type = 'route_offer' THEN
      -- Decrement seats
      UPDATE posts
         SET seats_filled = GREATEST(0, COALESCE(seats_filled, 0) - OLD.seats_booked),
             status = CASE WHEN status = 'filled' THEN 'open' ELSE status END
       WHERE id = NEW.post_id;
    ELSE
      -- For all other types: re-open if no remaining active bookings
      SELECT count(*) INTO v_remaining_active
        FROM bookings
       WHERE post_id = NEW.post_id
         AND id != NEW.id
         AND status NOT IN ('cancelled', 'no_show', 'completed');

      IF v_remaining_active = 0 THEN
        UPDATE posts SET status = 'open'
         WHERE id = NEW.post_id AND status IN ('filled', 'in_progress');
      END IF;
    END IF;

    IF v_recipient_id IS NOT NULL AND v_recipient_id != v_actor_id THEN
      SELECT COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), 'Someone')
        INTO v_actor_name
        FROM profiles
       WHERE id = v_actor_id;

      v_notif_title := CASE
        WHEN v_post_type IN ('route_offer', 'route_request') THEN 'Ride Cancelled'
        WHEN v_post_type = 'package' THEN 'Delivery Cancelled'
        WHEN v_post_type = 'errand' THEN 'Errand Cancelled'
        WHEN v_post_type = 'job' THEN 'Job Cancelled'
        ELSE 'Activity Cancelled'
      END;

      v_notif_body := v_actor_name || ' cancelled ' || COALESCE('"' || v_post_title || '"', 'this activity') || '.';

      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_recipient_id,
        'booking_cancelled',
        v_notif_title,
        v_notif_body,
        jsonb_build_object(
          'postId', NEW.post_id,
          'bookingId', NEW.id,
          'actorId', v_actor_id,
          'event', 'cancelled'
        )
      );
    END IF;
  END IF;

  -- ═══════════════════════════════
  -- COMPLETION
  -- ═══════════════════════════════
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    v_actor_id := auth.uid();

    IF v_actor_id IS NULL THEN
      v_actor_id := v_author_id;
    END IF;

    IF v_actor_id != NEW.user_id AND v_actor_id != v_author_id THEN
      v_actor_id := v_author_id;
    END IF;

    v_recipient_id := CASE
      WHEN v_actor_id = NEW.user_id THEN v_author_id
      ELSE NEW.user_id
    END;

    UPDATE contracts
       SET status = 'completed', completed_at = now()
     WHERE booking_id = NEW.id AND status != 'completed';

    SELECT id INTO v_contract_id
      FROM contracts
     WHERE booking_id = NEW.id
     LIMIT 1;

    SELECT count(*) INTO v_remaining_active
      FROM bookings
     WHERE post_id = NEW.post_id
       AND id != NEW.id
       AND status IN ('pending', 'confirmed');

    IF v_remaining_active = 0 THEN
      UPDATE posts SET status = 'completed'
       WHERE id = NEW.post_id AND status NOT IN ('completed', 'cancelled');
    END IF;

    IF v_recipient_id IS NOT NULL AND v_recipient_id != v_actor_id AND v_contract_id IS NOT NULL THEN
      SELECT COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), 'Someone')
        INTO v_actor_name
        FROM profiles
       WHERE id = v_actor_id;

      v_notif_body := CASE
        WHEN v_post_title IS NOT NULL AND v_post_title <> '' THEN
          v_actor_name || ' marked "' || v_post_title || '" as completed. Tap to rate them.'
        ELSE
          v_actor_name || ' marked your activity as completed. Tap to rate them.'
      END;

      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_recipient_id,
        'contract_completed',
        'Activity Completed',
        v_notif_body,
        jsonb_build_object(
          'contractId', v_contract_id,
          'ratedId', v_actor_id,
          'postId', NEW.post_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_on_post_deleted()
RETURNS trigger AS $$
DECLARE
  v_actor_id uuid;
  v_actor_name text;
  v_booking record;
  v_notif_title text;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    v_actor_id := OLD.author_id;
  END IF;

  IF v_actor_id != OLD.author_id THEN
    v_actor_id := OLD.author_id;
  END IF;

  SELECT COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), 'Someone')
    INTO v_actor_name
    FROM profiles
   WHERE id = v_actor_id;

  v_notif_title := CASE
    WHEN OLD.type IN ('route_offer', 'route_request') THEN 'Ride Cancelled'
    WHEN OLD.type = 'package' THEN 'Delivery Cancelled'
    WHEN OLD.type = 'errand' THEN 'Errand Cancelled'
    WHEN OLD.type = 'job' THEN 'Job Cancelled'
    ELSE 'Activity Cancelled'
  END;

  FOR v_booking IN
    SELECT id, user_id
      FROM bookings
     WHERE post_id = OLD.id
       AND status IN ('pending', 'confirmed')
       AND user_id <> v_actor_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_booking.user_id,
      'post_cancelled',
      v_notif_title,
      v_actor_name || ' removed ' || COALESCE('"' || OLD.title || '"', 'an activity you were involved in') || '.',
      jsonb_build_object(
        'postId', OLD.id,
        'bookingId', v_booking.id,
        'actorId', v_actor_id,
        'event', 'post_cancelled'
      )
    );
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_contract_completed_notification ON contracts;
DROP FUNCTION IF EXISTS notify_on_contract_completed();

DROP TRIGGER IF EXISTS trg_post_deleted_notification ON posts;

CREATE TRIGGER trg_post_deleted_notification
  BEFORE DELETE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_post_deleted();