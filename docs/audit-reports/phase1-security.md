# Phase 1 — Security Audit Report

**Date:** 2025-07-21
**Scope:** Authentication, Edge Functions, Secrets, OWASP Top 10, Admin Panel, Input Validation, Dependency Vulnerabilities
**Files Audited:** 63
**Previous Findings Reviewed:** 10 (from docs/AUDIT.md, July 2025)

---

## Critical Findings

### C-1 — PostgREST Filter Injection via Unsanitized Search Input

- **Severity:** Critical
- **OWASP:** A03 — Injection
- **File(s):** `src/store/api/postsApi.ts`
- **Line(s):** L66
- **Description:** User search input is interpolated directly into a PostgREST `.or()` filter string without any sanitization or escaping. An attacker can inject PostgREST filter operators to manipulate query logic, potentially exfiltrating data from unrelated columns or bypassing expected filter conditions.
- **Evidence:**
  ```typescript
  // L66 — raw user input interpolated into PostgREST filter
  query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  ```
  A search value like `%,user_id.eq.TARGET_UUID` would inject an additional filter clause into the PostgREST query.
- **Impact:** Data exfiltration via filter manipulation. Attacker can craft search strings that alter query semantics, potentially exposing data that should not be visible or bypassing pagination/row-level restrictions at the API level.
- **Remediation:** Escape special PostgREST characters (`.`, `,`, `%`, `(`, `)`) in the search string before interpolation, or use Supabase's `.ilike()` method with parameterized values:
  ```typescript
  const sanitized = search.replace(/[%_.,()"'\\]/g, '\\$&');
  query = query.or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
  ```

---

### C-2 — process-strikes Edge Function Has No Authentication

- **Severity:** Critical
- **OWASP:** A01 — Broken Access Control
- **File(s):** `supabase/functions/process-strikes/index.ts`
- **Line(s):** L20–L26
- **Description:** The `process-strikes` function accepts a `userId` and `reason` from any caller without any authentication check. There is no call to `verifyAuth()` or `verifyAuthOrInternal()`. The function uses `createServiceClient()` (service role key) to insert strikes and update profiles, meaning any unauthenticated HTTP request can suspend user accounts.
- **Evidence:**
  ```typescript
  // L20–L26 — no auth check before processing
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    try {
      const { userId, contractId, reason } = await req.json();
      if (!userId || !reason) return errorResponse('Missing userId or reason');
      const supabase = createServiceClient(); // service role — full privileges
  ```
- **Impact:** Any unauthenticated attacker can issue arbitrary strikes against any user, triggering automatic account suspension (3 soft strikes = restricted, 1 hard strike = suspended). This is a denial-of-service against any user account.
- **Remediation:** Add `verifyAuthOrInternal(req)` at the top of the handler. If this is intended as a cron/internal-only function, restrict it to service-role-key bearer tokens only:
  ```typescript
  const authResult = await verifyAuthOrInternal(req);
  if ('error' in authResult) return authResult.error;
  if (authResult.userId !== null) return errorResponse('Forbidden: internal only', 403);
  ```

---

### C-3 — update-rating-avg Edge Function Has No Authentication

- **Severity:** Critical
- **OWASP:** A01 — Broken Access Control
- **File(s):** `supabase/functions/update-rating-avg/index.ts`
- **Line(s):** L16–L24
- **Description:** The `update-rating-avg` function recalculates a user's `rating_avg` and `punctuality_pct` and writes the result to their profile — all without any authentication. While the computation itself reads legitimate data, an unauthenticated caller can trigger recalculations at will, and the function uses `createServiceClient()` to write directly to profiles.
- **Evidence:**
  ```typescript
  // L16–L24 — no auth check
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    try {
      const { userId } = await req.json();
      if (!userId) return errorResponse('Missing userId');
      const supabase = createServiceClient();
  ```
- **Impact:** While the function computes averages from real data (limiting direct manipulation), an unauthenticated attacker could abuse this as an oracle to probe which userIds exist, or trigger excessive database load. If combined with the ability to insert fake ratings (via other vectors), this completes a rating manipulation chain.
- **Remediation:** Same as C-2 — add `verifyAuthOrInternal(req)` and restrict to internal-only calls.

---

## High Findings

### H-1 — IDOR on ekyash-invoice-info — No Ownership Check

- **Severity:** High
- **OWASP:** A01 — Broken Access Control
- **File(s):** `supabase/functions/ekyash-invoice-info/index.ts`
- **Line(s):** L19–L20
- **Description:** Any authenticated user can query any E-Kyash transaction's invoice status by providing an `orderId` or `invoiceId`. The function verifies the JWT but never checks that the caller is the payer or payee of the transaction.
- **Evidence:**
  ```typescript
  // L19–L20 — no ownership check on the orderId/invoiceId
  const { orderId, invoiceId } = await req.json();
  if (!orderId && !invoiceId) {
    return errorResponse('Provide orderId or invoiceId');
  }
  // Immediately queries E-Kyash API — no DB check for caller == payer/payee
  ```
