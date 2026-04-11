# Phase 3 — Edge Functions & Business Logic Audit Report

**Date:** 2025-07-27
**Scope:** 13 Deno edge functions, 2 shared modules, business logic correctness, error handling, idempotency, race conditions
**Functions Audited:** 15 (13 functions + 2 shared modules)

---

## Function Inventory

| Function | Auth Model | Caller | Purpose |
|----------|-----------|--------|---------|
| `ekyash-authorize` | `verifyAuth` | User | Get E-Kyash session token |
| `ekyash-create-invoice` | `verifyAuth` | User | Create payment invoice |
| `ekyash-callback` | HMAC hash | E-Kyash webhook | Receive payment status |
| `ekyash-cancel-invoice` | `verifyAuth` | User | Cancel pending invoice |
| `ekyash-invoice-info` | `verifyAuth` | User | Query invoice status |
| `ekyash-refund` | `verifyAuth` | User | Issue refund |
| `expire-posts` | `verifyAuthOrInternal` (internal-only) | Cron | Expire old posts/reports |
| `process-strikes` | `verifyAuthOrInternal` (internal-only) | Internal | Process strike penalties |
| `check-route-activation` | `verifyAuthOrInternal` (internal-only) | Cron | Activate routes at threshold |
| `update-rating-avg` | `verifyAuthOrInternal` (internal-only) | Internal | Recalculate rating |
| `notify-user` | `verifyAuthOrInternal` (internal-only) | Internal | Insert notification + push |
| `send-push` | `verifyAuthOrInternal` (internal-only) | Internal | Send Expo push notification |
| `send-email-receipt` | `verifyAuth` | User + Internal | Send email receipt via Resend |
| `send-sms-sos` | `verifyAuth` | User | SOS SMS via Twilio |

---

## Critical Findings

### C-01 — Syntax Errors in 3 E-Kyash Function Catch Blocks

- **Severity:** Critical
- **Functions:** `ekyash-authorize`, `ekyash-create-invoice`, `ekyash-callback`
- **Description:** Three functions have malformed catch blocks containing JavaScript statements (with semicolons) inside `errorResponse()` function call arguments. This is a SyntaxError that prevents the function from loading in the Deno runtime.
- **Evidence (ekyash-authorize):**
  ```typescript
  } catch (error) {
    return errorResponse(
      console.error('ekyash-authorize error:', error);   // ← SyntaxError: ';' in argument list
      return errorResponse('Authorization failed', 500);  // ← second return inside function args
      500,
    );
  }
  ```
  Same pattern in `ekyash-create-invoice` and `ekyash-callback`.
- **Impact:** If any exception is thrown in these functions, the catch block cannot execute — the function fails with an unhandled parse error. Since Deno JIT-compiles TypeScript, the parse error may surface at module load time, making these functions entirely non-functional if the runtime eagerly parses catch blocks. At minimum, any runtime exception results in an unhandled crash with no error response to the client.
- **Remediation:** Fix the catch blocks:
  ```typescript
  } catch (error) {
    console.error('ekyash-authorize error:', error);
    return errorResponse('Authorization failed', 500);
  }
  ```

---

### C-02 — orderId UUID Validation Rejects All Valid Order IDs

- **Severity:** Critical
- **Functions:** `ekyash-cancel-invoice`, `ekyash-refund`, `ekyash-invoice-info`
- **Description:** These three functions validate the user-supplied `orderId` against a UUID regex, but `generateOrderId()` in `_shared/ekyash.ts` produces IDs in the format `kn_<base36-timestamp>_<8-char-hex>` (e.g., `kn_m3x7abc_1a2b3c4d`). The UUID regex will **always** reject valid order IDs.
- **Evidence (`_shared/ekyash.ts`):**
  ```typescript
  export function generateOrderId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomUUID().slice(0, 8);
    return `kn_${timestamp}_${random}`;
  }
  ```
  **Validation in ekyash-cancel-invoice:**
  ```typescript
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(orderId)) {
    return errorResponse('Invalid orderId format');
  }
  ```
- **Impact:** Invoice cancellation, refunds, and invoice info queries are **completely broken**. Any call with a real orderId returns 400 "Invalid orderId format". Users cannot cancel pending payments, request refunds, or check invoice status.
- **Remediation:** Replace UUID validation with the actual orderId format:
  ```typescript
  const ORDER_ID_RE = /^kn_[a-z0-9]+_[a-f0-9]{8}$/;
  if (!ORDER_ID_RE.test(orderId)) {
    return errorResponse('Invalid orderId format');
  }
  ```

