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
 * Process automatic strikes for violations:
 * - late_cancel: Booking cancelled < 1 hour before departure → soft strike
 * - no_show: Booking status = no_show → hard strike
 * - driver_no_show: Driver didn't start active trip → hard strike
 *
 * Also handles strike escalation:
 * - 3 soft strikes = account restricted
 * - 1 hard strike = account suspended (pending review)
 */
const NOTIFY_USER_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-user`;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const LATE_CANCEL_WINDOW_MINUTES = 60;
const NO_START_GRACE_MINUTES = 30;
const SCHEDULED_LOOKBACK_HOURS = 48;

type NotifyPayload = {
  userId: string;
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

type StrikeReason = 'late_cancel' | 'no_show' | 'early_leave' | 'driver_no_show' | 'report';
type StrikeType = 'soft' | 'hard';

type StrikeRequest = {
  userId?: string;
  contractId?: string | null;
  reason?: StrikeReason;
};

type ProcessStrikeArgs = {
  userId: string;
  contractId?: string | null;
  reason: StrikeReason;
};

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

function getStrikeType(reason: StrikeReason): StrikeType {
  return ['no_show', 'driver_no_show'].includes(reason) ? 'hard' : 'soft';
}

function getStrikeMessage(reason: StrikeReason): string {
  const messages: Record<StrikeReason, string> = {
    late_cancel: 'You received a soft strike for cancelling less than 1 hour before departure.',
    no_show: 'You received a hard strike for not showing up.',
    early_leave: 'You received a soft strike for leaving early.',
    driver_no_show: 'You received a hard strike for not showing up as driver.',
    report: 'You received a strike based on a community report.',
  };

  return messages[reason] ?? 'You received a strike.';
}

async function processStrike(
  supabase: ReturnType<typeof createServiceClient>,
  { userId, contractId, reason }: ProcessStrikeArgs,
) {
  const existingQuery = supabase
    .from('strikes')
    .select('id')
    .eq('user_id', userId)
    .eq('reason', reason)
    .limit(1);

  if (contractId) {
    existingQuery.eq('contract_id', contractId);
  } else {
    existingQuery.is('contract_id', null);
  }

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) {
    return { created: false, reason, userId, contractId: contractId ?? null };
  }

  const strikeType = getStrikeType(reason);

  const { error: strikeError } = await supabase.from('strikes').insert({
    user_id: userId,
    contract_id: contractId || null,
    type: strikeType,
    reason,
    auto_generated: true,
  });

  if (strikeError) throw new Error(strikeError.message);

  // Count from strikes table and write the canonical counter value. The DB
  // trigger also increments, but this keeps counters correct if past rows were
  // inserted before the trigger existed.
  const field = strikeType === 'hard' ? 'strikes_hard' : 'strikes_soft';
  const { count: newCount, error: countError } = await supabase
    .from('strikes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', strikeType);

  if (countError) throw new Error('Failed to count strikes');

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_status')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('Profile not found');
  }

  const updates: Record<string, unknown> = {
    [field]: newCount ?? 0,
    updated_at: new Date().toISOString(),
  };

  if (strikeType === 'hard') {
    updates.account_status = 'suspended';
  } else if ((newCount ?? 0) >= 3 && profile.account_status === 'active') {
    updates.account_status = 'restricted';
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (profileError) throw new Error(profileError.message);

  await sendInternalNotification({
    userId,
    type: 'strike_received',
    title: `${strikeType === 'hard' ? 'Hard' : 'Soft'} Strike`,
    body: getStrikeMessage(reason),
    data: { strikeType, reason, contractId: contractId ?? null },
  });

  return {
    created: true,
    strikeType,
    reason,
    userId,
    contractId: contractId ?? null,
    newCount: newCount ?? 0,
    accountStatus: updates.account_status ?? profile.account_status,
  };
}

async function runScheduledStrikeScan(supabase: ReturnType<typeof createServiceClient>) {
  const nowMs = Date.now();
  const lookback = new Date(nowMs - SCHEDULED_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const noStartCutoff = new Date(nowMs - NO_START_GRACE_MINUTES * 60_000).toISOString();
  const results: unknown[] = [];

  const { data: cancelledBookings, error: cancelledError } = await supabase
    .from('bookings')
    .select(`
      id,
      user_id,
      cancelled_at,
      cancel_reason,
      updated_at,
      post:posts ( departure_at ),
      contract:contracts!contracts_booking_id_fkey ( id )
    `)
    .eq('status', 'cancelled')
    .gte('updated_at', lookback)
    .limit(500);

  if (cancelledError) throw new Error(cancelledError.message);

  type CancelledBooking = {
    id: string;
    user_id: string;
    cancelled_at: string | null;
    cancel_reason: string | null;
    post: { departure_at: string | null } | null;
    contract: { id: string }[] | null;
  };

  for (const booking of (cancelledBookings ?? []) as unknown as CancelledBooking[]) {
    const departureAt = booking.post?.departure_at;
    const cancelledAt = booking.cancelled_at;
    const contractId = booking.contract?.[0]?.id ?? null;
    if (!departureAt || !cancelledAt || !contractId) continue;

    const departureMs = new Date(departureAt).getTime();
    const cancelledMs = new Date(cancelledAt).getTime();
    if (Number.isNaN(departureMs) || Number.isNaN(cancelledMs)) continue;

    const lateWindowStartMs = departureMs - LATE_CANCEL_WINDOW_MINUTES * 60_000;
    if (cancelledMs >= lateWindowStartMs && cancelledMs <= departureMs) {
      results.push(await processStrike(supabase, {
        userId: booking.user_id,
        contractId,
        reason: 'late_cancel',
      }));
    }
  }

  const { data: noShowBookings, error: noShowError } = await supabase
    .from('bookings')
    .select('id, user_id, updated_at, contract:contracts!contracts_booking_id_fkey ( id )')
    .eq('status', 'no_show')
    .gte('updated_at', lookback)
    .limit(500);

  if (noShowError) throw new Error(noShowError.message);

  type NoShowBooking = {
    id: string;
    user_id: string;
    contract: { id: string }[] | null;
  };

  for (const booking of (noShowBookings ?? []) as unknown as NoShowBooking[]) {
    const contractId = booking.contract?.[0]?.id ?? null;
    if (!contractId) continue;
    results.push(await processStrike(supabase, {
      userId: booking.user_id,
      contractId,
      reason: 'no_show',
    }));
  }

  const { data: inactiveContracts, error: inactiveError } = await supabase
    .from('contracts')
    .select(`
      id,
      status,
      departure_at,
      post:posts ( id, type, author_id, departure_at ),
      booking:bookings ( id, user_id, status, cancel_reason ),
      events:contract_events ( id )
    `)
    .in('status', ['active', 'cancelled'])
    .gte('departure_at', lookback)
    .lte('departure_at', noStartCutoff)
    .limit(500);

  if (inactiveError) throw new Error(inactiveError.message);

  type InactiveContract = {
    id: string;
    status: string;
    departure_at: string | null;
    post: { id: string; type: string; author_id: string; departure_at: string | null } | null;
    booking: { id: string; user_id: string; status: string; cancel_reason: string | null } | null;
    events: { id: string }[] | null;
  };

  for (const contract of (inactiveContracts ?? []) as unknown as InactiveContract[]) {
    if ((contract.events?.length ?? 0) > 0 || !contract.post || !contract.booking) continue;
    if (contract.booking.status === 'completed' || contract.booking.status === 'no_show') continue;
    if (contract.booking.status === 'cancelled' && contract.booking.cancel_reason !== 'Automatically cancelled due to inactivity after departure time') {
      continue;
    }

    const isDriverRoute = contract.post.type === 'route_offer' || contract.post.type === 'route_request';
    const userId = contract.post.type === 'route_offer'
      ? contract.post.author_id
      : contract.booking.user_id;
    const reason: StrikeReason = isDriverRoute ? 'driver_no_show' : 'no_show';

    results.push(await processStrike(supabase, {
      userId,
      contractId: contract.id,
      reason,
    }));
  }

  return {
    checked: {
      cancelledBookings: cancelledBookings?.length ?? 0,
      noShowBookings: noShowBookings?.length ?? 0,
      inactiveContracts: inactiveContracts?.length ?? 0,
    },
    created: results.filter((result) => typeof result === 'object' && result !== null && 'created' in result && result.created === true).length,
    skipped: results.filter((result) => typeof result === 'object' && result !== null && 'created' in result && result.created === false).length,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  // Only internal (service-role) calls allowed
  const authResult = hasValidCronSecret(req)
    ? { userId: null as string | null }
    : await verifyAuthOrInternal(req);
  if ('error' in authResult) return authResult.error;
  if (authResult.userId !== null) {
    return errorResponse('Forbidden: internal-only endpoint', 403);
  }

  try {
    const supabase = createServiceClient();
    let payload: StrikeRequest = {};

    try {
      payload = (await req.json()) as StrikeRequest;
    } catch {
      payload = {};
    }

    if (payload.userId && payload.reason) {
      return jsonResponse(await processStrike(supabase, {
        userId: payload.userId,
        contractId: payload.contractId ?? null,
        reason: payload.reason,
      }));
    }

    return jsonResponse(await runScheduledStrikeScan(supabase));
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Strike processing failed',
      500,
    );
  }
});