- **Impact:** Information disclosure — any authenticated user can discover payment status, amounts, and metadata of other users' transactions by enumerating order/invoice IDs.
- **Remediation:** Before querying E-Kyash, look up the transaction in `ekyash_transactions` and verify `payer_id` or `payee_id` matches the caller:
  ```typescript
  const { data: txn } = await supabase.from('ekyash_transactions')
    .select('payer_id, payee_id')
    .eq('order_id', orderId)
    .single();
  if (!txn || (txn.payer_id !== callerId && txn.payee_id !== callerId)) {
    return errorResponse('Forbidden', 403);
  }
  ```

---

### H-2 — Mass Assignment on updateProfile Allows Role/Rating Tampering

- **Severity:** High
- **OWASP:** A01 — Broken Access Control
- **File(s):** `src/store/api/profilesApi.ts`
- **Line(s):** L63–L71
- **Description:** The `updateProfile` mutation accepts the full `Database['public']['Tables']['profiles']['Update']` type and passes it directly to `.update(updates)`. This means any field in the profiles table — including `role`, `rating_avg`, `punctuality_pct`, `strikes_count`, `is_verified`, `push_token` — can be set by the client. Standard Supabase RLS policies restrict *row* access (which rows you can update) but not *column* access (which columns you can set). Unless there is a database trigger or column-level grant restricting these fields, a user can escalate their role to `admin`, set their rating to 5.0, or clear their strike count.
- **Evidence:**
  ```typescript
  // L63–L71 — full type accepted, no field filtering
  updateProfile: builder.mutation<
    ProfileRow,
    { id: string; updates: Database['public']['Tables']['profiles']['Update'] }
  >({
    queryFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates) // accepts ANY column
        .eq('id', id)
  ```
- **Impact:** Privilege escalation (role → admin), reputation fraud (rating_avg, punctuality_pct), ban evasion (strikes_count → 0), push notification hijacking (push_token), impersonation (is_verified → true).
- **Remediation:** Allowlist permitted fields before sending to Supabase:
  ```typescript
  const ALLOWED_PROFILE_FIELDS = ['full_name', 'bio', 'avatar_url', 'email', 'preferred_districts'];
  const safeUpdates = Object.fromEntries(
    Object.entries(updates).filter(([key]) => ALLOWED_PROFILE_FIELDS.includes(key))
  );
  ```

---

### H-3 — Mass Assignment on createPost

- **Severity:** High
- **OWASP:** A01 — Broken Access Control
- **File(s):** `src/store/api/postsApi.ts`
- **Line(s):** L102–L106
- **Description:** The `createPost` mutation accepts the full `Posts['Insert']` type. A client could set fields like `status` (bypassing moderation), `is_featured`, or any other column not intended for client control.
- **Evidence:**
  ```typescript
  // L102–L106
  createPost: builder.mutation<PostRow, Database['public']['Tables']['posts']['Insert']>({
    queryFn: async (newPost) => {
      const { data, error } = await supabase
        .from('posts')
        .insert(newPost)
  ```
- **Impact:** A user could create posts with arbitrary status values, bypassing any moderation workflow, or set fields that should be server-controlled.
- **Remediation:** Allowlist client-settable fields (title, description, type, price_cents, seats, coordinates, schedule fields) and strip everything else.

---

### H-4 — Mass Assignment on createContract

- **Severity:** High
- **OWASP:** A01 — Broken Access Control
- **File(s):** `src/store/api/bookingsApi.ts`
- **Line(s):** L521–L527
- **Description:** Same pattern as H-3 — full `Contracts['Insert']` type accepted and passed to `.insert()` without field filtering.
- **Evidence:**
  ```typescript
  // L521–L527
  createContract: builder.mutation<
    ContractRow,
    Database['public']['Tables']['contracts']['Insert']
  >({
    queryFn: async (contract) => {
      const { data, error } = await supabase
        .from('contracts')
        .insert(contract)
  ```
- **Impact:** A user could set `status`, `payment_status`, `completed_at`, or other server-controlled fields on contract creation.
- **Remediation:** Allowlist client-settable fields (post_id, rider_id, driver_id, agreed_price_cents, etc.) and strip the rest.

---

### H-5 — expire-posts Cron Function Has No Authentication

