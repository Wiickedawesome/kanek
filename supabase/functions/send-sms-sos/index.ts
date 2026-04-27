/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  createServiceClient,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  verifyAuth,
} from '../_shared/supabase.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  const authResult = await verifyAuth(req);
  if ('error' in authResult) return authResult.error;
  const { userId } = authResult;

  try {
    const { latitude, longitude } = await req.json();

    // Validate coordinates are numeric and within Belize bounds
    if (latitude !== undefined && longitude !== undefined) {
      if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
          !isFinite(latitude) || !isFinite(longitude) ||
          latitude < 15.889 || latitude > 18.497 ||
          longitude < -89.225 || longitude > -87.485) {
        return errorResponse('Invalid coordinates', 400);
      }
    }

    const supabase = createServiceClient();

    // Get user profile + emergency contact
    const { data: user, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone, email, emergency_contact')
      .eq('id', userId)
      .single();

    if (error || !user) return errorResponse('User not found', 404);
    if (!user.emergency_contact) {
      return errorResponse('No emergency contact set', 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.emergency_contact)) {
      return errorResponse('Emergency contact must be a valid email address', 400);
    }

    // H-2/H-9: Server-side rate limit — one SOS per user per 30 seconds
    const { data: recentSos } = await supabase
      .from('notifications')
      .select('created_at')
      .eq('user_id', userId)
      .eq('type', 'sos_sent')
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentSos && recentSos.length > 0) {
      const lastSosTime = new Date(recentSos[0].created_at).getTime();
      if (Date.now() - lastSosTime < 30_000) {
        return errorResponse('SOS rate limit — please wait 30 seconds', 429, req);
      }
    }

    const userName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'A kanek user';
    const mapsUrl = latitude && longitude
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : 'Location unavailable';

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'support@belizechain.org';

    if (!resendApiKey) {
      console.warn('[SOS] Resend not configured — email not sent');

      // Still record the SOS attempt
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'sos_sent',
        title: 'SOS Alert Attempted',
        body: 'Emergency alert could not be sent — email service not configured',
        data: { latitude, longitude, emergencyContact: user.emergency_contact },
      });

      return jsonResponse({ sent: false, to: user.emergency_contact, error: 'Email service not configured' }, 503, req);
    }

    const html = buildSosEmailHtml({
      userName,
      userPhone: user.phone ?? 'Not provided',
      mapsUrl,
      latitude,
      longitude,
    });

    const emailRes = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `kanek <${fromEmail}>`,
        to: [user.emergency_contact],
        subject: `kanek SOS Alert — ${userName}`,
        reply_to: user.email ?? undefined,
        html,
      }),
    });

    if (!emailRes.ok) {
      console.error('[SOS] Resend error:', await emailRes.text());

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'sos_sent',
        title: 'SOS Alert Attempted',
        body: `Emergency alert email to ${user.emergency_contact} failed to send`,
        data: { latitude, longitude, emergencyContact: user.emergency_contact },
      });

      return jsonResponse({ sent: false, to: user.emergency_contact, error: 'Email send failed' }, 503, req);
    }

    // Store the SOS event as a notification for audit
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'sos_sent',
      title: 'SOS Alert Sent',
      body: `Emergency alert email sent to ${user.emergency_contact}`,
      data: { latitude, longitude, emergencyContact: user.emergency_contact },
    });

    return jsonResponse({ sent: true, to: user.emergency_contact });
  } catch (error) {
    console.error('send-sms-sos error:', error);
    return errorResponse('SOS send failed', 500);
  }
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSosEmailHtml(params: {
  userName: string;
  userPhone: string;
  mapsUrl: string;
  latitude?: number;
  longitude?: number;
}) {
  const safeName = escapeHtml(params.userName);
  const safePhone = escapeHtml(params.userPhone);
  const safeMapsUrl = escapeHtml(params.mapsUrl);
  const safeCoords = params.latitude !== undefined && params.longitude !== undefined
    ? `${params.latitude.toFixed(6)}, ${params.longitude.toFixed(6)}`
    : 'Unavailable';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f6f6f4;font-family:Manrope,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#142800;padding:24px;text-align:center;">
      <h1 style="color:#ffffff;font-family:'Work Sans',Arial,sans-serif;margin:0;font-size:24px;">kanek SOS Alert</h1>
    </div>
    <div style="padding:32px 24px;color:#142800;">
      <p style="margin:0 0 16px;">${safeName} triggered an SOS alert in Kanek.</p>
      <p style="margin:0 0 8px;"><strong>Phone:</strong> ${safePhone}</p>
      <p style="margin:0 0 8px;"><strong>Coordinates:</strong> ${escapeHtml(safeCoords)}</p>
      <p style="margin:0 0 24px;"><strong>Map:</strong> <a href="${safeMapsUrl}">${safeMapsUrl}</a></p>
      <p style="margin:0;color:#656e5e;">This safety alert was generated from the Kanek app. If this appears urgent, contact local emergency services immediately.</p>
    </div>
  </div>
</body>
</html>`;
}
