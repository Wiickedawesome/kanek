/**
 * Typed wrapper for invoking Supabase Edge Functions.
 *
 * We bypass `supabase.functions.invoke` and use plain `fetch` so we have full
 * control over the Authorization header. Reason: the Supabase gateway rejects
 * any Bearer token that isn't a classic JWT with `UNAUTHORIZED_INVALID_JWT_FORMAT`.
 * Projects using the new `sb_publishable_...` API key format can't use that key
 * as the Bearer — only the user's session access token (or the legacy anon JWT)
 * will pass the gateway check.
 *
 * Behaviour:
 *   - If signed in: `Authorization: Bearer <user_access_token>` → gateway OK,
 *     edge function's `verifyAuth` sees the real user.
 *   - If not signed in: no Authorization header is sent. Functions that require
 *     auth will return 401 from `verifyAuth`; functions that are public can
 *     still run.
 *   - `apikey` is always sent (required by the gateway to identify the project).
 */
import { supabase } from './supabase';

type InvokeOpts = {
  body?: unknown;
  headers?: Record<string, string>;
  method?: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE';
};

type InvokeResult<T> = { data: T | null; error: { message: string; status?: number } | null };

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export async function invokeFunction<T = unknown>(
  name: string,
  opts: InvokeOpts = {},
): Promise<InvokeResult<T>> {
  const { data: { session } } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    ...(opts.headers ?? {}),
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  let body: BodyInit | undefined;
  if (opts.body !== undefined && opts.body !== null) {
    if (typeof opts.body === 'string' || opts.body instanceof FormData) {
      body = opts.body;
    } else {
      body = JSON.stringify(opts.body);
    }
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: opts.method ?? 'POST',
      headers,
      body,
    });

    const contentType = res.headers.get('content-type') ?? '';
    const raw = contentType.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
      const message =
        typeof raw === 'object' && raw
          ? (raw as { message?: string; error?: string }).message ??
            (raw as { message?: string; error?: string }).error ??
            `HTTP ${res.status}`
          : typeof raw === 'string' && raw
            ? raw
            : `HTTP ${res.status}`;
      return { data: null, error: { message, status: res.status } };
    }

    return { data: raw as T, error: null };
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : 'Network error' },
    };
  }
}