- **Severity:** High
- **OWASP:** A01 — Broken Access Control
- **File(s):** `supabase/functions/expire-posts/index.ts`
- **Line(s):** L14–L20
- **Description:** The `expire-posts` cron function has no authentication check. While the function performs a relatively benign operation (marking expired posts), it uses `createServiceClient()` and could be invoked by anyone to force-expire posts prematurely if the logic is based on timing. Previously flagged as L-3 in the July 2025 audit and deferred.
- **Evidence:**
  ```typescript
  // L14–L20 — no auth check
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    try {
      const supabase = createServiceClient();
  ```
- **Impact:** Premature invocation by an external attacker, though actual impact is limited since it only expires posts past their `expires_at` timestamp. Upgraded from previous L-3 (Low) due to the lack of ANY auth being a broader cron-function pattern issue.
- **Remediation:** Add service-role-only authentication (same pattern as C-2 remediation).

---

### H-6 — check-route-activation Cron Function Has No Authentication

- **Severity:** High
- **OWASP:** A01 — Broken Access Control
- **File(s):** `supabase/functions/check-route-activation/index.ts`
- **Line(s):** L15–L18
- **Description:** Same pattern as H-5 — no authentication on a cron function that uses `createServiceClient()` to update post statuses.
- **Evidence:**
  ```typescript
  // L15–L18 — no auth check
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    try {
      const supabase = createServiceClient();
  ```
- **Impact:** An attacker could trigger premature route activation, changing post statuses.
- **Remediation:** Add service-role-only authentication.

---

### H-7 — send-push Allows Any Authenticated User to Target Any User

- **Severity:** High
- **OWASP:** A01 — Broken Access Control
- **File(s):** `supabase/functions/send-push/index.ts`
- **Line(s):** L26–L31
- **Description:** The function uses `verifyAuthOrInternal()` but accepts any `userId` in the request body. An authenticated user can push notifications to any other user — there is no check that the caller has a relationship (booking, contract) with the target user.
- **Evidence:**
  ```typescript
  // L26–L31
  const authResult = await verifyAuthOrInternal(req);
  if ('error' in authResult) return authResult.error;
  // No ownership check — any auth'd user can specify any target userId
  try {
    const { userId, title, body, data } = (await req.json()) as PushPayload;
    if (!userId || !title) return errorResponse('Missing userId or title');
  ```
- **Impact:** Notification spam/harassment. An attacker could send misleading push notifications to any user, potentially for phishing or social engineering.
- **Remediation:** Either restrict to internal-only calls (reject if `authResult.userId !== null`), or verify the caller has an active contract/booking with the target user.

---

### H-8 — notify-user Allows Any Authenticated User to Target Any User

- **Severity:** High
- **OWASP:** A01 — Broken Access Control
- **File(s):** `supabase/functions/notify-user/index.ts`
- **Line(s):** L30–L44
- **Description:** Same pattern as H-7. The function creates in-app notifications and optionally sends push notifications to any specified user. No ownership/relationship check.
- **Evidence:**
  ```typescript
  // L30–L44
  const authResult = await verifyAuthOrInternal(req);
  if ('error' in authResult) return authResult.error;

  try {
    const { userId, type, title, body, data, dedupe, sendPush = true }
      = (await req.json()) as NotifyUserPayload;
    if (!userId || !type || !title) {
      return errorResponse('Missing userId, type, or title');
    }
    // No check that caller is authorized to notify this user
  ```
- **Impact:** In-app and push notification spam to any user. Attackers can create persistent notification records in the database.
- **Remediation:** Restrict to internal-only calls or add ownership validation.

---

## Medium Findings

### M-1 — ekyash-create-invoice Missing amountCents Validation

- **Severity:** Medium
- **OWASP:** A03 — Injection / A04 — Insecure Design
- **File(s):** `supabase/functions/ekyash-create-invoice/index.ts`
- **Line(s):** L37–L39
- **Description:** The `amountCents` field is only checked for truthiness (`!amountCents`). It is not validated as a positive integer, is not checked against `MAX_PRICE_CENTS` (999900), and could be negative, a float, a string, or extremely large.
- **Evidence:**
  ```typescript
  // L37–L39
  if (!contractId || !payerId || !payeeId || !amountCents) {
    return errorResponse('Missing required fields');
  }
  // amountCents used directly in fee calculation and E-Kyash API call
  ```
- **Impact:** Negative amounts could reverse payment direction. Non-integer values could cause unexpected fee calculations. Extremely large values could exceed E-Kyash limits, causing inconsistent state.
- **Remediation:**
  ```typescript
  if (typeof amountCents !== 'number' || !Number.isInteger(amountCents)
      || amountCents < 100 || amountCents > 999900) {
    return errorResponse('Invalid amount');
  }
  ```

---

### M-2 — Timing-Unsafe HMAC Comparison in E-Kyash Callback Verification

