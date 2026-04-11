/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  createServiceClient,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  verifyAuthOrInternal,
} from '../_shared/supabase.ts';

/**
 * Recalculate a user's rating_avg and punctuality_pct after a new rating.
 *
 * rating_avg = average of all ratings.stars
 * punctuality_pct = percentage of ratings where on_time = true
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  // Only internal (service-role) calls allowed
  const authResult = await verifyAuthOrInternal(req);
  if ('error' in authResult) return authResult.error;
  if (authResult.userId !== null) {
    return errorResponse('Forbidden: internal-only endpoint', 403);
  }

  try {
    const { userId } = await req.json();
    if (!userId) return errorResponse('Missing userId');

    const supabase = createServiceClient();

    // Use SQL aggregate function instead of fetching all rows
    const { data: result, error: rpcError } = await supabase.rpc(
      'compute_rating_avg',
      { p_user_id: userId },
    );

    if (rpcError) return errorResponse(rpcError.message, 500);

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Rating update failed',
      500,
    );
  }
});
