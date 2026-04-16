/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  createServiceClient,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  verifyAuth,
} from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...getCorsHeaders(req),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, req);
  }

  const authResult = await verifyAuth(req);
  if ('error' in authResult) return authResult.error;
  const { userId } = authResult;

  const supabase = createServiceClient();

  // Soft-delete: mark profile for deletion, revoke sessions.
  // User can sign back in within 90 days to reactivate.
  // After 90 days PII is anonymised; after 1 year hard-purge runs.
  const { error } = await supabase
    .from('profiles')
    .update({
      account_status: 'suspended_pending_deletion',
      deleted_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[delete-account] Failed to soft-delete profile:', userId, error.message);
    return errorResponse('Failed to delete account', 500, req);
  }

  // Sign out all sessions so the user is immediately logged out
  const { error: signOutErr } = await supabase.auth.admin.signOut(userId, 'global');
  if (signOutErr) {
    console.error('[delete-account] Failed to revoke sessions:', userId, signOutErr.message);
    // Non-fatal — profile is already marked
  }

  return jsonResponse({ success: true, message: 'Account scheduled for deletion. You have 90 days to sign back in to recover it.' }, 200, req);
});
