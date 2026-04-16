/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  createServiceClient,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
} from '../_shared/supabase.ts';

/**
 * Cron: purge-deleted-accounts
 *
 * Phase 1 (90+ days after deletion): Anonymise PII but keep records for compliance.
 * Phase 2 (1+ year after deletion):  Hard-delete auth user → CASCADE removes everything.
 *
 * Schedule via Supabase cron or external scheduler (daily recommended).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...getCorsHeaders(req),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

  // Phase 2: Hard-delete accounts older than 1 year
  const { data: purgeTargets, error: purgeErr } = await supabase
    .from('profiles')
    .select('id')
    .not('deleted_at', 'is', null)
    .lte('deleted_at', oneYearAgo);

  if (purgeErr) {
    console.error('[purge] Failed to query 1-year targets:', purgeErr.message);
  } else if (purgeTargets && purgeTargets.length > 0) {
    for (const target of purgeTargets) {
      const { error } = await supabase.auth.admin.deleteUser(target.id);
      if (error) {
        console.error('[purge] Failed to hard-delete user:', target.id, error.message);
      } else {
        console.log('[purge] Hard-deleted user:', target.id);
      }
    }
  }

  // Phase 1: Anonymise PII for accounts past 90-day recovery window
  const { data: anonTargets, error: anonErr } = await supabase
    .from('profiles')
    .select('id, first_name')
    .not('deleted_at', 'is', null)
    .lte('deleted_at', ninetyDaysAgo)
    .neq('first_name', 'Deleted')
    .gt('deleted_at', oneYearAgo);

  if (anonErr) {
    console.error('[purge] Failed to query 90-day targets:', anonErr.message);
  } else if (anonTargets && anonTargets.length > 0) {
    for (const target of anonTargets) {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: 'Deleted',
          last_name: 'User',
          phone: null,
          avatar_url: null,
          bio: null,
          account_status: 'deleted',
        })
        .eq('id', target.id);
      if (error) {
        console.error('[purge] Failed to anonymise:', target.id, error.message);
      } else {
        console.log('[purge] Anonymised user:', target.id);
      }
    }
  }

  const purgedCount = purgeTargets?.length ?? 0;
  const anonCount = anonTargets?.length ?? 0;
  return jsonResponse(
    { purged: purgedCount, anonymised: anonCount },
    200,
    req,
  );
});
