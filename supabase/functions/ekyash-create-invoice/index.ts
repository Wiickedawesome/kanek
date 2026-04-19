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
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  verifyAuth,
} from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
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

    // L-2: Validate UUIDs
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(contractId) || !UUID_RE.test(payerId) || !UUID_RE.test(payeeId)) {
      return errorResponse('Invalid ID format');
    }

    // L-3: Validate phone format if provided
    if (payerPhone && !/^\+501[0-9]{7}$/.test(payerPhone)) {
      return errorResponse('Invalid phone number format');
    }

    // M-1: Validate amountCents is a safe integer within range
    if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 999900) {
      return errorResponse('Invalid amount: must be between $1.00 and $9,999.00 BZD');
    }

    // Caller must be the payer
    if (callerId !== payerId) {
      return errorResponse('Forbidden: caller is not the payer', 403);
    }

    // H-3: Idempotency — reject if there's already a pending transaction for this contract
    const supabase = createServiceClient();
    const { data: existingTxn } = await supabase
      .from('ekyash_transactions')
      .select('order_id, status')
      .eq('contract_id', contractId)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (existingTxn) {
      return errorResponse('A pending payment already exists for this contract', 409, req);
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
        description: (description || `kanek payment - ${orderId}`)
          .replace(/[<>&"']/g, '')
          .slice(0, 200),
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
      return errorResponse('Database error', 500);
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
    console.error('ekyash-create-invoice error:', error);
    return errorResponse('Invoice creation failed', 500);
  }
});