---

## High Findings

### H-01 — send-email-receipt Unreachable from ekyash-callback

- **Severity:** High
- **Functions:** `ekyash-callback`, `send-email-receipt`
- **Description:** When `ekyash-callback` processes an approved payment, it calls `send-email-receipt` with the service role key as the Bearer token. However, `send-email-receipt` uses `verifyAuth()` (not `verifyAuthOrInternal()`). The `verifyAuth` function calls `supabase.auth.getUser(token)` which fails for service-role keys because they are not user JWTs. The `.catch(() => {})` swallows the error silently.
- **Evidence (ekyash-callback L108-118):**
  ```typescript
  fetch(`${supabaseUrl}/functions/v1/send-email-receipt`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,  // ← service role key
    },
    body: JSON.stringify({ userId: txn.payer_id, ... }),
  }).catch(() => {});  // ← failure is silently swallowed
  ```
  **send-email-receipt L14-16:**
  ```typescript
  const authResult = await verifyAuth(req);  // ← requires user JWT, not service key
  if ('error' in authResult) return authResult.error;  // ← always fails for service key
  ```
- **Impact:** Email receipts are **never sent** from the payment callback flow. Users do not receive confirmation emails after successful E-Kyash payments. The only way receipts get sent is if the user manually triggers them (if that flow exists).
- **Remediation:** Change send-email-receipt to use `verifyAuthOrInternal()`:
  ```typescript
  const authResult = await verifyAuthOrInternal(req);
  if ('error' in authResult) return authResult.error;
  // When called internally (callerId is null), trust the userId from the body
  const callerId = authResult.userId;
  // ... if callerId is not null, enforce callerId === userId
  ```

---

### H-02 — All Functions Use Wildcard CORS `Access-Control-Allow-Origin: *`

- **Severity:** High
- **Functions:** All 13 functions
- **File:** `_shared/supabase.ts`
- **Description:** The restrictive `getCorsHeaders(req)` function exists with an allowlist of origins but is **never imported or used** by any function. All functions import and use `corsHeaders` which sets `Access-Control-Allow-Origin: *`. Both the OPTIONS preflight responses and all JSON responses use the wildcard.
- **Evidence:**
  ```typescript
  // _shared/supabase.ts — defined but never used
  export function getCorsHeaders(req?: Request) { /* origin-restrictive */ }

  // All functions use wildcard:
  export const corsHeaders = { 'Access-Control-Allow-Origin': '*', ... };
  ```
  **Grep confirms**: `getCorsHeaders` has 0 imports across all function files.
- **Impact:** Any website can make cross-origin requests to user-facing edge functions (ekyash-*, send-sms-sos, send-email-receipt). While JWT auth prevents unauthorized actions, this weakens defense-in-depth. A phishing site could exploit a victim's stored JWT or CSRF-adjacent attacks in browsers that auto-send auth headers.
- **Remediation:** Replace `corsHeaders` with `getCorsHeaders(req)` in all functions. Update `jsonResponse()` to accept the request and use restrictive headers.

---

### H-03 — PostgREST Filter Injection in ekyash-invoice-info

- **Severity:** High
- **OWASP:** A03 — Injection
- **Function:** `ekyash-invoice-info`
- **Description:** The `invoiceId` parameter is type-checked with `typeof invoiceId !== 'string'` (which passes **all strings**) and then interpolated directly into a PostgREST `.or()` filter without escaping. An attacker can inject additional filter operators.
- **Evidence:**
  ```typescript
  if (invoiceId && typeof invoiceId !== 'string') return errorResponse('Invalid invoiceId format');
  // ^ This check is inverted — it passes ALL strings, rejects non-strings

  // Later:
  .or(`order_id.eq.${orderId ?? ''},invoice_id.eq.${invoiceId ?? ''}`)
  // invoiceId could contain: "x,payer_id.eq.TARGET" → leaks other users' transactions
  ```
