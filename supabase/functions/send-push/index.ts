/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  createServiceClient,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  verifyAuthOrInternal,
} from '../_shared/supabase.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  const authResult = await verifyAuthOrInternal(req);
  if ('error' in authResult) return authResult.error;

  try {
    const { userId, title, body, data } = (await req.json()) as PushPayload;
    if (!userId || !title) return errorResponse('Missing userId or title');

    const supabase = createServiceClient();
    const callerId = authResult.userId;

    // For user-initiated calls: enforce a booking relationship between caller
    // and recipient. Internal (service-role) calls bypass this check.
    // A relationship exists when there is any bookings row where
    //   (booker = caller AND post.author = recipient)
    //   OR (booker = recipient AND post.author = caller).
    // This covers every legitimate notification path: post bookings, accept/
    // reject, contract events, and chat — all derive from a booking. Self-push
    // is allowed (e.g. test harnesses).
    if (callerId !== null && callerId !== userId) {
      const [{ count: callerBookedRecipient }, { count: recipientBookedCaller }] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, post:posts!inner(author_id)', { count: 'exact', head: true })
          .eq('user_id', callerId)
          .eq('post.author_id', userId),
        supabase
          .from('bookings')
          .select('id, post:posts!inner(author_id)', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('post.author_id', callerId),
      ]);

      if ((callerBookedRecipient ?? 0) === 0 && (recipientBookedCaller ?? 0) === 0) {
        return errorResponse('Forbidden: no relationship with recipient', 403);
      }
    }

    // Get user's push token
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', userId)
      .single();

    if (error || !profile?.push_token) {
      return jsonResponse({ sent: false, reason: 'No push token' });
    }

    // Send via Expo Push API
    const pushRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: profile.push_token,
        title,
        body,
        data: data ?? {},
        sound: 'default',
      }),
    });

    const pushData = await pushRes.json();

    return jsonResponse({ sent: pushRes.ok, ticket: pushData });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Push send failed',
      500,
    );
  }
});
