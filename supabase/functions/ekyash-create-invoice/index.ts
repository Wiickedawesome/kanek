/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  buildEkyashJwt,
  generateOrderId,
  calculateFees,
  getEkyashApiUrl,
  getEkyashCredentials,
} from '../_shared/ekyash.ts';
import {
  createServiceClient,
  corsHeaders,
  jsonResponse,
  errorResponse,
  verifyAuth,
} from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authResult = await verifyAuth(req);
  if ('error' in authResult) return authResult.error;
  const { userId: callerId } = authResult;

  try {
    const {
      contractId,
      payerId,
      payeeId,
      amountCents,
      description,
      payerPhone,
    } = await req.json();

    if (!contractId || !payerId || !payeeId || !amountCents) {
      return errorResponse('Missing required fields');
    }

    // Caller must be the payer
    if (callerId !== payerId) {
      return errorResponse('Forbidden: caller is not the payer', 403);
    }

    const { sid, pinHash, apiKey } = getEkyashCredentials();
    const apiUrl = getEkyashApiUrl();

    // 1. Authorize with E-Kyash
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

    if (!authRes.ok) {
      return errorResponse('E-Kyash authorization failed', 502);
    }

    const { session } = await authRes.json();

    // 2. Create invoice
    const orderId = generateOrderId();
    const { platformFeeCents, donationCents } = calculateFees(amountCents);

    const invoiceJwt = await buildEkyashJwt(apiKey, { mobile: '' });
    const invoiceRes = await fetch(`${apiUrl}/create-new-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${invoiceJwt}`,
        'Accept-Language': 'En',
        'The-Timezone-IANA': 'UTC',
      },
      body: JSON.stringify({
        session,
        orderId,
        amount: amountCents,
        currency: 'BZD',
        description: description || `kanek payment - ${orderId}`,
        payer: payerPhone || null,
        longTerm: false,
        receipt: null,
        dateLife: null,
        fieldsOther: { contractId },
        fieldsApp: null,
      }),
    });

    if (!invoiceRes.ok) {
      const text = await invoiceRes.text();
      return errorResponse(`Invoice creation failed: ${text}`, 502);
    }

    const invoiceData = await invoiceRes.json();

    // 3. Store transaction record
    const supabase = createServiceClient();
    const { error: dbError } = await supabase
      .from('ekyash_transactions')
      .insert({
        contract_id: contractId,
        payer_id: payerId,
        payee_id: payeeId,
        order_id: orderId,
        invoice_id: invoiceData.invoiceId,
        amount_cents: amountCents,
        platform_fee_cents: platformFeeCents,
        donation_cents: donationCents,
        currency: 'BZD',
        status: 'pending',
      });

    if (dbError) {
      return errorResponse(`Database error: ${dbError.message}`, 500);
    }

    return jsonResponse({
      orderId,
      invoiceId: invoiceData.invoiceId,
      qrUrl: invoiceData.qrUrl,
      paymentLink: invoiceData.paymentLink || null,
      amountCents,
      platformFeeCents,
      donationCents,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Invoice creation failed',
      500,
    );
  }
});