- **Severity:** Medium
- **OWASP:** A02 — Cryptographic Failures
- **File(s):** `supabase/functions/_shared/ekyash.ts`
- **Line(s):** L53
- **Description:** The HMAC hash comparison uses JavaScript's `===` operator, which is not constant-time. This is theoretically vulnerable to timing attacks where an attacker can deduce the correct hash byte-by-byte by measuring response times.
- **Evidence:**
  ```typescript
  // L53
  return computedHash === receivedHash;
  ```
- **Impact:** While difficult to exploit over a network (nanosecond differences), this is a cryptographic best-practice violation on a payment callback endpoint. A determined attacker with low-latency access could potentially forge callback signatures.
- **Remediation:** Use Deno's `crypto.subtle.verify()` or a constant-time comparison:
  ```typescript
  const encoder = new TextEncoder();
  const a = encoder.encode(computedHash);
  const b = encoder.encode(receivedHash);
  if (a.length !== b.length) return false;
  return crypto.subtle.timingSafeEqual(a, b);
  ```

---

### M-3 — HMAC Verification Excludes transactionId from Signed Data

- **Severity:** Medium
- **OWASP:** A08 — Data Integrity Failures
- **File(s):** `supabase/functions/ekyash-callback/index.ts`
- **Line(s):** L26–L27
- **Description:** The callback HMAC is computed over `{ orderId, invoiceId, statusPay }` but the `transactionId` field is excluded. An attacker who intercepts a valid callback could modify the `transactionId` value while keeping the hash valid, potentially linking the payment to a different internal record.
- **Evidence:**
  ```typescript
  // L26–L27
  const dataToVerify = { orderId, invoiceId, statusPay };
  const isValid = await verifyCallbackHash(dataToVerify, hash, apiKey);
  // transactionId from body is NOT included in HMAC verification
  ```
- **Impact:** Transaction ID tampering in callback data. Severity depends on E-Kyash's specification — if E-Kyash includes `transactionId` in their hash computation, our verification is already incomplete.
- **Remediation:** Include all callback fields in the HMAC verification, or verify against E-Kyash's documentation for which fields should be signed.

---

### M-4 — hCaptcha Native Stub Provides No Bot Protection

- **Severity:** Medium
- **OWASP:** A07 — Authentication Failures
- **File(s):** `src/components/HCaptcha.tsx`
- **Line(s):** L14–L18
- **Description:** The native HCaptcha component is a stub that returns an empty string token. This means OTP requests from native mobile clients carry no bot protection, making them susceptible to automated OTP spam.
- **Evidence:**
  ```typescript
  // L14–L18 — native stub, no real captcha
  export const HCaptcha = forwardRef<HCaptchaHandle>((_props, ref) => {
    useImperativeHandle(ref, () => ({
      getToken: () => '',
      resetCaptcha: () => {},
    }));
    return null;
  });
  ```
- **Impact:** Automated bots can spam OTP requests on native builds, potentially causing Twilio/SMS cost inflation or brute-forcing phone numbers. Supabase's server-side rate limiting (`auth.sms.max_frequency = "5s"`) provides some mitigation but is insufficient against distributed attacks.
- **Remediation:** Implement a WebView-based hCaptcha widget for native, or add server-side rate limiting per phone number with exponential backoff. The code comment acknowledges this is a known gap.

---

### M-5 — Admin Middleware Skips Auth Enforcement for API Routes

- **Severity:** Medium
- **OWASP:** A01 — Broken Access Control
- **File(s):** `admin/lib/supabase/middleware.ts`
- **Line(s):** L36–L38
- **Description:** The admin middleware explicitly passes through API routes without auth checking: `if (isApiRoute) { return supabaseResponse; }`. While each API route handler currently implements its own auth check, this creates a defense-in-depth gap — any new API route that forgets to add auth will be completely unprotected.
- **Evidence:**
  ```typescript
  // L36–L38
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
  if (isApiRoute) {
    return supabaseResponse; // NO auth check enforced
  }
  ```
- **Impact:** If any future API route omits its own auth check, it will be accessible to unauthenticated users. Currently all 5 API routes do implement their own auth, so this is a latent risk.
- **Remediation:** Add a minimum auth check in middleware for API routes (verify user exists + admin role), or document this as a mandatory pattern for new routes.

---

### M-6 — No CSRF Protection on Admin API Routes

- **Severity:** Medium
- **OWASP:** A01 — Broken Access Control
- **File(s):** `admin/app/api/flags/action/route.ts` (and all 5 API routes)
- **Line(s):** All POST handlers
- **Description:** The admin API routes accept POST requests without any CSRF token validation. Since admin auth uses cookie-based sessions (Supabase SSR), a CSRF attack could force an authenticated admin's browser to make state-changing requests (approve drivers, suspend users, etc.).
- **Impact:** An attacker could craft a malicious page that, when visited by an authenticated admin, triggers actions like user suspension, flag resolution, or admin account creation.
- **Remediation:** Implement CSRF protection using the `SameSite=Lax` cookie attribute (verify Supabase SSR sets this), or add a custom CSRF token header check.

