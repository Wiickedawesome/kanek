/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

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
      .select('first_name, last_name, phone, emergency_contact')
      .eq('id', userId)
      .single();

    if (error || !user) return errorResponse('User not found', 404);
    if (!user.emergency_contact) {
      return errorResponse('No emergency contact set', 400);
    }

    // H-5: Validate emergency contact phone format
    if (!/^\+501[0-9]{7}$/.test(user.emergency_contact)) {
      return errorResponse('Emergency contact must be a valid Belize phone number (+501XXXXXXX)', 400);
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

    const message = `SOS ALERT from ${userName} (${user.phone}). ` +
      `They need help! ${mapsUrl}`;

    // Send SMS via Twilio
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER');

    if (accountSid && authToken && fromNumber) {
      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: user.emergency_contact,
            From: fromNumber,
            Body: message,
          }),
        },
      );

      if (!twilioRes.ok) {
        console.error('[SOS] Twilio error:', await twilioRes.text());
      }
    } else {
      console.warn('[SOS] Twilio not configured — SMS not sent:', message);

      // Still record the SOS attempt
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'sos_sent',
        title: 'SOS Alert Attempted',
        body: `Emergency alert could not be sent — SMS service not configured`,
        data: { latitude, longitude, emergencyContact: user.emergency_contact },
      });

      return jsonResponse({ sent: false, to: user.emergency_contact, error: 'SMS service not configured' }, 503, req);
    }

    // Store the SOS event as a notification for audit
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'sos_sent',
      title: 'SOS Alert Sent',
      body: `Emergency alert sent to ${user.emergency_contact}`,
      data: { latitude, longitude, emergencyContact: user.emergency_contact },
    });

    return jsonResponse({ sent: true, to: user.emergency_contact });
  } catch (error) {
    console.error('send-sms-sos error:', error);
    return errorResponse('SOS send failed', 500);
  }
});
