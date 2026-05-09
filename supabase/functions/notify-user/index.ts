/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  createServiceClient,
  getCorsHeaders,
  errorResponse,
  jsonResponse,
  verifyAuthOrInternal,
} from '../_shared/supabase.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Expo accepts up to 100 messages per push request; chunk above that.
const EXPO_BATCH_SIZE = 100;

// Critical notification types that always send regardless of the user's
// per-type notification_preferences map. Safety- and account-impacting
// notifications must not be muteable.
const CRITICAL_TYPES = new Set<string>([
  'sos',
  'strike_received',
  'account_suspended',
  'account_pending_deletion',
  'payment_received',
  'payment_failed',
  'payment_refunded',
]);

function isMuted(prefs: unknown, type: string): boolean {
  if (CRITICAL_TYPES.has(type)) return false;
  if (!prefs || typeof prefs !== 'object') return false;
  const map = prefs as Record<string, unknown>;
  return map[type] === false;
}

interface NotifyUserPayload {
  userId?: string;
  userIds?: string[];
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
  dedupe?: Record<string, unknown> | null;
  sendPush?: boolean;
}

type SupabaseClient = ReturnType<typeof createServiceClient>;

interface ExpoTicket {
  status?: 'ok' | 'error';
  details?: { error?: string };
}

async function clearStaleToken(supabase: SupabaseClient, userId: string) {
  await supabase.from('profiles').update({ push_token: null }).eq('id', userId);
}

function isStaleTicketError(ticket: ExpoTicket | undefined): boolean {
  if (!ticket || ticket.status !== 'error') return false;
  const code = ticket.details?.error;
  return code === 'DeviceNotRegistered' || code === 'InvalidCredentials';
}

async function pushBatch(
  supabase: SupabaseClient,
  recipients: { userId: string; token: string }[],
  title: string,
  body: string | null | undefined,
  data: Record<string, unknown>,
): Promise<number> {
  if (recipients.length === 0) return 0;

  let pushedCount = 0;

  for (let i = 0; i < recipients.length; i += EXPO_BATCH_SIZE) {
    const chunk = recipients.slice(i, i + EXPO_BATCH_SIZE);
    const messages = chunk.map((r) => ({
      to: r.token,
      title,
      body,
      data,
      sound: 'default',
    }));

    let res: Response;
    try {
      res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
    } catch (err) {
      console.error('expo push fetch failed', err);
      continue;
    }

    if (!res.ok) {
      console.error('expo push HTTP error', res.status, await res.text());
      continue;
    }

    let payload: { data?: ExpoTicket | ExpoTicket[] };
    try {
      payload = await res.json();
    } catch (err) {
      console.error('expo push non-JSON response', err);
      continue;
    }

    const tickets: ExpoTicket[] = Array.isArray(payload?.data)
      ? payload.data
      : payload?.data
        ? [payload.data]
        : [];

    for (let j = 0; j < chunk.length; j++) {
      const ticket = tickets[j];
      if (ticket?.status === 'ok') {
        pushedCount++;
      } else if (isStaleTicketError(ticket)) {
        await clearStaleToken(supabase, chunk[j].userId);
      }
    }
  }

  return pushedCount;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  const authResult = await verifyAuthOrInternal(req);
  if ('error' in authResult) return authResult.error;
  // Internal-only: reject user-initiated requests
  if (authResult.userId !== null) {
    return errorResponse('Forbidden: internal-only endpoint', 403);
  }

  try {
    const {
      userId,
      userIds,
      type,
      title,
      body,
      data,
      dedupe,
      sendPush = true,
    } = (await req.json()) as NotifyUserPayload;

    if (!type || !title) {
      return errorResponse('Missing type or title');
    }

    // Normalize to a deduped recipient list (back-compat: single userId still works).
    const recipientList = Array.from(
      new Set(
        [
          ...(userId ? [userId] : []),
          ...(Array.isArray(userIds) ? userIds : []),
        ].filter((u): u is string => typeof u === 'string' && u.length > 0),
      ),
    );

    if (recipientList.length === 0) {
      return errorResponse('Missing userId or userIds');
    }

    const supabase = createServiceClient();
    const notificationData = {
      ...(data ?? {}),
      ...(dedupe ?? {}),
    };

    // Filter recipients by per-type notification preference. Critical types
    // bypass this check (see CRITICAL_TYPES above). We fetch profiles once
    // and reuse the rows for both the mute check and (later) push tokens.
    const { data: recipientProfiles, error: recipientProfilesError } = await supabase
      .from('profiles')
      .select('id, push_token, notification_preferences')
      .in('id', recipientList);

    if (recipientProfilesError) {
      return errorResponse(recipientProfilesError.message, 500);
    }

    const profilesById = new Map(
      (recipientProfiles ?? []).map((p) => [p.id, p] as const),
    );
    const allowedRecipients = recipientList.filter((uid) => {
      const profile = profilesById.get(uid);
      // Unknown profile (shouldn't happen) — be conservative and skip.
      if (!profile) return false;
      return !isMuted(profile.notification_preferences, type);
    });

    if (allowedRecipients.length === 0) {
      return jsonResponse({
        recipients: recipientList.length,
        inserted: 0,
        pushed: 0,
        muted: recipientList.length,
      });
    }

    // Resolve which allowed recipients still need an in-app row, honoring dedupe.
    let recipientsNeedingInsert = allowedRecipients;
    if (dedupe && Object.keys(dedupe).length > 0) {
      const { data: existing, error: existingError } = await supabase
        .from('notifications')
        .select('user_id')
        .in('user_id', allowedRecipients)
        .eq('type', type)
        .contains('data', dedupe);

      if (existingError) {
        return errorResponse(existingError.message, 500);
      }

      const dedupedSet = new Set((existing ?? []).map((r) => r.user_id));
      recipientsNeedingInsert = allowedRecipients.filter((u) => !dedupedSet.has(u));
    }

    let inserted = 0;
    if (recipientsNeedingInsert.length > 0) {
      const rows = recipientsNeedingInsert.map((uid) => ({
        user_id: uid,
        type,
        title,
        body: body ?? null,
        data: notificationData,
      }));

      const { error: insertError } = await supabase.from('notifications').insert(rows);
      if (insertError) {
        return errorResponse(insertError.message, 500);
      }
      inserted = rows.length;
    }

    let pushed = 0;
    if (sendPush) {
      const recipients = allowedRecipients
        .map((uid) => profilesById.get(uid))
        .filter((p): p is { id: string; push_token: string; notification_preferences: unknown } =>
          !!p && typeof p.push_token === 'string' && p.push_token.length > 0,
        )
        .map((p) => ({ userId: p.id, token: p.push_token }));
      pushed = await pushBatch(supabase, recipients, title, body, notificationData);
    }

    // Back-compat shape: single-recipient callers expect inserted: boolean,
    // pushed: boolean. Multi-recipient callers get counts.
    if (recipientList.length === 1) {
      return jsonResponse({ inserted: inserted > 0, pushed: pushed > 0 });
    }
    return jsonResponse({
      recipients: recipientList.length,
      inserted,
      pushed,
      muted: recipientList.length - allowedRecipients.length,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Notification send failed',
      500,
    );
  }
});
