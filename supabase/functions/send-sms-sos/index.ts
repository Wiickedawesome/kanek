/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

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
    const { userId, latitude, longitude } = await req.json();
    if (!userId) return errorResponse('Missing userId');

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
    return errorResponse(
      error instanceof Error ? error.message : 'SOS send failed',
      500,
    );
  }
});
