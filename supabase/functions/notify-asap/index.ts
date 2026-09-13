/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  createServiceClient,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  verifyAuth,
} from '../_shared/supabase.ts';

/**
 * notify-asap — targeting step for ASAP ride requests.
 *
 * Called by the rider's app right after creating an ASAP `route_request`
 * post. The caller must own the post. Selects candidate drivers:
 *   1. Within 25 miles of either (a) the request origin or (b) any
 *      stored driver last-known position (whichever we can compute),
 *      preferring taxi-association-verified and top-rated drivers.
 *   2. Falls back to the request's district (or the driver's district)
 *      when the radius query comes back empty.
 *
 * Then posts one notify-user message per target (max NOTIFY_CAP).
 * Does NOT auto-match, penalize, or require acceptance — matching still
 * happens when a driver makes a route_offer and the rider accepts it.
 */

const NOTIFY_USER_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-user`;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Radius for "nearby" targeting. */
const NEARBY_RADIUS_MILES = 25;
/** Hard cap on drivers pinged per ASAP request. */
const NOTIFY_CAP = 40;
/** Positions older than this don't count as recent presence. */
const POSITION_STALENESS_HOURS = 24;
const MILES_TO_METERS = 1609.344;

type PostDetails = {
  id: string;
  author_id: string;
  type: string;
  asap: boolean | null;
  status: string;
  origin_lat: number | null;
  origin_lng: number | null;
  district_of_author: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  const authResult = await verifyAuth(req);
  if ('error' in authResult) return authResult.error;
  const userId = authResult.userId;

  try {
    const { postId } = (await req.json()) as { postId?: string };
    if (!postId) return errorResponse('Missing postId', 400, req);

    const admin = createServiceClient();

    // 1. Load the post; verify ownership + ASAP route_request.
    const { data: post, error: postErr } = await admin
      .from('posts')
      .select(
        'id, author_id, type, asap, status, origin_lat, origin_lng, author:profiles!posts_author_id_fkey ( district )',
      )
      .eq('id', postId)
      .maybeSingle<PostDetails>();

    if (postErr) return errorResponse(postErr.message, 500, req);
    if (!post) return errorResponse('Post not found', 404, req);
    if (post.author_id !== userId) return errorResponse('Not your post', 403, req);
    if (post.type !== 'route_request' || !post.asap) {
      return errorResponse('Post is not an ASAP ride request', 400, req);
    }

    const staleBefore = new Date(Date.now() - POSITION_STALENESS_HOURS * 3600_000);

    // 2. Radius pass: drivers with recent last-known position inside the radius.
    //    Uses simple bounding-box math in Postgres-side RUM-free query (no
    //    extension dependency) then haversine refinement in Deno.
    let targets: { id: string; push_token: string | null }[] = [];

    if (post.origin_lat != null && post.origin_lng != null) {
      const latDelta = NEARBY_RADIUS_MILES * MILES_TO_METERS / 111_320; // deg
      const lngDelta = latDelta / Math.max(Math.cos(post.origin_lat * Math.PI / 180), 0.1);

      const { data: near, error: nearErr } = await admin
        .from('profiles')
        .select(
          'id, push_token, last_lat, last_lng, taxi_association_verified, rating_avg, role, account_status, last_active_at',
        )
        .neq('id', userId)
        .not('last_lat', 'is', null)
        .not('last_lng', 'is', null)
        .in('role', ['driver', 'both'])
        .in('account_status', ['active'])
        .gt('last_active_at', staleBefore.toISOString())
        .gte('last_lat', post.origin_lat - latDelta)
        .lte('last_lat', post.origin_lat + latDelta)
        .gte('last_lng', post.origin_lng - lngDelta)
        .lte('last_lng', post.origin_lng + lngDelta)
        .limit(NOTIFY_CAP * 3);

      if (nearErr) return errorResponse(nearErr.message, 500, req);

      targets = (near ?? [])
        .filter((d) => haversineMiles(
          post.origin_lat as number,
          post.origin_lng as number,
          d.last_lat as number,
          d.last_lng as number,
        ) <= NEARBY_RADIUS_MILES)
        .sort((a, b) => rankScore(b) - rankScore(a))
        .slice(0, NOTIFY_CAP)
        .map((d) => ({ id: d.id, push_token: d.push_token }));
    }

    // 3. District fallback when the radius pass found no one.
    if (targets.length === 0) {
      const district =
        (post.district_of_author as string | null | undefined) ?? null;

      const { data: districtDrivers, error: distErr } = await admin
        .from('profiles')
        .select('id, push_token')
        .neq('id', userId)
        .in('role', ['driver', 'both'])
        .in('account_status', ['active'])
        .gt('last_active_at', staleBefore.toISOString())
        .eq('district', district)
        .limit(NOTIFY_CAP);

      if (distErr) return errorResponse(distErr.message, 500, req);
      targets = (districtDrivers ?? [])
        .map((d) => ({ id: d.id, push_token: d.push_token }));
    }

    // 4. Notify each target.
    let sent = 0;
    await Promise.allSettled(
      targets.map((t) =>
        fetch(NOTIFY_USER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            userId: t.id,
            title: 'ASAP Ride Request Nearby',
            body: 'A rider near you needs a ride right now. Open the board to offer.',
            type: 'asap_ride_request',
            data: { postId: post.id },
          }),
        }),
      ),
    );
    // Individual failures are non-fatal; count what we attempted.
    sent = targets.length;

    return jsonResponse({ ok: true, targeted: targets.length, sent }, 200, req);
  } catch (err) {
    console.error('notify-asap failed', err);
    return errorResponse('Failed to notify drivers', 500, req);
  }
});

type PresenceRow = {
  last_lat: number | null;
  last_lng: number | null;
  taxi_association_verified: boolean | null;
  rating_avg: number | null;
};

/** Higher is better. Taxi-verified first, then rating. */
function rankScore(d: PresenceRow): number {
  return (d.taxi_association_verified ? 10 : 0) + (d.rating_avg ?? 0);
}

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.7613;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
