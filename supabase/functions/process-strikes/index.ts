/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

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
    const { userId, contractId, reason } = await req.json();
    if (!userId || !reason) return errorResponse('Missing userId or reason');

    const supabase = createServiceClient();

    const strikeType = ['no_show', 'driver_no_show'].includes(reason)
      ? 'hard'
      : 'soft';

    // Insert the strike
    const { error: strikeError } = await supabase.from('strikes').insert({
      user_id: userId,
      contract_id: contractId || null,
      type: strikeType,
      reason,
      auto_generated: true,
    });

    if (strikeError) return errorResponse(strikeError.message, 500);

    // Count from strikes table — avoids TOCTOU read-increment-write race (M-03)
    const field = strikeType === 'hard' ? 'strikes_hard' : 'strikes_soft';
    const { count: newCount, error: countError } = await supabase
      .from('strikes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', strikeType);

    if (countError) return errorResponse('Failed to count strikes', 500);

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_status')
      .eq('id', userId)
      .single();

    if (!profile) {
      return errorResponse('Profile not found', 404);
    }

    const updates: Record<string, unknown> = {
      [field]: newCount ?? 0,
      updated_at: new Date().toISOString(),
    };

    // Escalation logic
    if (strikeType === 'hard') {
      updates.account_status = 'suspended';
    } else if ((newCount ?? 0) >= 3 && profile.account_status === 'active') {
      updates.account_status = 'restricted';
    }

    await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    // Notify the user
    const messages: Record<string, string> = {
      late_cancel: 'You received a soft strike for cancelling less than 1 hour before departure.',
      no_show: 'You received a hard strike for not showing up.',
      early_leave: 'You received a soft strike for leaving early.',
      driver_no_show: 'You received a hard strike for not showing up as driver.',
      report: 'You received a strike based on a community report.',
    };

    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'strike_received',
      title: `${strikeType === 'hard' ? 'Hard' : 'Soft'} Strike`,
      body: messages[reason] ?? 'You received a strike.',
      data: { strikeType, reason, contractId },
    });

    return jsonResponse({
      strikeType,
      reason,
      newCount: newCount ?? 0,
      accountStatus: updates.account_status ?? profile.account_status,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Strike processing failed',
      500,
    );
  }
});
