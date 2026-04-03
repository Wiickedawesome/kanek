# Kanek — Production Security & Code Audit

**Date:** 2025-07  
**Auditor:** AI Audit Agent  
**Scope:** Full codebase — TypeScript safety, Supabase RLS, edge function security, auth flows, logic correctness, mobile-specific concerns

---

## Findings by Severity

### CRITICAL

---

#### C-1 — All invocable edge functions lack caller authentication

**OWASP:** A01:2021 Broken Access Control  
**Files:** `supabase/functions/ekyash-authorize/index.ts`, `ekyash-create-invoice/index.ts`, `ekyash-cancel-invoice/index.ts`, `ekyash-refund/index.ts`, `ekyash-invoice-info/index.ts`, `send-sms-sos/index.ts`, `notify-user/index.ts`, `send-push/index.ts`, `send-email-receipt/index.ts`

**Evidence:**
Every invocable edge function accepts POST requests from any HTTP client that supplies the public anon key. None of them extract or validate the incoming `Authorization: Bearer <user-jwt>` header. A grep for `getUser|auth\.uid|req\.headers` across all edge function `.ts` files returned zero hits for any incoming-request JWT validation.

Example — `ekyash-create-invoice/index.ts` accepts `payerId`, `payeeId`, `contractId`, `amountCents` directly from the request body and creates a real payment invoice against E-Kyash with the service role, all without checking that the HTTP caller is `payerId`:
```typescript
// No auth check — entire function proceeds with body-supplied IDs
const { contractId, payerId, payeeId, amountCents, donationCents } = await req.json();
const supabase = createServiceClient(); // bypasses RLS
```

Example — `send-sms-sos/index.ts` triggers a Twilio SMS to any user's emergency contact:
```typescript
const { userId, message, coords } = await req.json();
// 'userId' comes from the attacker's request body — no verification
const { data: profile } = await supabase.from('profiles').select('emergency_contact, ...').eq('id', userId).single();
```

**Impact:**
- Any client with the public anon key can create payment invoices for arbitrary users, cancel or refund arbitrary transactions, trigger SOS alerts for arbitrary users, push-notify any user, and insert notification records for any user.
- The E-Kyash payment functions in particular could be chained to disrupt other users' payment flows.

**Status:** Fixed — see `supabase/functions/_shared/supabase.ts` (`verifyAuth`, `verifyAuthOrInternal`) and individual function updates.

---

#### C-2 — `profiles_select_public` exposes sensitive PII to all authenticated users

**OWASP:** A01:2021 Broken Access Control  
**File:** `supabase/migrations/00009_rls_policies.sql`

**Evidence:**
```sql
CREATE POLICY "profiles_select_public" ON profiles
  FOR SELECT TO authenticated
  USING (true);  -- any authenticated user reads any row, all columns
```

Any authenticated user can query `supabase.from('profiles').select('*').eq('id', 'victim-uuid')` and receive: `emergency_contact`, `push_token`, `phone`, `email`, `strikes_soft`, `strikes_hard`, `phone_changed_at`.

**Impact:**
- `emergency_contact` is PII usable for targeted phishing / social engineering.
- `push_token` combined with C-1 (unfixed) allows anyone to push-spam any user given their UUID.
- `phone` / `email` expose contact info for all registered users.

**Partial fix applied:** Migration `00041_profiles_public_view.sql` creates a `profiles_public` view with only safe columns. Full remediation requires updating all PostgREST JOIN queries to use this view — see Phase 6 suggestions.

---

### HIGH

---

#### H-1 — `phone-verify.tsx` hardcodes post-OTP redirect, ignores onboarding state

**File:** `app/(auth)/phone-verify.tsx`

**Evidence:**
```typescript
// Line 84 — unconditionally navigates to role-select after OTP success
router.replace('/(auth)/role-select');
```

The `app/(auth)/_layout.tsx` already implements the correct logic: it calls `useOnboardingStatus()` which computes `nextAuthRoute` and redirects the user to the appropriate step (`role-select`, `id-upload`, `driver-docs`, or the main feed). The hardcoded `router.replace` in `phone-verify.tsx` fires before the auth state settles and always lands the user on `role-select`, regardless of how far through onboarding they are.

