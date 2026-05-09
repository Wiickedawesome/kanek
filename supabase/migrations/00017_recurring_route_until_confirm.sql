-- Migration B: recurring route controls.
--
-- Adds:
--   repeat_until date            - optional end date for repeating routes
--   last_confirmed_at timestamptz - last time the driver confirmed the route
--
-- Also normalizes legacy Sunday values from 0 -> 7 so repeat_days matches
-- the original ISO weekday contract from 00009.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS repeat_until date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_confirmed_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.posts.repeat_until IS 'Optional last calendar date a recurring route should be offered';
COMMENT ON COLUMN public.posts.last_confirmed_at IS 'Last time the driver confirmed they are still offering a recurring route';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'posts_repeat_until_after_departure_check'
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_repeat_until_after_departure_check
      CHECK (
        repeat_until IS NULL
        OR departure_at IS NULL
        OR repeat_until >= (departure_at AT TIME ZONE 'UTC')::date
      ) NOT VALID;
  END IF;
END $$;

UPDATE public.posts
   SET repeat_days = array_replace(repeat_days, 0, 7)
 WHERE repeat_days IS NOT NULL
   AND 0 = ANY(repeat_days);

UPDATE public.posts
   SET last_confirmed_at = COALESCE(last_confirmed_at, updated_at, created_at)
 WHERE repeat_days IS NOT NULL
   AND array_length(repeat_days, 1) > 0
   AND last_confirmed_at IS NULL;

CREATE OR REPLACE FUNCTION public.confirm_recurring_route(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_post RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, author_id, type, repeat_days
    INTO v_post
    FROM posts
   WHERE id = p_post_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_post.author_id <> v_caller THEN
    RAISE EXCEPTION 'Only the post author can confirm the recurring route';
  END IF;

  IF v_post.type NOT IN ('route_offer', 'route_request') THEN
    RAISE EXCEPTION 'Only ride posts can be confirmed this way';
  END IF;

  IF v_post.repeat_days IS NULL OR array_length(v_post.repeat_days, 1) IS NULL THEN
    RAISE EXCEPTION 'This route is not recurring';
  END IF;

  UPDATE posts
     SET last_confirmed_at = now(),
         updated_at = now()
   WHERE id = p_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_recurring_route(uuid) TO authenticated;