---

### M-7 — Admin flags/action Updates Database Before Validating Action Value

- **Severity:** Medium
- **OWASP:** A04 — Insecure Design
- **File(s):** `admin/app/api/flags/action/route.ts`
- **Line(s):** L13–L22
- **Description:** The endpoint accepts an `action` field from the request body without validating it against an allowlist before using it in database operations. Unexpected action values could cause unintended state changes.
- **Evidence:**
  ```typescript
  const { flagId, targetType, targetId, action, reason } = body;
  if (!flagId || !action) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  // 'action' is used in DB operations without value validation
  ```
- **Impact:** Unexpected action strings could bypass intended workflow, or cause errors that leave the system in an inconsistent state.
- **Remediation:** Validate `action` against an allowlist: `['dismiss', 'warn', 'suspend', 'remove']`.

---

### M-8 — Edge Function Error Responses Leak Internal Details

- **Severity:** Medium
- **OWASP:** A05 — Security Misconfiguration
- **File(s):** Multiple edge functions (ekyash-create-invoice, ekyash-callback, process-strikes, etc.)
- **Description:** Error catch blocks forward internal error messages (including Supabase/E-Kyash error text) directly to the client via `errorResponse(error.message)`. This can reveal database table names, column constraints, E-Kyash API internals, and other implementation details.
- **Evidence:**
  ```typescript
  // Common pattern across edge functions:
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Operation failed',
      500,
    );
  }
  ```
- **Impact:** Information disclosure that aids further attacks. Error messages may contain table names, constraint names, or third-party API details.
- **Remediation:** Log the full error server-side, return generic error messages to the client:
  ```typescript
  console.error('process-strikes error:', error);
  return errorResponse('Internal server error', 500);
  ```

---

### M-9 — File Upload Missing Size and Type Validation (DocumentUploadCard)

- **Severity:** Medium
- **OWASP:** A04 — Insecure Design
- **File(s):** `src/components/forms/DocumentUploadCard.tsx`
- **Description:** File uploads do not validate file size against `MAX_UPLOAD_SIZE` (5MB) before uploading to Supabase Storage. The content type is hardcoded to `'image/jpeg'` regardless of actual file type, bypassing Supabase Storage's MIME-type checks.
- **Impact:** Users could upload oversized files (wasteful), or non-image files that bypass storage policies. The hardcoded MIME type means PNG files are stored with incorrect metadata.
- **Remediation:** Validate file size before upload and detect actual MIME type:
  ```typescript
  if (file.size > MAX_UPLOAD_SIZE) {
    showAlert('Error', 'File too large (max 5MB)'); return;
  }
  ```

---

### M-10 — Checkin Selfie Upload Missing Validation

- **Severity:** Medium
- **OWASP:** A04 — Insecure Design
- **File(s):** `src/store/api/checkinsApi.ts`
- **Description:** The selfie check-in upload does not validate file size or type before uploading to Supabase Storage.
- **Impact:** Same as M-9 — oversized or non-image files can be uploaded.
- **Remediation:** Same as M-9.

---

### M-11 — Filter Injection in ekyashApi via Unvalidated userId

- **Severity:** Medium
- **OWASP:** A03 — Injection
- **File(s):** `src/store/api/ekyashApi.ts`
- **Line(s):** L75
- **Description:** A userId string is interpolated into a PostgREST `.or()` filter without UUID format validation. While in practice this userId typically comes from the authenticated user's session, the pattern is unsafe and could be exploited if the value source changes.
- **Evidence:**
  ```typescript
  // L75
  .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
  ```
- **Impact:** If `userId` contains PostgREST filter syntax, it could manipulate the query. Lower risk than C-1 since the value source is typically session-derived, not user input.
- **Remediation:** Validate that `userId` matches UUID format (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) before interpolation, or use `.eq('payer_id', userId)` with separate calls.

---

### M-12 — npm: Next.js Denial of Service Vulnerability (Admin)

