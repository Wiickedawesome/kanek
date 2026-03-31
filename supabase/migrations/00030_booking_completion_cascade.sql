-- 00030_booking_completion_cascade.sql
-- When a booking is marked 'completed', cascade to:
--   1. Associated contract → status = 'completed'
--   2. Post → status = 'completed' (if all active bookings are completed)

CREATE OR REPLACE FUNCTION handle_booking_status_change()
RETURNS trigger AS $$
DECLARE
  v_post_type text;
  v_remaining_active bigint;
BEGIN
  -- ═══════════════════════════════
  -- CANCELLATION  (existing logic)
  -- ═══════════════════════════════
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN

    SELECT type INTO v_post_type FROM posts WHERE id = NEW.post_id;

    IF v_post_type IN ('errand', 'package') THEN
      DELETE FROM contracts WHERE booking_id = NEW.id;

      SELECT count(*) INTO v_remaining_active
        FROM bookings
       WHERE post_id = NEW.post_id
         AND id != NEW.id
         AND status NOT IN ('cancelled', 'no_show', 'completed');

      IF v_remaining_active = 0 THEN
        UPDATE posts SET status = 'open' WHERE id = NEW.post_id AND status = 'filled';
      END IF;

    ELSIF v_post_type = 'route_offer' THEN
      UPDATE posts
         SET seats_filled = GREATEST(0, COALESCE(seats_filled, 0) - OLD.seats_booked),
             status = CASE
               WHEN status = 'filled' THEN 'open'
               ELSE status
             END
       WHERE id = NEW.post_id;
    END IF;
  END IF;

  -- ═══════════════════════════════
  -- COMPLETION
  -- ═══════════════════════════════
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN

    -- Mark associated contract(s) as completed
    UPDATE contracts
       SET status = 'completed',
           completed_at = now()
     WHERE booking_id = NEW.id
       AND status != 'completed';

    -- Check if any non-completed active bookings remain on this post
    SELECT count(*) INTO v_remaining_active
      FROM bookings
     WHERE post_id = NEW.post_id
       AND id != NEW.id
       AND status IN ('pending', 'confirmed');

    -- If no remaining active bookings, mark post as completed
    IF v_remaining_active = 0 THEN
      UPDATE posts
         SET status = 'completed'
       WHERE id = NEW.post_id
         AND status NOT IN ('completed', 'cancelled');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
