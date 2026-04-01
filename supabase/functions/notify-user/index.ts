/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  createServiceClient,
  corsHeaders,
  errorResponse,
  jsonResponse,
} from '../_shared/supabase.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotifyUserPayload {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
  dedupe?: Record<string, unknown> | null;
  sendPush?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      userId,
      type,
      title,
      body,
      data,
      dedupe,
      sendPush = true,
    } = (await req.json()) as NotifyUserPayload;

    if (!userId || !type || !title) {
      return errorResponse('Missing userId, type, or title');
    }

    const supabase = createServiceClient();
    const notificationData = {
      ...(data ?? {}),
      ...(dedupe ?? {}),
    };

    let inserted = false;

    if (dedupe && Object.keys(dedupe).length > 0) {
      const { data: existing, error: existingError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .contains('data', dedupe)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        return errorResponse(existingError.message, 500);
      }

      if (!existing) {
        const { error: insertError } = await supabase.from('notifications').insert({
          user_id: userId,
          type,
          title,
          body: body ?? null,
          data: notificationData,
        });

        if (insertError) {
          return errorResponse(insertError.message, 500);
        }

        inserted = true;
      }
    } else {
      const { error: insertError } = await supabase.from('notifications').insert({
        user_id: userId,
        type,
        title,
        body: body ?? null,
        data: notificationData,
      });

      if (insertError) {
        return errorResponse(insertError.message, 500);
      }

      inserted = true;
    }

    let pushed = false;

    if (sendPush) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('push_token')
        .eq('id', userId)
        .maybeSingle();

      if (!profileError && profile?.push_token) {
        const pushRes = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: profile.push_token,
            title,
            body,
            data: notificationData,
            sound: 'default',
          }),
        });

        pushed = pushRes.ok;
      }
    }

    return jsonResponse({ inserted, pushed });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Notification send failed',
      500,
    );
  }
});