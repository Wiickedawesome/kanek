/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  buildEkyashJwt,
  getEkyashApiUrl,
  getEkyashCredentials,
} from '../_shared/ekyash.ts';
import { corsHeaders, jsonResponse, errorResponse, verifyAuth } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authResult = await verifyAuth(req);
  if ('error' in authResult) return authResult.error;

  try {
    const { orderId, invoiceId } = await req.json();
    if (!orderId && !invoiceId) {
      return errorResponse('Provide orderId or invoiceId');
    }

    // Authorize
    const { sid, pinHash, apiKey } = getEkyashCredentials();
    const apiUrl = getEkyashApiUrl();
    const authJwt = await buildEkyashJwt(apiKey, { mobile: '' });

    const authRes = await fetch(`${apiUrl}/authorization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authJwt}`,
        'Accept-Language': 'En',
        'The-Timezone-IANA': 'UTC',
      },
      body: JSON.stringify({ sid, pinHash, pushkey: '' }),
    });

    if (!authRes.ok) return errorResponse('E-Kyash auth failed', 502);
    const { session } = await authRes.json();

    // Get invoice info
    const infoJwt = await buildEkyashJwt(apiKey, { mobile: '' });
    const infoRes = await fetch(`${apiUrl}/get-invoice-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${infoJwt}`,
        'Accept-Language': 'En',
        'The-Timezone-IANA': 'UTC',
      },
      body: JSON.stringify({
        session,
        orderId: orderId || null,
        invoiceId: invoiceId || null,
      }),
    });

    if (!infoRes.ok) return errorResponse('Invoice info failed', 502);

    const data = await infoRes.json();
    return jsonResponse(data);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Invoice info failed',
      500,
    );
  }
});
