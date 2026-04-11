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
  // Internal-only: reject user-initiated requests
  if (authResult.userId !== null) {
    return errorResponse('Forbidden: internal-only endpoint', 403);
  }

  try {
    const { userId, title, body, data } = (await req.json()) as PushPayload;
    if (!userId || !title) return errorResponse('Missing userId or title');

    const supabase = createServiceClient();

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
