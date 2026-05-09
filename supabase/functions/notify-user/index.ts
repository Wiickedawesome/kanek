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

    // Resolve which recipients still need an in-app row, honoring dedupe.
    let recipientsNeedingInsert = recipientList;
    if (dedupe && Object.keys(dedupe).length > 0) {
      const { data: existing, error: existingError } = await supabase
        .from('notifications')
        .select('user_id')
        .in('user_id', recipientList)
        .eq('type', type)
        .contains('data', dedupe);

      if (existingError) {
        return errorResponse(existingError.message, 500);
      }

      const dedupedSet = new Set((existing ?? []).map((r) => r.user_id));
      recipientsNeedingInsert = recipientList.filter((u) => !dedupedSet.has(u));
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
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, push_token')
        .in('id', recipientList);

      if (!profileError && profiles) {
        const recipients = profiles
          .filter((p): p is { id: string; push_token: string } => !!p.push_token)
          .map((p) => ({ userId: p.id, token: p.push_token }));
        pushed = await pushBatch(supabase, recipients, title, body, notificationData);
      }
    }

    // Back-compat shape: single-recipient callers expect inserted: boolean,
    // pushed: boolean. Multi-recipient callers get counts.
    if (recipientList.length === 1) {
      return jsonResponse({ inserted: inserted > 0, pushed: pushed > 0 });
    }
    return jsonResponse({ recipients: recipientList.length, inserted, pushed });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Notification send failed',
      500,
    );
  }
});
