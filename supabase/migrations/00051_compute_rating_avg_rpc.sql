-- Migration: Replace JS-side rating calculation with SQL aggregate function
-- This avoids fetching all ratings rows to the edge function

CREATE OR REPLACE FUNCTION compute_rating_avg(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg numeric;
  v_count int;
  v_punctuality int;
BEGIN
  SELECT
    ROUND(AVG(stars)::numeric, 2),
    COUNT(*)
  INTO v_avg, v_count
  FROM ratings
  WHERE rated_id = p_user_id;

  IF v_count = 0 THEN
    RETURN jsonb_build_object(
      'rating_avg', NULL,
      'punctuality_pct', NULL,
      'total_ratings', 0
    );
  END IF;

  SELECT
    CASE
      WHEN COUNT(*) FILTER (WHERE was_on_time IS NOT NULL) = 0 THEN NULL
      ELSE ROUND(
        (COUNT(*) FILTER (WHERE was_on_time = true))::numeric
        / (COUNT(*) FILTER (WHERE was_on_time IS NOT NULL))
        * 100
      )::int
    END
  INTO v_punctuality
  FROM ratings
  WHERE rated_id = p_user_id;

  -- Update profile inline
  UPDATE profiles
  SET
    rating_avg    = v_avg,
    punctuality_pct = v_punctuality,
    updated_at    = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'rating_avg', v_avg,
    'punctuality_pct', v_punctuality,
    'total_ratings', v_count
  );
END;
$$;
