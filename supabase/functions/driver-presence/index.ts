/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  createServiceClient,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  verifyAuth,
} from '../_shared/supabase.ts';

/**
 * driver-presence — "N drivers active near you" readout.
 *
 * Authenticated callers pass their current position (or a district).
 * Counts drivers (role driver/both, account active) whose stored last
 * position is within NEARBY_RADIUS_MILES and seen within
 * POSITION_STALENESS_HOURS. Falls back to district count when the radius
 * pass finds nothing; returns null count when neither finds anything so
 * the UI can hide the readout rather than show "0".
 */

const NEARBY_RADIUS_MILES = 25;
const POSITION_STALENESS_HOURS = 24;
const LAST_ACTIVE_WINDOW_MINUTES = 15;
const MILES_TO_METERS = 1609.344;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  const authResult = await verifyAuth(req);
  if ('error' in authResult) return authResult.error;

  try {
    const { lat, lng, district } = (await req.json()) as {
      lat?: number;
      lng?: number;
      district?: string;
    };

    const admin = createServiceClient();
    const stalePositionBefore = new Date(Date.now() - POSITION_STALENESS_HOURS * 3600_000).toISOString();
    const lastActiveAfter = new Date(Date.now() - LAST_ACTIVE_WINDOW_MINUTES * 60_000).toISOString();

    // Radius pass.
    if (lat != null && lng != null) {
      const latDelta = (NEARBY_RADIUS_MILES * MILES_TO_METERS) / 111_320;
      const lngDelta = latDelta / Math.max(Math.cos((lat * Math.PI) / 180), 0.1);

      const { count, error } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('role', ['driver', 'both'])
        .eq('account_status', 'active')
        .gt('last_active_at', lastActiveAfter)
        .gt('last_lat', lat - latDelta)
        .lt('last_lat', lat + latDelta)
        .gt('last_lng', lng - lngDelta)
        .lt('last_lng', lng + lngDelta);

      if (error) return errorResponse(error.message, 500, req);
      // Bounding box slightly over-counts; acceptable for a readout. RLS-safe
      // because the service client bypasses RLS by design server-side only.
      if ((count ?? 0) > 0) {
        return jsonResponse({ count, basis: 'nearby' }, 200, req);
      }
    }

    // District fallback.
    if (district) {
      const { count, error } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('role', ['driver', 'both'])
        .eq('account_status', 'active')
        .gt('last_active_at', lastActiveAfter)
        .eq('district', district);

      if (error) return errorResponse(error.message, 500, req);
      if ((count ?? 0) > 0) {
        return jsonResponse({ count, basis: 'district' }, 200, req);
      }
    }

    // Hide rather than fabricate a zero.
    return jsonResponse({ count: null, basis: null }, 200, req);
  } catch (err) {
    console.error('driver-presence failed', err);
    return errorResponse('Failed to compute driver presence', 500, req);
  }
});
