/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { verifyCallbackHash, getEkyashCredentials } from '../_shared/ekyash.ts';
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
    const body = await req.json();
    const { orderId, invoiceId, transactionId, statusPay, hash } = body;

    if (!orderId || !hash) {
      return errorResponse('Missing required callback fields');
    }

    // 1. Verify HMAC hash
    const { apiKey } = getEkyashCredentials();
    const dataToVerify = { orderId, invoiceId, statusPay };
    const isValid = await verifyCallbackHash(dataToVerify, hash, apiKey);

    if (!isValid) {
      return errorResponse('Invalid callback hash', 403);
    }

    const supabase = createServiceClient();

    // Map E-Kyash status to our status
    let status: 'pending' | 'approved' | 'cancelled';
    switch (statusPay) {
      case 3:
        status = 'approved';
        break;
      case 2:
        status = 'cancelled';
        break;
      default:
        status = 'pending';
    }

    // 2. Update transaction record
    const { data: txn, error: updateError } = await supabase
      .from('ekyash_transactions')
      .update({
        transaction_id: transactionId || null,
        status,
        callback_received: true,
        callback_payload: body,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
      .select()
      .single();

    if (updateError || !txn) {
      return errorResponse('Transaction not found', 404);
    }

    // 3. If approved, update booking + contract + donation counter
    if (status === 'approved') {
      // Update related booking status
      await supabase
        .from('bookings')
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('ekyash_invoice_id', invoiceId);

      // Update contract status
      await supabase
        .from('contracts')
        .update({ status: 'active' })
        .eq('id', txn.contract_id);

      // Donation counter is handled automatically by the
      // accumulate_donation() trigger on ekyash_transactions

      // 4. Create notifications for both parties
      const notifications = [
        {
          user_id: txn.payer_id,
          type: 'payment_sent',
          title: 'Payment Sent',
          body: `Your E-Kyash payment of $${(txn.amount_cents / 100).toFixed(2)} BZD was approved.`,
          data: { contractId: txn.contract_id, orderId },
        },
        {
          user_id: txn.payee_id,
          type: 'payment_received',
          title: 'Payment Received',
          body: `You received an E-Kyash payment of $${(txn.amount_cents / 100).toFixed(2)} BZD.`,
          data: { contractId: txn.contract_id, orderId },
        },
      ];

      await supabase.from('notifications').insert(notifications);

      // 5. Trigger email receipt if payer has email
      const { data: payer } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', txn.payer_id)
        .single();

      if (payer?.email) {
        // Fire-and-forget call to send-email-receipt
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        fetch(`${supabaseUrl}/functions/v1/send-email-receipt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            userId: txn.payer_id,
            ekyashTxnId: txn.id,
            type: 'payment',
          }),
        }).catch(() => {
          // Best-effort — don't fail callback on email error
        });
      }
    }

    return jsonResponse({ status: 'ok' });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Callback processing failed',
      500,
    );
  }
});