- **Impact:** An authenticated user can manipulate the PostgREST query to access other users' transaction data (payer_id, payee_id, amounts, status). The ownership check after the query only runs if `txn` is found, and the injected filter could return a different user's transaction.
- **Remediation:** Validate invoiceId format properly and use parameterized queries:
  ```typescript
  // Use separate .eq() calls instead of .or() string interpolation
  let query = supabase.from('ekyash_transactions').select('payer_id, payee_id');
  if (orderId) query = query.eq('order_id', orderId);
  else query = query.eq('invoice_id', invoiceId);
  ```

---

## Medium Findings

### M-01 — ekyash-callback Lacks Idempotency Guard

- **Severity:** Medium
- **Function:** `ekyash-callback`
- **Description:** Webhook providers commonly retry callbacks on network failures or timeouts. The callback handler has no idempotency check — processing a duplicate callback would re-update the transaction status, re-update booking/contract status, re-insert notification rows, and re-trigger the email receipt attempt.
- **Evidence:** The update uses `.eq('order_id', orderId)` without checking if the transaction was already processed:
  ```typescript
  const { data: txn, error: updateError } = await supabase
    .from('ekyash_transactions')
    .update({ status, callback_received: true, ... })
    .eq('order_id', orderId)
    .select()
    .single();
  // No check: if (txn.callback_received) return jsonResponse({ status: 'already_processed' });
  ```
- **Impact:** Duplicate notifications to users, duplicate email receipt attempts, and potentially double-counting if donation triggers fire multiple times.
- **Remediation:** Check `callback_received` before processing:
  ```typescript
  // Fetch first, then conditionally update
  const { data: existing } = await supabase
    .from('ekyash_transactions')
    .select('callback_received, status')
    .eq('order_id', orderId)
    .single();
  if (existing?.callback_received) {
    return jsonResponse({ status: 'already_processed' });
  }
  ```

---

### M-02 — ekyash-callback Cascading Updates Are Non-Transactional

- **Severity:** Medium
- **Function:** `ekyash-callback`
- **Description:** On approved payment, the function sequentially updates: (1) ekyash_transactions → (2) bookings → (3) contracts → (4) notifications → (5) email receipt. Each is a separate Supabase call with no transaction wrapping. If any step fails (e.g., contract update fails), earlier steps are not rolled back.
- **Evidence:**
  ```typescript
  // Step 2
  await supabase.from('bookings').update({ status: 'confirmed' }).eq('ekyash_invoice_id', invoiceId);
  // Step 3 — if this fails, booking is confirmed but contract isn't active
  await supabase.from('contracts').update({ status: 'active' }).eq('id', txn.contract_id);
  ```
- **Impact:** Partial payment processing creates inconsistent state — e.g., booking confirmed but contract not active, or payment approved but no notifications sent.
- **Remediation:** Wrap the cascading updates in a Postgres RPC function that runs inside a transaction, or implement a compensating action / retry queue.

---

### M-03 — process-strikes TOCTOU Race Condition on Strike Count

- **Severity:** Medium
- **Function:** `process-strikes`
- **Description:** The function reads the current strike count, increments in JavaScript, then writes back. Two concurrent calls for the same user both read the same count and both write `count + 1` instead of `count + 2`.
- **Evidence:**
  ```typescript
  const { data: profile } = await supabase.from('profiles')
    .select('strikes_soft, strikes_hard, account_status')
    .eq('id', userId).single();
  const newCount = (profile[field] ?? 0) + 1;     // ← both calls compute same value
  await supabase.from('profiles').update({ [field]: newCount }).eq('id', userId);
  ```
- **Impact:** Lost strike increments. In the worst case, a user avoids the 3-strike escalation to restricted status because concurrent increments are lost.
- **Remediation:** Use an atomic SQL increment:
  ```typescript
  // Use Supabase RPC or raw SQL for atomic increment
  const { data } = await supabase.rpc('increment_strike', {
    p_user_id: userId,
    p_field: field,
  });
  ```
  Or use Postgres `UPDATE profiles SET strikes_soft = strikes_soft + 1 WHERE id = $1 RETURNING strikes_soft`.

---

### M-04 — expire-posts Sequential Booking Cancellation

- **Severity:** Medium
- **Function:** `expire-posts`
- **Description:** After expiring posts, the function cancels pending bookings in a sequential loop — one query per expired post. On a busy day with many expired posts, this could exceed the edge function timeout (typically 25–60s).
- **Evidence:**
  ```typescript
  for (const post of expiredPosts) {
    await supabase.from('bookings').update({ ... })
      .eq('post_id', post.id)
      .in('status', ['pending', 'confirmed']);
  }
  ```
