import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Create a Supabase admin client with service_role key */
export function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/** Allowed CORS origins */
const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'https://tlggdherqjvybpddsqjj.supabase.co',
];

/** Build CORS headers, restricting to allowed origins */
export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get('origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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
 */
export async function verifyAuth(req: Request): Promise<AuthSuccess | AuthFailure> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: errorResponse('Missing authorization header', 401) };
  }
  const token = authHeader.slice(7);
  const supabase = createServiceClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: errorResponse('Invalid or expired token', 401) };
  }
  return { userId: user.id };
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
  if (token === serviceKey) {
    return { userId: null };
  }
  const supabase = createServiceClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: errorResponse('Invalid or expired token', 401) };
  }
  return { userId: user.id };
}
