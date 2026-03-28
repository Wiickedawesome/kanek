/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import {
  buildEkyashJwt,
  getEkyashApiUrl,
  getEkyashCredentials,
} from '../_shared/ekyash.ts';
import { corsHeaders, jsonResponse, errorResponse } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sid, pinHash, apiKey } = getEkyashCredentials();
    const apiUrl = getEkyashApiUrl();

    const jwt = await buildEkyashJwt(apiKey, { mobile: '' });

    const response = await fetch(`${apiUrl}/authorization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        'Accept-Language': 'En',
        'The-Timezone-IANA': 'UTC',
      },
      body: JSON.stringify({ sid, pinHash, pushkey: '' }),
    });

    if (!response.ok) {
      const text = await response.text();
      return errorResponse(`E-Kyash authorization failed: ${text}`, 502);
    }

    const data = await response.json();
    return jsonResponse({ session: data.session });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Authorization failed',
      500,
    );
  }
});