- **Impact:** Function timeout causes partial expiration — some expired posts have bookings cancelled, others don't. Also creates notification inconsistency.
- **Remediation:** Batch the cancellation into a single query using `.in('post_id', expiredPostIds)`:
  ```typescript
  const expiredIds = expiredPosts.map(p => p.id);
  await supabase.from('bookings').update({ ... })
    .in('post_id', expiredIds)
    .in('status', ['pending', 'confirmed']);
  ```

---

### M-05 — send-email-receipt HTML Template Has No Output Encoding

- **Severity:** Medium
- **OWASP:** A03 — Injection (XSS)
- **Function:** `send-email-receipt`
- **Description:** User-controlled values (`userName`, `description`, `reference`) are interpolated directly into the HTML email template without HTML entity encoding. If a user's name or address contains `<script>` or other HTML, it would be rendered by email clients that support HTML.
- **Evidence:**
  ```typescript
  <p style="color:#656e5e;">Hi ${params.userName},</p>
  // params.userName comes from profiles.first_name + last_name
  <span style="color:#142800;">${params.description}</span>
  // params.description comes from contracts.origin_address + dest_address
  ```
- **Impact:** Stored XSS in email context. Most modern email clients strip scripts, but HTML injection could alter email layout/content for phishing. Risk is low due to validation at form boundaries, but defense-in-depth requires encoding.
- **Remediation:** Add HTML entity encoding:
  ```typescript
  function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
              .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  ```

---

## Low Findings

### L-01 — update-rating-avg Fetches All Ratings Client-Side

- **Severity:** Low
- **Function:** `update-rating-avg`
- **Description:** The function fetches every rating row for a user and computes the average in JavaScript. For a user with hundreds of ratings, this transfers unnecessary data and wastes CPU.
- **Evidence:**
  ```typescript
  const { data: ratings } = await supabase.from('ratings')
    .select('stars, was_on_time').eq('rated_id', userId);
  const totalStars = ratings.reduce((sum, r) => sum + r.stars, 0);
  const ratingAvg = totalStars / ratings.length;
  ```
- **Remediation:** Use a SQL aggregate via RPC:
  ```sql
  SELECT ROUND(AVG(stars)::numeric, 2) as rating_avg,
         ROUND(COUNT(*) FILTER (WHERE was_on_time) * 100.0 /
               NULLIF(COUNT(*) FILTER (WHERE was_on_time IS NOT NULL), 0))::int as punctuality_pct,
         COUNT(*) as total_rides
  FROM ratings WHERE rated_id = p_user_id;
  ```

---

### L-02 — ekyash-callback Fire-and-Forget Email Swallows All Errors

- **Severity:** Low
- **Function:** `ekyash-callback`
- **Description:** The email receipt call uses `.catch(() => {})` which silently swallows all errors without logging.
- **Evidence:**
  ```typescript
  fetch(`.../send-email-receipt`, { ... }).catch(() => {
    // Best-effort — don't fail callback on email error
  });
  ```
- **Impact:** Combined with H-01, this means email receipt failures (which are 100% of the time due to the auth mismatch) are completely invisible. No logging, no monitoring signal.
- **Remediation:** Log the error:
  ```typescript
  }).catch((err) => { console.error('[callback] email receipt failed:', err); });
  ```

---

### L-03 — ekyash-create-invoice Performs Redundant E-Kyash Authorization

- **Severity:** Low
- **Function:** `ekyash-create-invoice`
- **Description:** The function first calls E-Kyash `/authorization` to get a session, then immediately uses that session to create an invoice. The authorization round-trip adds latency (~200-500ms) to every invoice creation. The session could potentially be cached or shared.
- **Impact:** Increased latency for the payment flow. Each invoice creation takes 2 sequential external API calls instead of 1.
- **Remediation:** Consider caching the E-Kyash session (if their API allows session reuse) or combining the auth+create into a single edge function call chain.

---

## Info

### I-01 — getCorsHeaders() Is Dead Code

- **Severity:** Info
- **File:** `_shared/supabase.ts`
- **Description:** The `getCorsHeaders(req)` function with origin restrictions was added (likely during Phase 1 fixes) but never adopted by any function. All functions continue to import and use the wildcard `corsHeaders`.

---

### I-02 — Description Parameter Passed Unsanitized to E-Kyash API

