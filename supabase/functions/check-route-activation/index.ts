/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  createServiceClient,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  verifyAuthOrInternal,
} from '../_shared/supabase.ts';

/**
 * Cron function: Check if routes with min_riders have reached their threshold.
 * If seats_filled >= min_riders, activate the route.
 * Called via pg_cron or Supabase scheduled function.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  // Internal-only: reject user-initiated requests
  const authResult = await verifyAuthOrInternal(req);
  if ('error' in authResult) return authResult.error;
  if (authResult.userId !== null) {
    return errorResponse('Forbidden: internal-only endpoint', 403);
  }

  try {
    const supabase = createServiceClient();

    // Find open routes where seats_filled >= min_riders and departure is in the future
    const { data: routes, error } = await supabase
      .from('posts')
      .select('id, author_id, title, seats_filled, min_riders, departure_at')
      .in('type', ['route_offer', 'route_request'])
      .eq('status', 'open')
      .not('min_riders', 'is', null)
      .gte('departure_at', new Date().toISOString());

    if (error) return errorResponse(error.message, 500);

    let activatedCount = 0;

    for (const route of routes ?? []) {
      if (
        route.min_riders &&
        route.seats_filled !== null &&
        route.seats_filled >= route.min_riders
      ) {
        // Activate the route
        await supabase
          .from('posts')
          .update({
            status: 'activated',
            updated_at: new Date().toISOString(),
          })
          .eq('id', route.id);

        // Notify the author
        await supabase.from('notifications').insert({
          user_id: route.author_id,
          type: 'route_activated',
          title: 'Route Activated!',
          body: `Your route "${route.title}" has reached the minimum riders and is now active.`,
          data: { postId: route.id },
        });

        // Notify all booked riders
        const { data: bookings } = await supabase
          .from('bookings')
          .select('user_id')
          .eq('post_id', route.id)
          .eq('status', 'confirmed');

        if (bookings) {
          const notifications = bookings.map((b) => ({
            user_id: b.user_id,
            type: 'route_activated',
            title: 'Route Confirmed!',
            body: `The route "${route.title}" is confirmed and will depart as scheduled.`,
            data: { postId: route.id },
          }));
          if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications);
          }
        }

        activatedCount++;
      }
    }

    return jsonResponse({ checked: routes?.length ?? 0, activated: activatedCount });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Check failed',
      500,
    );
  }
});