**Impact:** Returning users who have already completed onboarding are re-routed through the onboarding flow on every login. Drivers who completed role-select but not driver-docs are skipped directly back to role-select rather than driver-docs.

**Status:** Fixed — `router.replace` removed; auth listener + layout guard handle redirect.

---

#### H-2 — `upvote_road_report` and `verify_gas_price` RPCs have no per-user deduplication

**File:** `supabase/migrations/00034_secure_report_actions.sql`

**Evidence:**
```sql
CREATE OR REPLACE FUNCTION upvote_road_report(report_id UUID)
...
  UPDATE road_reports
  SET upvotes = upvotes + 1  -- no check if this user already upvoted
  WHERE id = report_id
```

The function checks authentication (`IF auth.uid() IS NULL`) but does not prevent the same user from calling it multiple times. Each call increments the counter.

**Impact:** Vote counts can be inflated arbitrarily by any authenticated user, corrupting road condition data that other users rely on.

**Status:** Fixed — migration `00041_deduplicate_upvotes.sql` adds `road_report_votes` and `gas_price_verifications` junction tables with unique constraints; RPCs updated to INSERT before incrementing (duplicate = no-op).

---

#### H-3 — Phone change rate limit is client-side only

**File:** `src/store/api/profilesApi.ts`

**Evidence:**
The 30-day rate limit check reads `phone_changed_at` from the database, but the enforcement is inside the RTK Query `queryFn` — it is completely bypassable by calling `supabase.auth.updateUser({ phone: newPhone })` directly from any Supabase client. No DB-level constraint or trigger prevents this.

**Impact:** A malicious user can change their phone number arbitrarily often, bypassing the fraud-prevention intent of the rate limit.

**Status:** Fixed — migration `00042_phone_change_rate_limit_trigger.sql` adds a `BEFORE UPDATE` trigger on `profiles.phone_changed_at` that raises an exception when the interval is less than 30 days.

---

### MEDIUM

---

#### M-1 — Realtime notification payload cast to `any`

**File:** `src/hooks/useRealtime.ts`

**Evidence:**
```typescript
(payload) => {
  const notif = payload.new as any;   // unsafe — all property accesses unchecked
  dispatch(addNotification(notif));
  dispatch(showToast({ title: notif.title ?? 'New notification', body: notif.body }));
```

`payload.new` from a `postgres_changes` event has the row's runtime shape, which should match `Database['public']['Tables']['notifications']['Row']`.

**Impact:** TypeScript cannot catch mistyped property accesses (`notif.titl`, etc.). No runtime protection if the schema changes.

**Status:** Fixed — cast replaced with the correct `Database` type.

---

#### M-2 — `messagesApi.ts` fire-and-forget push swallows errors silently

**File:** `src/store/api/messagesApi.ts`

**Evidence:**
```typescript
supabase.functions.invoke('send-push', {   // not awaited
  body: { userId: recipientId, ... },
});
```

The `functions.invoke` call is not awaited. The `catch` block above only prevents the mutation from failing, but any error from the push (invalid push token, edge function 5xx, etc.) is silently discarded with no logging.

**Impact:** Push notification failures are completely invisible in production, making the feature impossible to debug.

**Status:** Fixed — `.invoke` is now awaited inside the existing `try/catch`, error is `console.warn`-logged.

---

### LOW

---

#### L-1 — Wildcard CORS on all edge functions

**File:** `supabase/functions/_shared/supabase.ts`

**Evidence:**
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  ...
};
```

**Impact:** Not directly exploitable since Supabase anon key is already public, but allows any origin to make credentialed requests to production edge functions. Should be scoped to `https://kanek.bz` in production.

**Recommendation (not fixed — see Phase 6):** Add a `CORS_ORIGIN` environment variable and set `Access-Control-Allow-Origin` to that value in production.

---

#### L-2 — `ekyash-callback` does not restrict by E-Kyash IP ranges

