import { supabase } from '@/lib/supabase';
import { invokeFunction } from '@/lib/invokeFunction';
import { captureError } from '@/lib/sentry';

export interface NotifyUserPayload {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
  dedupe?: Record<string, unknown> | null;
  sendPush?: boolean;
}

interface NotificationActor {
  id: string;
  name: string;
}

export async function getCurrentNotificationActor(): Promise<NotificationActor | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();

  const name = profile
    ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Someone'
    : 'Someone';

  return { id: user.id, name };
}

export async function notifyUser(payload: NotifyUserPayload) {
  const { error } = await invokeFunction('notify-user', { body: payload });

  if (error) {
    throw error;
  }
}

export interface SendPushOnlyPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Send a push notification only — no in-app notification row created.
 *  Use when the DB trigger already handles the in-app notification. */
export async function sendPushOnly(payload: SendPushOnlyPayload) {
  const { error } = await invokeFunction('send-push', { body: payload });

  if (error) {
    captureError(error, { context: 'sendPushOnly', payload });
  }
}