- **Severity:** Info
- **Function:** `ekyash-create-invoice`
- **Description:** The `description` field from the request body is passed directly to E-Kyash's `create-new-invoice` endpoint. If E-Kyash's system is vulnerable to injection in their processing of this field, it could be exploited. Kanek has no control over E-Kyash's input handling.
- **Remediation:** Truncate and sanitize the description before sending to the third-party API:
  ```typescript
  const safeDesc = (description || `kanek payment - ${orderId}`).slice(0, 100).replace(/[<>&"]/g, '');
  ```

---

## Summary

| Severity | Count | IDs |
|----------|-------|-----|
| Critical | 2 | C-01, C-02 |
| High | 3 | H-01, H-02, H-03 |
| Medium | 5 | M-01, M-02, M-03, M-04, M-05 |
| Low | 3 | L-01, L-02, L-03 |
| Info | 2 | I-01, I-02 |
| **Total** | **15** | |

### Blocked Payment Flows

The combination of C-01 + C-02 + H-01 means that **three of the six E-Kyash payment functions are non-functional**:

| Function | Status | Blocking Issue |
|----------|--------|---------------|
| ekyash-authorize | ⚠️ Partially broken | C-01: catch block syntax error — works unless exception thrown |
| ekyash-create-invoice | ⚠️ Partially broken | C-01: catch block syntax error — works unless exception thrown |
| ekyash-callback | ⚠️ Partially broken | C-01: catch block syntax error — works unless exception thrown |
| ekyash-cancel-invoice | ❌ Completely broken | C-02: UUID validation rejects all valid orderIds |
| ekyash-invoice-info | ❌ Completely broken | C-02: UUID validation rejects all valid orderIds |
| ekyash-refund | ❌ Completely broken | C-02: UUID validation rejects all valid orderIds |

Email receipts from payment callbacks: ❌ **Never sent** (H-01)

---

## Fix Status

**Date Applied:** 2025-07-27
**Files Modified:** 14 (13 edge functions + 1 shared module)

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| C-01 | Catch block syntax errors | ✅ Fixed | 3 files: ekyash-authorize, ekyash-create-invoice, ekyash-callback |
| C-02 | orderId UUID rejects valid IDs | ✅ Fixed | 3 files: ekyash-cancel-invoice, ekyash-invoice-info, ekyash-refund — now uses `ORDER_ID_RE` |
| H-01 | send-email-receipt auth mismatch | ✅ Fixed | Changed to `verifyAuthOrInternal`, adjusted ownership check for internal calls |
| H-02 | Wildcard CORS `*` | ✅ Fixed | All 14 files: `corsHeaders` → `getCorsHeaders(req)` with origin allowlist |
| H-03 | PostgREST filter injection | ✅ Fixed | Replaced `.or()` template literal with parameterized `.eq()` calls; moved ownership check before E-Kyash API call |
| M-01 | Callback idempotency | ✅ Fixed | Added `callback_received` check before processing |
| M-02 | Non-transactional cascading updates | ⏳ Deferred | Requires Postgres RPC transaction wrapper — architectural change |
| M-03 | Strike count TOCTOU race | ✅ Fixed | Replaced read-increment-write with count from strikes table (count-then-set) |
| M-04 | Sequential booking cancellation | ✅ Fixed | Replaced N+1 loop with batched `.in('post_id', expiredIds)` |
| M-05 | HTML template no encoding | ✅ Fixed | Added `escapeHtml()` applied to all user-controlled values in `buildReceiptHtml` |
| L-01 | Rating avg client-side | ⏳ Deferred | Optimization — not a security issue. Requires SQL RPC migration |
| L-02 | Silent email error swallowing | ✅ Fixed | Changed `.catch(() => {})` to `.catch((err) => console.error(...))` |
| L-03 | Redundant E-Kyash auth | ⏳ Deferred | Optimization — depends on E-Kyash session reuse support |
| I-01 | getCorsHeaders dead code | ✅ Fixed | Resolved by H-02 — all functions now use `getCorsHeaders(req)` |
| I-02 | Description unsanitized to E-Kyash | ✅ Fixed | Added `.replace(/[<>&"']/g, '').slice(0, 200)` before E-Kyash API call |

**Summary:** 12/15 fixed, 3 deferred (M-02, L-01, L-03 — all require architectural changes or are pure optimizations)
