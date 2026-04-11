/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  buildEkyashJwt,
  getEkyashApiUrl,
  getEkyashCredentials,
} from '../_shared/ekyash.ts';
import { createServiceClient, getCorsHeaders, jsonResponse, errorResponse, verifyAuth } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  const authResult = await verifyAuth(req);
  if ('error' in authResult) return authResult.error;

  try {
    const { orderId, invoiceId } = await req.json();
    if (!orderId && !invoiceId) {
      return errorResponse('Provide orderId or invoiceId');
    }

    // Validate ID formats (orderId: kn_<ts36>_<hex8> from generateOrderId)
    const ORDER_ID_RE = /^kn_[a-z0-9]+_[a-f0-9]{8}$/;
    if (orderId && !ORDER_ID_RE.test(orderId)) return errorResponse('Invalid orderId format');
    if (invoiceId && typeof invoiceId !== 'string') return errorResponse('Invalid invoiceId format');

    // Ownership check FIRST — before calling external API (M-03)
    // Use parameterized .eq() instead of .or() template literal (H-03)
    const supabase = createServiceClient();
    let txnQuery = supabase
      .from('ekyash_transactions')
      .select('payer_id, payee_id');

    if (orderId) {
      txnQuery = txnQuery.eq('order_id', orderId);
    } else {
      txnQuery = txnQuery.eq('invoice_id', invoiceId);
    }

    const { data: txn } = await txnQuery.limit(1).maybeSingle();

    if (txn && txn.payer_id !== authResult.userId && txn.payee_id !== authResult.userId) {
      return errorResponse('Forbidden', 403);
    }

    // Authorize with E-Kyash
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
    console.error('ekyash-invoice-info error:', error);
    return errorResponse('Invoice info failed', 500);
  }
});
