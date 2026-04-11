/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  createServiceClient,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  verifyAuthOrInternal,
} from '../_shared/supabase.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  const authResult = await verifyAuthOrInternal(req);
  if ('error' in authResult) return authResult.error;
  const callerId = authResult.userId; // null for internal calls

  try {
    const { userId, ekyashTxnId, contractId, type } = await req.json();
    if (!userId || !type) return errorResponse('Missing required fields');
    // Allow internal (service-role) calls; for user calls, must match userId
    if (callerId !== null && callerId !== userId) return errorResponse('Forbidden', 403);

    const supabase = createServiceClient();

    // Get user email
    const { data: user } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', userId)
      .single();

    if (!user?.email) return errorResponse('User has no email', 400);

    // Get transaction details if applicable
    let amountDisplay = '';
    let descriptionLine = '';
    let transactionRef = '';
    let feeBreakdown = '';

    if (ekyashTxnId) {
      const { data: txn } = await supabase
        .from('ekyash_transactions')
        .select('*, contracts(origin_address, dest_address)')
        .eq('id', ekyashTxnId)
        .single();

      if (txn) {
        amountDisplay = `$${(txn.amount_cents / 100).toFixed(2)} BZD`;
        transactionRef = txn.order_id;
        feeBreakdown = `Platform fee: $${(txn.platform_fee_cents / 100).toFixed(2)} | Donation: $${(txn.donation_cents / 100).toFixed(2)}`;

        const contract = txn.contracts as { origin_address?: string; dest_address?: string } | null;
        if (contract) {
          descriptionLine = `${contract.origin_address ?? ''} → ${contract.dest_address ?? ''}`;
        }
      }
    } else if (contractId) {
      const { data: contract } = await supabase
        .from('contracts')
        .select('origin_address, dest_address, agreed_price_cents')
        .eq('id', contractId)
        .single();

      if (contract) {
        amountDisplay = `$${(contract.agreed_price_cents / 100).toFixed(2)} BZD`;
        descriptionLine = `${contract.origin_address ?? ''} → ${contract.dest_address ?? ''}`;
        transactionRef = contractId;
      }
    }

    const subjectMap: Record<string, string> = {
      payment: 'Payment Receipt',
      completion: 'Trip Completed',
      refund: 'Refund Processed',
    };

    const html = buildReceiptHtml({
      userName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'kanek User',
      subject: subjectMap[type] ?? 'Receipt',
      amount: amountDisplay,
      description: descriptionLine,
      reference: transactionRef,
      feeBreakdown,
      type,
      date: new Date().toLocaleDateString('en-BZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    });

    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'receipts@kanek.bz';

    const emailRes = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `kanek <${fromEmail}>`,
        to: [user.email],
        subject: `kanek — ${subjectMap[type] ?? 'Receipt'}`,
        html,
      }),
    });

    const emailData = await emailRes.json();
    const resendId = emailData.id ?? null;
    const emailStatus = emailRes.ok ? 'sent' : 'failed';

    // Log receipt
    await supabase.from('email_receipts').insert({
      user_id: userId,
      contract_id: contractId ?? null,
      ekyash_txn_id: ekyashTxnId ?? null,
      email_to: user.email,
      type,
      resend_id: resendId,
      status: emailStatus,
      error: emailRes.ok ? null : JSON.stringify(emailData),
    });

    return jsonResponse({ sent: emailRes.ok, resendId });
  } catch (error) {
    console.error('send-email-receipt error:', error);
    return errorResponse('Email send failed', 500);
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReceiptHtml(params: {
  userName: string;
  subject: string;
  amount: string;
  description: string;
  reference: string;
  feeBreakdown: string;
  type: string;
  date: string;
}): string {
  const safe = {
    userName: escapeHtml(params.userName),
    subject: escapeHtml(params.subject),
    amount: escapeHtml(params.amount),
    description: escapeHtml(params.description),
    reference: escapeHtml(params.reference),
    feeBreakdown: escapeHtml(params.feeBreakdown),
    date: escapeHtml(params.date),
  };
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f6f6f4;font-family:Manrope,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#142800;padding:24px;text-align:center;">
      <h1 style="color:#ffffff;font-family:'Work Sans',Arial,sans-serif;margin:0;font-size:24px;">kanek</h1>
    </div>
    <div style="padding:32px 24px;">
      <h2 style="color:#142800;font-family:'Work Sans',Arial,sans-serif;margin:0 0 8px;">${safe.subject}</h2>
      <p style="color:#656e5e;margin:0 0 24px;">Hi ${safe.userName},</p>
      ${params.amount ? `
      <div style="background:#f6f6f4;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="color:#656e5e;">Amount</span>
          <strong style="color:#142800;font-size:20px;">${safe.amount}</strong>
        </div>
        ${params.description ? `<div style="margin-bottom:8px;"><span style="color:#656e5e;">Route:</span> <span style="color:#142800;">${safe.description}</span></div>` : ''}
        ${params.reference ? `<div style="margin-bottom:8px;"><span style="color:#656e5e;">Reference:</span> <span style="color:#142800;font-family:monospace;">${safe.reference}</span></div>` : ''}
        ${params.feeBreakdown ? `<div style="margin-bottom:8px;font-size:13px;color:#8b9182;">${safe.feeBreakdown}</div>` : ''}
        <div><span style="color:#656e5e;">Date:</span> <span style="color:#142800;">${safe.date}</span></div>
        <div><span style="color:#656e5e;">Payment:</span> <span style="color:#142800;">E-Kyash</span></div>
      </div>
      ` : ''}
    </div>
    <div style="background:#f6f6f4;padding:20px 24px;text-align:center;">
      <p style="color:#8b9182;font-size:13px;margin:0;">Thank you for moving Belize forward.</p>
      <p style="color:#c2c2b8;font-size:11px;margin:8px 0 0;">kanek — Community Mobility Board</p>
    </div>
  </div>
</body>
</html>`;
}
