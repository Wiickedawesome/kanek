-- Migration A: driver lifecycle controls for routes.
--
-- Adds two RPCs that give the driver explicit control over the trip when
-- the cron-based activation logic does not match what they want:
--
--   proceed_route(p_post_id):
--     Driver-only. Force-activates a route_offer/route_request that is still
--     `open` and has at least one confirmed booking, even if seats_filled is
--     below min_riders. Notifies the driver and all confirmed riders.
--
--   cancel_route_short(p_post_id, p_reason):
--     Driver-only. Cancels a route_offer/route_request that is still `open`
--     or `activated`. Cancels every pending and confirmed booking attached to
--     it with a cancel_reason, sets the post to `cancelled`, and notifies
--     riders. Use when the driver decides not to run the trip (e.g. min_riders
--     never met).
--
-- Both RPCs are SECURITY DEFINER and verify auth.uid() = posts.author_id, so
-- RLS does not need to be relaxed.

CREATE OR REPLACE FUNCTION public.proceed_route(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_post RECORD;
  v_confirmed_count integer;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, author_id, type, title, status, seats_filled
    INTO v_post
    FROM posts
   WHERE id = p_post_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_post.author_id <> v_caller THEN
    RAISE EXCEPTION 'Only the post author can start the trip';
  END IF;

  IF v_post.type NOT IN ('route_offer', 'route_request') THEN
    RAISE EXCEPTION 'Only ride posts can be started this way';
  END IF;

  IF v_post.status <> 'open' THEN
    RAISE EXCEPTION 'Trip is not in an open state (current: %)', v_post.status;
  END IF;

  SELECT COUNT(*) INTO v_confirmed_count
    FROM bookings
   WHERE post_id = p_post_id
     AND status = 'confirmed';

  IF v_confirmed_count < 1 THEN
    RAISE EXCEPTION 'Cannot start a trip with no confirmed riders';
  END IF;

  UPDATE posts
     SET status = 'activated',
         updated_at = now()
   WHERE id = p_post_id;

  -- Notify driver
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_post.author_id,
    'route_activated',
    'Ride Started',
    'You started "' || v_post.title || '" with ' || v_confirmed_count || ' confirmed rider(s).',
    jsonb_build_object('postId', v_post.id)
  );

  -- Notify all confirmed riders
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT
    b.user_id,
    'route_activated',
    'Ride Confirmed',
    'The driver started "' || v_post.title || '". Your ride is confirmed.',
    jsonb_build_object('postId', v_post.id)
    FROM bookings b
   WHERE b.post_id = p_post_id
     AND b.status = 'confirmed';
END;
$$;

GRANT EXECUTE ON FUNCTION public.proceed_route(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.cancel_route_short(
  p_post_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_post RECORD;
  v_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'Driver cancelled the trip');
  v_now timestamptz := now();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, author_id, type, title, status
    INTO v_post
    FROM posts
   WHERE id = p_post_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_post.author_id <> v_caller THEN
    RAISE EXCEPTION 'Only the post author can cancel the trip';
  END IF;

  IF v_post.type NOT IN ('route_offer', 'route_request') THEN
    RAISE EXCEPTION 'Only ride posts can be cancelled this way';
  END IF;

  IF v_post.status NOT IN ('open', 'activated') THEN
    RAISE EXCEPTION 'Trip cannot be cancelled in its current state (%)', v_post.status;
  END IF;

  -- Cancel all confirmed bookings (the post-status trigger only rejects
  -- pending bookings; confirmed ones must be handled here).
  UPDATE bookings
     SET status = 'cancelled',
         cancel_reason = v_reason,
         cancelled_at = v_now,
         updated_at = v_now
   WHERE post_id = p_post_id
     AND status = 'confirmed';

  -- Flip the post to cancelled. The handle_post_status_change trigger will
  -- close out any remaining pending bookings.
  UPDATE posts
     SET status = 'cancelled',
         updated_at = v_now
   WHERE id = p_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_route_short(uuid, text) TO authenticated;
