/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { timingSafeEqual } from 'https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts';

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
const NOTIFY_USER_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-user`;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type NotifyPayload = {
  userId?: string;
  userIds?: string[];
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

async function sendInternalNotification(payload: NotifyPayload) {
  try {
    const res = await fetch(NOTIFY_USER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('notify-user failed', await res.text());
    }
  } catch (error) {
    console.error('notify-user request failed', error);
  }
}

function hasValidCronSecret(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('Authorization');

  if (!cronSecret || !authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7);
  const tokenBytes = new TextEncoder().encode(token);
  const secretBytes = new TextEncoder().encode(cronSecret);

  return tokenBytes.length === secretBytes.length && timingSafeEqual(tokenBytes, secretBytes);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  // Internal-only: reject user-initiated requests
  const authResult = hasValidCronSecret(req)
    ? { userId: null as string | null }
    : await verifyAuthOrInternal(req);
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

        // Notify the author (in-app row + push)
        await sendInternalNotification({
          userId: route.author_id,
          type: 'route_activated',
          title: 'Ride Activated!',
          body: `Your ride "${route.title}" has reached the minimum riders and is now active.`,
          data: { postId: route.id },
        });

        // Notify all booked riders in a single batched push
        const { data: bookings } = await supabase
          .from('bookings')
          .select('user_id')
          .eq('post_id', route.id)
          .eq('status', 'confirmed');

        if (bookings && bookings.length > 0) {
          await sendInternalNotification({
            userIds: bookings.map((b) => b.user_id),
            type: 'route_activated',
            title: 'Ride Confirmed!',
            body: `The ride "${route.title}" is confirmed and will depart as scheduled.`,
            data: { postId: route.id },
          });
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
