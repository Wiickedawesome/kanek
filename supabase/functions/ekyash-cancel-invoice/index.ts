/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  buildEkyashJwt,
  getEkyashApiUrl,
  getEkyashCredentials,
} from '../_shared/ekyash.ts';
import {
  createServiceClient,
  corsHeaders,
  jsonResponse,
  errorResponse,
} from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();
    if (!orderId) return errorResponse('Missing orderId');

    const supabase = createServiceClient();

    // Get the transaction to find invoiceId
    const { data: txn, error } = await supabase
      .from('ekyash_transactions')
      .select('invoice_id, status')
      .eq('order_id', orderId)
      .single();

    if (error || !txn) return errorResponse('Transaction not found', 404);
    if (txn.status !== 'pending') {
      return errorResponse('Can only cancel pending invoices');
    }
    if (!txn.invoice_id) return errorResponse('No invoice ID');

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

    // Cancel the invoice
    const cancelJwt = await buildEkyashJwt(apiKey, { mobile: '' });
    const cancelRes = await fetch(`${apiUrl}/cancel-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cancelJwt}`,
        'Accept-Language': 'En',
        'The-Timezone-IANA': 'UTC',
      },
      body: JSON.stringify({ session, invoiceId: txn.invoice_id }),
    });

    if (!cancelRes.ok) return errorResponse('Cancel failed', 502);

    // Update our record
    await supabase
      .from('ekyash_transactions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId);

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Cancel failed',
      500,
    );
  }
});
