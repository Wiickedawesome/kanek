/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  createServiceClient,
  corsHeaders,
  jsonResponse,
  errorResponse,
} from '../_shared/supabase.ts';

/**
 * Recalculate a user's rating_avg and punctuality_pct after a new rating.
 *
 * rating_avg = average of all ratings.stars
 * punctuality_pct = percentage of ratings where on_time = true
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    if (!userId) return errorResponse('Missing userId');

    const supabase = createServiceClient();

    // Fetch all ratings for this user
    const { data: ratings, error: ratingsError } = await supabase
      .from('ratings')
      .select('stars, on_time')
      .eq('ratee_id', userId);

    if (ratingsError) return errorResponse(ratingsError.message, 500);

    if (!ratings || ratings.length === 0) {
      return jsonResponse({ ratingAvg: null, punctualityPct: null, totalRatings: 0 });
    }

    const totalStars = ratings.reduce((sum, r) => sum + r.stars, 0);
    const ratingAvg = Math.round((totalStars / ratings.length) * 100) / 100;

    const onTimeCount = ratings.filter((r) => r.on_time === true).length;
    const ratedWithTime = ratings.filter((r) => r.on_time !== null).length;
    const punctualityPct = ratedWithTime > 0
      ? Math.round((onTimeCount / ratedWithTime) * 100)
      : null;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        rating_avg: ratingAvg,
        punctuality_pct: punctualityPct,
        total_rides: ratings.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) return errorResponse(updateError.message, 500);

    return jsonResponse({
      ratingAvg,
      punctualityPct,
      totalRatings: ratings.length,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Rating update failed',
      500,
    );
  }
});
