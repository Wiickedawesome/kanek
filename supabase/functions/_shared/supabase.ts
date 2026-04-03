import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Create a Supabase admin client with service_role key */
export function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/** Standard CORS headers */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

/** JSON response helper */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Error response helper */
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
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
