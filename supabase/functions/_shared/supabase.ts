import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Create a Supabase admin client with service_role key */
export function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

import { timingSafeEqual } from 'https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts';

/** Allowed CORS origins */
const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'https://tlggdherqjvybpddsqjj.supabase.co',
  'https://kanek.bz',
  'https://www.kanek.bz',
];

/** Build CORS headers, restricting to allowed origins */
export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get('origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
  };
}

/** Standard CORS headers — uses restrictive origin allowlist */
export const corsHeaders = getCorsHeaders();

/** JSON response helper (pass req for origin-aware CORS) */
export function jsonResponse(data: unknown, status = 200, req?: Request): Response {
  const headers = req ? getCorsHeaders(req) : corsHeaders;
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

/** Error response helper (pass req for origin-aware CORS) */
export function errorResponse(message: string, status = 400, req?: Request): Response {
  return jsonResponse({ error: message }, status, req);
}

type AuthSuccess = { userId: string; error?: never };
type AuthFailure = { userId?: never; error: Response };

/**
 * Verify the incoming request carries a valid Supabase user JWT.
 * Returns the authenticated user's UUID on success, or an error Response on failure.
 *
 * We hit `/auth/v1/user` directly rather than using `supabase.auth.getUser(token)`
 * because older supabase-js versions do local JWT parsing that doesn't understand
 * ES256-signed tokens (the new asymmetric signing keys). The auth endpoint itself
 * handles ES256 natively.
 */
export async function verifyAuth(req: Request): Promise<AuthSuccess | AuthFailure> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: errorResponse('Missing authorization header', 401) };
  }
  const token = authHeader.slice(7);
  const user = await fetchAuthUser(token);
  if (!user) {
    return { error: errorResponse('Invalid or expired token', 401) };
  }
  return { userId: user.id };
}

/** Resolve a user from an access token by calling the auth server directly. */
async function fetchAuthUser(token: string): Promise<{ id: string } | null> {
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { id?: string };
    return body.id ? { id: body.id } : null;
  } catch {
    return null;
  }
}

/**
 * Verify the request is either from an authenticated user OR from an internal
 * edge-function-to-edge-function call carrying the service role key.
 * Returns the authenticated user's UUID (or null for internal calls) on success.
 */
export async function verifyAuthOrInternal(
  req: Request,
): Promise<{ userId: string | null; error?: never } | AuthFailure> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: errorResponse('Missing authorization header', 401) };
  }
  const token = authHeader.slice(7);
  // Internal edge-function call uses service role key as bearer token
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // M-2: Timing-safe comparison to prevent side-channel attacks
  const tokenBytes = new TextEncoder().encode(token);
  const keyBytes = new TextEncoder().encode(serviceKey);
  if (tokenBytes.length === keyBytes.length && timingSafeEqual(tokenBytes, keyBytes)) {
    return { userId: null };
  }
  const user = await fetchAuthUser(token);
  if (!user) {
    return { error: errorResponse('Invalid or expired token', 401) };
  }
  return { userId: user.id };
}