**File:** `supabase/functions/ekyash-callback/index.ts`

**Evidence:** The webhook correctly validates the HMAC-SHA256 signature but does not filter by source IP.

**Impact:** Low — HMAC validation is the primary control and is sufficient. IP allowlisting would add defense-in-depth if E-Kyash publishes its IP ranges.

---

#### L-3 — `expires-posts` / `process-strikes` cron functions are publicly invocable

**Files:** `supabase/functions/expire-posts/index.ts`, `process-strikes/index.ts`

**Evidence:** These functions have no caller authentication, making them callable by anyone with the anon key. Calling `expire-posts` prematurely could bulk-cancel active posts.

**Recommendation (not fixed — see Phase 6):** Add a cron-secret check: compare `Authorization` header value against a stored `CRON_SECRET` env var.

---

## Summary Table

| ID | Severity | Category | File(s) | Status |
|----|----------|----------|---------|--------|
| C-1 | Critical | Auth / Access Control | 9 edge functions | ✅ Fixed |
| C-2 | Critical | RLS / PII Exposure | `00009_rls_policies.sql` | ⚠️ Partial fix |
| H-1 | High | Logic / Navigation | `phone-verify.tsx` | ✅ Fixed |
| H-2 | High | Logic / Data Integrity | `00034_secure_report_actions.sql` | ✅ Fixed |
| H-3 | High | Auth / Rate Limiting | `profilesApi.ts` | ✅ Fixed |
| M-1 | Medium | TypeScript Safety | `useRealtime.ts` | ✅ Fixed |
| M-2 | Medium | Observability | `messagesApi.ts` | ✅ Fixed |
| L-1 | Low | CORS | `_shared/supabase.ts` | 📋 Suggested |
| L-2 | Low | Defense-in-depth | `ekyash-callback/index.ts` | 📋 Suggested |
| L-3 | Low | Auth / Cron Abuse | `expire-posts`, `process-strikes` | 📋 Suggested |

---

## Phase 6 — Improvement Suggestions (not implemented)

### S-1  Narrow CORS to production origin
Set `Access-Control-Allow-Origin: https://kanek.bz` (or `https://kanek.app`) via `CORS_ORIGIN` env var instead of `*`. Add a fallback for local dev.

### S-2  Protect cron edge functions with a shared secret
```typescript
// In expire-posts / process-strikes:
const cronSecret = Deno.env.get('CRON_SECRET');
const incoming = req.headers.get('Authorization')?.replace('Bearer ', '');
if (!cronSecret || incoming !== cronSecret) return errorResponse('Forbidden', 403);
```

### S-3  Rate-limit `notify-user` per sender
Currently any authenticated user can invoke `notify-user` for any target with no per-sender rate limit. Add a Redis-style per-user counter (Supabase KV or a `notification_rate_limits` DB table) capped at N notifications per minute.

### S-4  Full remediation of C-2 (profiles PII)
Drop `profiles_select_public` and replace it with:
1. `profiles_select_own` — `USING (id = auth.uid())` (own row, all columns)
2. Update all PostgREST JOIN queries in RTK Query slices from `profiles(...)` to `profiles_public(...)` using the view created in migration `00041`.

This eliminates arbitrary cross-user PII reads at the DB level.

### S-5  E-Kyash callback IP allowlist
Request E-Kyash's IP egress ranges and add an IP allow check in `ekyash-callback/index.ts` before signature validation.

### S-6  Push token encryption at rest
`push_token` is stored in plaintext in the `profiles` table. Encrypt it with `pgcrypto` extensions (`pgp_sym_encrypt`) since it is a credential that enables push delivery.

### S-7  Contract messages RLS: restrict to contract parties
The current `contract_messages` RLS allows a user to read messages if they are the `sender_id`. Consider adding a check that `auth.uid() = ANY(SELECT parties FROM contracts WHERE id = contract_id)` to prevent the sender querying other contracts' threads by guessing UUIDs.

### S-8  Structured logging in edge functions
Replace `console.error` calls with structured JSON logs so Supabase log drains (Datadog / Logflare) can alert on function errors.
