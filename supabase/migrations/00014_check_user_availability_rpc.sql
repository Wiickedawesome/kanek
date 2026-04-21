-- check_user_availability(p_user_id, p_at, p_duration_min)
--
-- Returns the user's active contracts whose time window overlaps the proposed
-- [p_at - 15min, p_at + p_duration_min + 15min] range.
--
-- SECURITY DEFINER because a post owner accepting an applicant needs to see
-- whether the applicant has conflicting commitments elsewhere — and normal
-- RLS restricts `contracts` SELECT to parties only. The function returns
-- minimal, non-PII fields (post title, type, departure time) so the caller
-- can show a meaningful warning without leaking the other counterparty.
--
-- Consistent with the client-side `getMyConflictingContracts` endpoint:
-- 15-min buffer, default duration 60 min for routes and 90 min for
-- errand/package, no check for job.

CREATE OR REPLACE FUNCTION public.check_user_availability(
  p_user_id     uuid,
  p_at          timestamptz,
  p_duration_min integer
)
RETURNS TABLE (
  contract_id   uuid,
  post_id       uuid,
  post_title    text,
  post_type     public.post_type,
  departure_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_buffer_min constant integer := 15;
  v_proposed_start timestamptz;
  v_proposed_end   timestamptz;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only allow querying availability about another user when the caller
  -- owns at least one post that user has a pending booking on. This is
  -- the accept-applicant flow — nothing else needs this level of access.
  IF v_caller <> p_user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM bookings b
       JOIN posts p ON p.id = b.post_id
       WHERE b.user_id = p_user_id
         AND b.status = 'pending'
         AND p.author_id = v_caller
    ) THEN
      RAISE EXCEPTION 'Not authorised to check availability for this user';
    END IF;
  END IF;

  v_proposed_start := p_at - make_interval(mins => v_buffer_min);
  v_proposed_end   := p_at + make_interval(mins => COALESCE(p_duration_min, 60) + v_buffer_min);

  RETURN QUERY
  SELECT
    c.id,
    p.id,
    COALESCE(p.title, 'Another trip'),
    p.type,
    COALESCE(c.departure_at, p.departure_at)
  FROM contracts c
  JOIN posts p ON p.id = c.post_id
  WHERE p_user_id = ANY (c.parties)
    AND c.status = 'active'
    AND p.type IN ('route_offer', 'route_request', 'errand', 'package')
    AND COALESCE(c.departure_at, p.departure_at) IS NOT NULL
    -- Interval overlap: other_start < proposed_end AND proposed_start < other_end
    AND (
      COALESCE(c.departure_at, p.departure_at)
        - make_interval(mins => v_buffer_min)
    ) < v_proposed_end
    AND v_proposed_start < (
      COALESCE(c.departure_at, p.departure_at)
        + make_interval(
            mins => COALESCE(p.route_duration_min,
                     CASE WHEN p.type IN ('errand','package') THEN 90 ELSE 60 END)
                    + v_buffer_min
          )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_availability(uuid, timestamptz, integer)
  TO authenticated;
