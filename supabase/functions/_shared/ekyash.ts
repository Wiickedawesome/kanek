// Shared utilities for E-Kyash edge functions
// Deno runtime — uses Web Crypto API

/** Build JWT token for E-Kyash API requests (per Bank API spec) */
export async function buildEkyashJwt(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const encoder = new TextEncoder();

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const token = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(token));
  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature)),
  );

  return `${token}.${encodedSignature}`;
}

/** Verify HMAC-SHA256 hash from E-Kyash callback */
export async function verifyCallbackHash(
  data: Record<string, unknown>,
  receivedHash: string,
  apiKey: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(JSON.stringify(data)),
  );
  const computedHash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe comparison to prevent timing attacks
  if (computedHash.length !== receivedHash.length) return false;
  const a = encoder.encode(computedHash);
  const b = encoder.encode(receivedHash);
  return crypto.subtle.timingSafeEqual(a, b);
}

/** Generate a unique order ID */
export function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().slice(0, 8);
  return `kn_${timestamp}_${random}`;
}

/** Calculate fees: 3% platform, donation opt-in defaults to 0 */
export function calculateFees(amountCents: number): {
  platformFeeCents: number;
  donationCents: number;
} {
  return {
    platformFeeCents: Math.round(amountCents * 0.03),
    donationCents: 0,
  };
}

/** E-Kyash API base URL from env */
export function getEkyashApiUrl(): string {
  return Deno.env.get('EKYASH_API_URL')!;
}

/** E-Kyash credentials from env */
export function getEkyashCredentials() {
  return {
    sid: Deno.env.get('EKYASH_SID')!,
    pinHash: Deno.env.get('EKYASH_PIN_HASH')!,
    apiKey: Deno.env.get('EKYASH_API_KEY')!,
  };
}

// --- internal ---

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
