/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { verifyCallbackHash, getEkyashCredentials } from '../_shared/ekyash.ts';
import {
  createServiceClient,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
} from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  try {
    const body = await req.json();
    const { orderId, invoiceId, transactionId, statusPay, hash } = body;

    if (!orderId || !hash) {
      return errorResponse('Missing required callback fields');
    }

    // 1. Verify HMAC hash
    const { apiKey } = getEkyashCredentials();
    const dataToVerify = { orderId, invoiceId, transactionId, statusPay };
    const isValid = await verifyCallbackHash(dataToVerify, hash, apiKey);

    if (!isValid) {
      return errorResponse('Invalid callback hash', 403);
    }

    const supabase = createServiceClient();

    // Idempotency: skip if callback already processed (M-01)
    const { data: existingTxn } = await supabase
      .from('ekyash_transactions')
      .select('callback_received')
      .eq('order_id', orderId)
      .single();

    if (existingTxn?.callback_received) {
      return jsonResponse({ status: 'already_processed' });
    }

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

    // 3. If approved, process payment atomically via RPC
    if (status === 'approved') {
      const { data: result, error: rpcError } = await supabase.rpc(
        'process_ekyash_payment',
        {
          p_order_id: orderId,
          p_transaction_id: transactionId || null,
          p_callback_payload: body,
        },
      );

      if (rpcError) {
        console.error('[ekyash-callback] RPC error:', rpcError);
        return errorResponse('Payment processing failed', 500);
      }

      // Already processed (idempotent)
      if (result?.status === 'already_processed') {
        return jsonResponse({ status: 'already_processed' });
      }

      // Fire-and-forget email receipt if payer has email
      if (result?.payer_email) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        fetch(`${supabaseUrl}/functions/v1/send-email-receipt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            userId: result.payer_id,
            ekyashTxnId: result.txn_id,
            type: 'payment',
          }),
        }).catch((err) => {
          console.error('[ekyash-callback] email receipt error:', err);
        });
      }
    } else {
      // Non-approved status: just update the transaction record
      const { error: updateError } = await supabase
        .from('ekyash_transactions')
        .update({
          transaction_id: transactionId || null,
          status,
          callback_received: true,
          callback_payload: body,
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId);

      if (updateError) {
        return errorResponse('Transaction not found', 404);
      }
    }

    return jsonResponse({ status: 'ok' });
  } catch (error) {
    console.error('ekyash-callback error:', error);
    return errorResponse('Callback processing failed', 500);
  }
});