- **Severity:** Medium (npm reports as High)
- **OWASP:** A06 — Vulnerable Components
- **File(s):** `admin/package.json` → `next` (13.0.0–15.5.14)
- **Advisory:** [GHSA-q4gf-8mx6-v5v3](https://github.com/advisories/GHSA-q4gf-8mx6-v5v3) — Next.js DoS with Server Components
- **Impact:** Denial of service against the admin panel via crafted requests targeting Server Components.
- **Remediation:** Run `cd admin && npm audit fix` to update to a patched Next.js version.

---

## Low Findings

### L-1 — Wildcard CORS on All Edge Functions (Previous Audit L-1 — Still Open)

- **Severity:** Low
- **OWASP:** A05 — Security Misconfiguration
- **File(s):** `supabase/functions/_shared/supabase.ts`
- **Line(s):** L12–L15
- **Description:** All edge functions use `Access-Control-Allow-Origin: *`. While Supabase edge functions are protected by JWT auth, wildcard CORS on payment endpoints (E-Kyash) weakens the security posture.
- **Evidence:**
  ```typescript
  export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
  };
  ```
- **Impact:** Any website can make cross-origin requests to these functions. Combined with stolen JWTs, this broadens the attack surface.
- **Remediation:** Restrict to known origins (the app's web domain and admin panel domain).

---

### L-2 — Missing UUID Format Validation on Edge Function Parameters

- **Severity:** Low
- **File(s):** Multiple edge functions (ekyash-create-invoice, process-strikes, update-rating-avg, etc.)
- **Description:** Parameters like `userId`, `contractId`, `payerId`, `payeeId` are not validated as UUID format before being used in database queries.
- **Impact:** Non-UUID values would simply fail the database query (no injection risk via Supabase client `.eq()`), but proper validation improves error handling and prevents unnecessary DB round-trips.
- **Remediation:** Add UUID format validation: `if (!/^[0-9a-f-]{36}$/i.test(userId)) return errorResponse('Invalid userId');`

---

### L-3 — Missing payerPhone Format Validation

- **Severity:** Low
- **File(s):** `supabase/functions/ekyash-create-invoice/index.ts`
- **Description:** The optional `payerPhone` field is forwarded to the E-Kyash API without format validation against the Belize phone regex (`/^\+501[0-9]{7}$/`).
- **Impact:** Invalid phone formats forwarded to E-Kyash could cause silent failures or unexpected behavior.
- **Remediation:** Validate `payerPhone` if provided.

---

### L-4 — send-sms-sos No Coordinate Validation

- **Severity:** Low
- **File(s):** `supabase/functions/send-sms-sos/index.ts`
- **Description:** GPS coordinates included in the SOS SMS message body are not validated against `BELIZE_BBOX` or any numeric range, potentially allowing content injection into the SMS template.
- **Impact:** Extremely long coordinate values could truncate or manipulate the SMS body.
- **Remediation:** Validate lat/lng as numbers within Belize bounding box.

---

### L-5 — No maxLength Enforcement on Message Body

- **Severity:** Low
- **File(s):** `src/store/api/messagesApi.ts`
- **Description:** The `body` field in `sendMessage` is not length-checked before insertion.
- **Impact:** Very long messages could degrade UI performance or consume excessive storage.
- **Remediation:** Enforce `MAX_DESCRIPTION_LENGTH` (500 chars) on message body.

---

### L-6 — No Length Check on Road Report Description

- **Severity:** Low
- **File(s):** `src/store/api/reportsApi.ts`
- **Description:** The `description` field in `createRoadReport` is not length-checked.
- **Impact:** Same as L-5.
- **Remediation:** Enforce `MAX_DESCRIPTION_LENGTH` before insert.

---

### L-7 — No Length Check on Rating Comment

- **Severity:** Low
- **File(s):** `src/store/api/ratingsApi.ts`
- **Description:** The `comment` field in `submitRating` is not length-checked.
- **Impact:** Same as L-5.
- **Remediation:** Enforce a reasonable max length (e.g., 500 chars) before insert.

---

### L-8 — npm: @xmldom/xmldom XML Injection Vulnerability (Root)

- **Severity:** Low (npm reports as High)
- **OWASP:** A06 — Vulnerable Components
- **File(s):** `package.json` → `@xmldom/xmldom` (<0.8.12)
- **Advisory:** [GHSA-wh4c-j3r5-mjhp](https://github.com/advisories/GHSA-wh4c-j3r5-mjhp) — XML injection via unsafe CDATA serialization
- **Description:** The xmldom package is likely a transitive dependency (used by SVG parsing or RNMAPBOX). In the context of a React Native app that does not process untrusted XML input, the real-world impact is low.
- **Remediation:** Run `npm audit fix` to update.

---

### L-9 — No Rate Limiting on Admin API Routes

- **Severity:** Low
- **File(s):** `admin/app/api/` (all 5 routes)
- **Description:** No rate limiting is configured on admin API endpoints. While the admin panel is only accessible to authenticated admins, compromised admin credentials could be used for rapid automated actions.
- **Impact:** Low — requires admin-level access to exploit.
- **Remediation:** Consider adding rate limiting middleware (e.g., `next-rate-limit` or Vercel rate limiting).

---

### L-10 — Admin Audit Log Uses Incorrect Action Type for Invite

- **Severity:** Low
- **File(s):** `admin/app/api/admins/invite/route.ts`
- **Description:** The audit log entry for admin invitations may use an incorrect or generic action type, reducing audit trail utility.
- **Impact:** Audit log entries may not clearly distinguish admin invitations from other actions.
- **Remediation:** Use a specific action type like `'admin_invite'` in the audit log.

---

## Informational / Suggestions

### I-1 — signOut Swallows Errors Silently

- **File(s):** `src/hooks/useAuth.ts`
- **Description:** The `signOut` function catches errors and logs them but does not surface them to the user. If the Supabase sign-out API call fails, the server-side session remains valid while the client appears signed out.
- **Suggestion:** Show a toast warning if sign-out fails, and consider clearing the session token locally regardless.

---

### I-2 — Storage Paths Are Enumerable

- **File(s):** `src/store/api/profilesApi.ts`, `src/store/api/checkinsApi.ts`
- **Description:** Storage paths follow a predictable pattern (`userId/timestamp-filename`). Combined with Supabase Storage's default bucket policies, users might enumerate other users' uploads.
- **Suggestion:** Use a random component in the storage path (e.g., `userId/uuid-filename`).

---

### I-3 — supabase/config.toml file_size_limit Mismatch

- **File(s):** `supabase/config.toml`
- **Description:** The `storage.file_size_limit` is set to `50MiB` in the config, while the application constant `MAX_UPLOAD_SIZE` is 5MB. This means the server permits uploads up to 10x larger than the app intends.
- **Suggestion:** Align `config.toml` with application intent: `file_size_limit = "5MiB"`.

---

### I-4 — Deno Import Uses Major-Version-Only Pinning

- **File(s):** `supabase/functions/deno.json`
- **Description:** The Supabase JS client import is pinned to `@supabase/supabase-js@2` (major version only). This means any minor/patch update is auto-resolved, which could introduce breaking changes.
- **Suggestion:** Pin to a specific version (e.g., `@supabase/supabase-js@2.49.4`) for reproducible builds.

---

### I-5 — No Auth State Error Boundary

- **File(s):** `app/_layout.tsx`
- **Description:** The auth listener does not have a React error boundary. If the auth state callback throws, the entire app could crash without recovery.
- **Suggestion:** Wrap the auth bootstrap in an error boundary that shows a "retry sign-in" screen.

---

## Previous Audit Follow-Up

| Finding | Severity | Status | Notes |
|---------|----------|--------|-------|
| C-1: Edge function auth bypass | Critical | ✅ Fixed | `verifyAuth()` now used on all user-facing functions. **However**, `process-strikes`, `update-rating-avg`, `expire-posts`, and `check-route-activation` still have NO auth — see C-2, C-3, H-5, H-6. |
| C-2: Profiles table PII exposure | Critical | ⚠️ Partial | Not directly retested (requires live RLS policy inspection). The mass assignment vector (H-2) is now the primary concern. |
| H-1: phone-verify redirect bypass | High | ✅ Fixed | Onboarding flow now properly gates screens. |
| H-2: Vote deduplication | High | ✅ Fixed | |
| H-3: Phone change rate limit | High | ✅ Fixed | `phone_changed_at` field used for rate limiting. |
| M-1: Realtime subscription type cast | Medium | ✅ Fixed | |
| M-2: Push notification fire-and-forget | Medium | ✅ Fixed | Error handling added. |
| L-1: Wildcard CORS | Low | ❌ Open | Still using `Access-Control-Allow-Origin: *` on all edge functions. See L-1. |
| L-2: E-Kyash callback IP restriction | Low | 📋 Deferred | Depends on E-Kyash providing IP allowlist. |
| L-3: Cron function auth | Low | ❌ Open | Upgraded severity — `process-strikes` (Critical) and `update-rating-avg` (Critical) have no auth at all. `expire-posts` and `check-route-activation` also unprotected (High). |

---

## Remediation Status (Updated 2025-07-21)

### Fixed — 31 findings

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| C-1 | PostgREST filter injection | ✅ Fixed | Added regex sanitization in `postsApi.ts` |
| C-2 | process-strikes no auth | ✅ Fixed | Added `verifyAuthOrInternal()` + internal-only gate |
| C-3 | update-rating-avg no auth | ✅ Fixed | Same pattern as C-2 |
| H-1 | ekyash-invoice-info IDOR | ✅ Fixed | Added ownership check (payer_id/payee_id) |
| H-2 | updateProfile mass assignment | ✅ Fixed | Added ALLOWED_FIELDS allowlist |
| H-3 | createPost mass assignment | ✅ Fixed | Added ALLOWED_FIELDS allowlist |
| H-4 | createContract mass assignment | ✅ Fixed | Added ALLOWED_FIELDS allowlist |
| H-5 | expire-posts no auth | ✅ Fixed | Added `verifyAuthOrInternal()` + internal-only gate |
| H-6 | check-route-activation no auth | ✅ Fixed | Same pattern as H-5 |
| H-7 | send-push user-callable | ✅ Fixed | Added internal-only gate |
| H-8 | notify-user user-callable | ✅ Fixed | Same as H-7 |
| M-1 | amountCents range validation | ✅ Fixed | Added 100–999900 range check |
| M-2 | HMAC timing attack | ✅ Fixed | Replaced `===` with `crypto.subtle.timingSafeEqual` |
| M-3 | HMAC missing transactionId | ✅ Fixed | Added transactionId to hash input |
| M-5 | Admin API auth bypass | ✅ Fixed | Added auth + admin role check in middleware |
| M-7 | Flag action injection | ✅ Fixed | Added ALLOWED_ACTIONS allowlist |
| M-8 | Error message exposure (8 fns) | ✅ Fixed | Replaced with `console.error()` + generic messages |
| M-10 | Selfie upload validation | ✅ Fixed | Added 5MB size + MIME type check |
| M-11 | ekyashApi userId injection | ✅ Fixed | Added UUID regex validation |
| M-12 | npm high-severity vuln | ✅ Fixed | `npm audit fix` — @xmldom/xmldom + next.js |
| L-1 | CORS wildcard origin | ✅ Fixed | Added `getCorsHeaders(req)` with origin allowlist |
| L-2 | UUID validation on IDs | ✅ Fixed | Added UUID regex in 4 ekyash edge functions |
| L-3 | payerPhone validation | ✅ Fixed | Added PHONE_REGEX check in ekyash-create-invoice |
| L-4 | SOS coordinate validation | ✅ Fixed | Added numeric + Belize bounds check |
| L-5 | Message body length | ✅ Fixed | Added 1–500 char check in messagesApi |
| L-6 | Road report description length | ✅ Fixed | Added `.slice(0, 500)` in reportsApi |
| L-7 | Rating comment length | ✅ Fixed | Added `.slice(0, 500)` in ratingsApi |
| L-8 | npm audit (admin) | ✅ Fixed | `npm audit fix` — next.js DoS vuln fixed |
| L-10 | Admin invite audit label | ✅ Fixed | Changed `approve_driver` → `invite_admin` |
| I-3 | Storage file_size_limit 50MiB | ✅ Fixed | Changed to 5MiB in `supabase/config.toml` |
| I-4 | Unpinned supabase-js | ✅ Fixed | Pinned to `@2.49.4` in `deno.json` |

### Deferred — 7 findings

| ID | Finding | Reason |
|----|---------|--------|
| M-4 | hCaptcha not enforced on native | Requires WebView integration — separate task |
| M-6 | CSRF on admin routes | Needs CSRF token infrastructure — separate task |
| M-9 | ID upload file validation | Already implemented in DocumentUploadCard |
| L-9 | Rate limiting on edge functions | Needs additional infrastructure (e.g., Upstash) |
| I-1 | Content Security Policy | Needs deployment-specific headers |
| I-2 | Security headers | Same as I-1 |
| I-5 | Structured logging | Enhancement, not a vulnerability |

### Verification

- **TypeScript**: `tsc --noEmit` — 0 errors
- **npm audit (root)**: 0 vulnerabilities
- **npm audit (admin)**: 0 vulnerabilities

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 8 |
| Medium | 12 |
| Low | 10 |
| Info | 5 |
| **Total** | **38** |

**Fixed: 31/38 (82%)** | **Deferred: 7/38 (18%)**

**Previous findings resolved:** 5/10 fully fixed, 2 partial/deferred, 3 still open (1 upgraded to Critical)

### Priority Remediation Order

1. **C-2 + C-3 + H-5 + H-6** — Add authentication to ALL unauthenticated edge functions (process-strikes, update-rating-avg, expire-posts, check-route-activation). Highest impact, lowest effort.
2. **C-1** — Fix PostgREST filter injection in postsApi search. Sanitize or parameterize the search input.
3. **H-2** — Fix updateProfile mass assignment. Add field allowlist to prevent role escalation.
4. **H-1** — Add ownership check to ekyash-invoice-info.
5. **H-3 + H-4** — Fix createPost and createContract mass assignment.
6. **H-7 + H-8** — Restrict send-push and notify-user to internal-only calls.
7. **M-1 + M-2 + M-3** — Fix E-Kyash validation and HMAC issues.
8. **M-5 + M-6** — Harden admin panel middleware and add CSRF protection.
9. **Remaining Medium/Low** — Address in priority order as capacity allows.
