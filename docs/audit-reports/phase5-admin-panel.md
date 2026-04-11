# Phase 5 — Admin Panel & Configuration Audit Report

**Date:** 2025-07-15
**Scope:** Complete Next.js admin panel — auth middleware, API routes, server components, client components, Supabase client factories, shared UI
**Files Reviewed:** 30+ files across `admin/app/`, `admin/lib/`, `admin/components/`

---

## Executive Summary

The Kanek admin panel implements a solid auth architecture — middleware checks every route for admin role, API routes enforce defense-in-depth auth verification, and the `createAdminSupabase()` service_role pattern is properly isolated to server-only code. However, the audit identified **13 findings** (0 Critical, 0 High, 6 Medium, 4 Low, 3 Info) primarily around **flag moderation trusting client-provided target IDs** (allowing action against unrelated entities), **no protection against admin-on-admin actions** (one admin can suspend another), **unbounded queries on list pages**, and **missing input validation** at API route boundaries (no UUID validation, no reason length limits, no JSON parse error handling).

---

## Findings Summary

| ID | Severity | Category | Finding | Location |
|----|----------|----------|---------|----------|
| F5-M-01 | Medium | Authorization | Flag action route trusts client-provided targetType/targetId | `api/flags/action/route.ts` |
| F5-M-02 | Medium | Authorization | Admin can suspend/strike other admin accounts | `api/users/action/route.ts`, `api/flags/action/route.ts` |
| F5-M-03 | Medium | Input Validation | No UUID format validation on entity ID parameters | All 5 API routes |
| F5-M-04 | Medium | Performance/DoS | Unbounded queries on list pages (no pagination/limit) | `users/page.tsx`, `drivers/page.tsx`, `riders/page.tsx`, `flags/page.tsx` |
| F5-M-05 | Medium | Error Handling | `request.json()` called without try-catch in all API routes | All 5 API routes |
| F5-M-06 | Medium | Input Validation | No `reason` field length validation in API routes or client | All API routes + all action components |
| F5-L-01 | Low | Info Leak | Supabase error messages leaked to client in API responses | `api/admins/invite/route.ts`, `api/drivers/review/route.ts`, `api/riders/review/route.ts` |
| F5-L-02 | Low | Auth | Weak admin password requirements (only ≥8 chars) | `api/admins/invite/route.ts` |
| F5-L-03 | Low | Input Validation | Login phone input lacks format validation and maxLength | `login/page.tsx` |
| F5-L-04 | Low | Input Validation | Admin invite form firstName/lastName lack maxLength | `admins/InviteAdminForm.tsx` |
| F5-I-01 | Info | Architecture | Redundant auth checks in API routes (defense in depth — good) | All 5 API routes |
| F5-I-02 | Info | Architecture | All server components use service_role key (expected for admin) | All server pages |
| F5-I-03 | Info | Business Logic | Flag strikes always issued as 'soft' type | `api/flags/action/route.ts` |

---

## Detailed Findings

### F5-M-01 — Flag Action Route Trusts Client-Provided targetType/targetId [Medium]

**Location:** [admin/app/api/flags/action/route.ts](admin/app/api/flags/action/route.ts)

**Description:**
The flag moderation API route receives `targetType` and `targetId` from the client request body and uses them directly to perform moderation actions (removing posts, suspending users, issuing strikes). It does **not** verify these values match the actual `target_type`/`target_id` stored on the flag record.

A rogue admin could craft a request with a valid `flagId` but substitute different `targetType`/`targetId` values, causing the route to suspend an unrelated user or remove an unrelated post while marking the flag as resolved.

```typescript
// Current — trusts client
const { flagId, targetType, targetId, action, reason } = body;
// Uses targetId directly for suspend/remove/strike without verifying against flag record
```

**Impact:** An authenticated admin could take moderation actions against any user or post by proxying through any valid flag ID.

**Recommendation:** Fetch the flag record first and use its `target_type`/`target_id` instead of client-supplied values.

**Status:** ✅ Fixed

---

### F5-M-02 — Admin Can Suspend/Strike Other Admin Accounts [Medium]

**Location:** [admin/app/api/users/action/route.ts](admin/app/api/users/action/route.ts), [admin/app/api/flags/action/route.ts](admin/app/api/flags/action/route.ts)

**Description:**
The user action route allows suspending any user by ID without checking if the target is an admin. One admin could suspend or strike another admin account, potentially locking out all other admins. The flag action route similarly allows issuing strikes or suspending users resolved from posts, without admin protection.

```typescript
// No check that target user is not an admin
const { error } = await supabase
  .from('profiles')
  .update({ account_status: newStatus })
  .eq('id', userId);
```

**Impact:** Rogue or compromised admin session could deactivate other admin accounts, causing admin lockout.

**Recommendation:** Check if the target user has role `admin` and reject the action if so (or require super-admin privileges).

**Status:** ✅ Fixed

---

### F5-M-03 — No UUID Format Validation on Entity ID Parameters [Medium]

**Location:** All 5 API routes

**Description:**
All API routes accept entity IDs (`userId`, `driverId`, `docId`, `flagId`, `targetId`) from request bodies and pass them directly to Supabase queries without validating UUID format. While Postgres will reject invalid UUIDs, the resulting error messages may leak schema details (column types, table names, constraint names).

**Impact:** Non-UUID strings cause Postgres errors that may expose internal schema information. Unnecessary database round-trips for obviously invalid input.

**Recommendation:** Add a UUID regex check at the boundary: `/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`

**Status:** ✅ Fixed

---

### F5-M-04 — Unbounded Queries on List Pages [Medium]

**Location:** [admin/app/(admin)/users/page.tsx](admin/app/(admin)/users/page.tsx), [admin/app/(admin)/drivers/page.tsx](admin/app/(admin)/drivers/page.tsx), [admin/app/(admin)/riders/page.tsx](admin/app/(admin)/riders/page.tsx), [admin/app/(admin)/flags/page.tsx](admin/app/(admin)/flags/page.tsx)

**Description:**
Four list pages fetch all records without any `.limit()`. The posts and transactions pages already use `.limit(100)`. As the user base grows, unbounded queries will cause slow page loads, high memory usage on the server, and could potentially time out or cause OOM conditions.

**Impact:** Performance degradation at scale; potential denial of service for admin panel.

**Recommendation:** Add `.limit(200)` to all list queries. Consider adding server-side pagination in a future iteration.

**Status:** ✅ Fixed

---

### F5-M-05 — `request.json()` Without Try-Catch in All API Routes [Medium]

**Location:** All 5 API routes

**Description:**
All API routes call `await request.json()` without error handling. If a client sends malformed JSON, an empty body, or a non-JSON content type, this throws an unhandled exception resulting in a 500 error. In development mode, the error response may reveal stack traces and internal paths.

**Impact:** Unhandled exception on malformed input; potential information disclosure via error details.

**Recommendation:** Wrap `request.json()` in try-catch and return a 400 response for parse failures.

**Status:** ✅ Fixed

---

### F5-M-06 — No `reason` Field Length Validation [Medium]

**Location:** All API routes + all client action components

**Description:**
The `reason` string field in all API routes is inserted into `admin_actions`, `notifications`, and `strikes` tables without any length limit. Client-side textareas also lack `maxLength` attributes. An admin could submit an extremely long reason string, bloating the database.

**Impact:** Unbounded string storage; potential database bloat.

**Recommendation:** Add `maxLength={500}` on client textareas and validate `reason.length <= 500` in API routes.

**Status:** ✅ Fixed

---

### F5-L-01 — Supabase Error Messages Leaked to Client [Low]

**Location:** [admin/app/api/admins/invite/route.ts](admin/app/api/admins/invite/route.ts), [admin/app/api/drivers/review/route.ts](admin/app/api/drivers/review/route.ts), [admin/app/api/riders/review/route.ts](admin/app/api/riders/review/route.ts)

**Description:**
Several API routes return raw Supabase error messages via `NextResponse.json({ error: error.message })`. These messages can contain table names, column names, constraint names, and other schema details.

**Impact:** Admin-only exposure, but schema detail leaks aid reconnaissance if an admin session is compromised.

**Recommendation:** Return generic error messages and log the detailed error server-side.

**Status:** ✅ Fixed

---

### F5-L-02 — Weak Admin Password Requirements [Low]

**Location:** [admin/app/api/admins/invite/route.ts](admin/app/api/admins/invite/route.ts)

**Description:**
Admin invite only enforces `password.length < 8`. No requirements for uppercase, lowercase, digit, or special character. Admin accounts have elevated privileges (service_role access, user management, moderation) and should use stronger password policies.

**Impact:** Weak admin passwords increase brute-force risk on admin accounts.

**Recommendation:** Enforce minimum complexity: at least one uppercase, one lowercase, one digit, minimum 12 characters.

**Status:** ✅ Fixed

---

### F5-L-03 — Login Phone Input Lacks Format Validation [Low]

**Location:** [admin/app/login/page.tsx](admin/app/login/page.tsx)

**Description:**
The admin login phone input accepts any string and just prepends `+501` if no `+` prefix. There's no `maxLength`, no Belize phone format validation, and no numeric-only enforcement (web browsers may ignore `inputMode="numeric"`).

**Impact:** Non-Belize numbers or malformed input could reach Supabase OTP API, wasting SMS credits.

**Recommendation:** Add `maxLength={7}` and validate the Belize phone format before sending OTP.

**Status:** ✅ Fixed

---

### F5-L-04 — Admin Invite Form Inputs Lack maxLength [Low]

**Location:** [admin/app/(admin)/admins/InviteAdminForm.tsx](admin/app/(admin)/admins/InviteAdminForm.tsx)

**Description:**
The `firstName` and `lastName` inputs in the invite admin form have no `maxLength` props. The `email` and `password` inputs are similarly unconstrained on the client side (though the API validates email format via Supabase and password length ≥ 8).

**Impact:** Oversized input strings reach the API; minor boundary concern.

**Recommendation:** Add `maxLength={50}` on name fields, `maxLength={100}` on email field.

**Status:** ✅ Fixed

---

### F5-I-01 — Redundant Auth Checks in API Routes (Defense in Depth) [Info]

**Location:** All 5 API routes

**Description:**
All API routes perform their own auth verification (`getUser()` + role check via `createServerSupabase()`), even though the middleware already performs identical checks for all `/api/*` routes. This results in two database queries per API request for auth verification.

This is good practice (defense in depth) — the middleware could theoretically be bypassed via misconfiguration, and the redundant check in each route provides a safety net.

**Impact:** Positive — additional security layer. Minor performance cost (extra DB query per request).

**Status:** Accepted — intentional design pattern.

---

### F5-I-02 — All Server Components Use service_role Key [Info]

**Location:** All server pages (`page.tsx`, `[id]/page.tsx`)

**Description:**
Every server component in the admin panel uses `createAdminSupabase()` which creates a client with the `SUPABASE_SERVICE_ROLE_KEY`, bypassing all RLS policies. This is expected for an admin panel since admins need unrestricted data access.

The `createAdminSupabase()` function is properly:
- Synchronous (no session persistence, no cookie access)
- Documented as server-only with a clear warning comment
- Not importable from client components (no `'use client'` in `server.ts`)

**Impact:** None — correct architecture for admin use case.

**Status:** Accepted — expected pattern.

---

### F5-I-03 — Flag Strikes Always Issued as 'soft' Type [Info]

**Location:** [admin/app/api/flags/action/route.ts](admin/app/api/flags/action/route.ts)

**Description:**
When issuing a strike through flag moderation, the type is hardcoded to `'soft'`. There is no option for admins to issue a `'hard'` strike directly from the flag review interface.

```typescript
await supabase.from('strikes').insert({
  user_id: strikeUserId,
  type: 'soft',   // always soft
  reason: 'report',
  auto_generated: false,
});
```

**Impact:** Limits moderation severity options. Admins cannot escalate directly to a hard strike without database-level intervention.

**Status:** Noted — may be intentional. Consider adding a strike type selector in a future iteration.

---

## Architecture Assessment

### Strengths
- **Middleware auth is comprehensive** — checks `getUser()` + admin role for all routes, returns proper HTTP status codes for API routes, redirects for pages
- **Defense in depth** — API routes duplicate auth checks that middleware already performs
- **Proper Supabase client separation** — `createServerSupabase()` (anon key + RLS) for auth verification, `createAdminSupabase()` (service_role) for data operations
- **Action logging** — all admin actions logged to `admin_actions` table with admin_id, action, target, reason
- **Notifications** — all user-facing actions (approve, reject, suspend) trigger user notifications
- **Action allowlists** — API routes validate actions against explicit string arrays, not open-ended

### Areas for Improvement
- Server-side pagination for list pages
- CSRF protection (currently relies on Supabase SSR SameSite cookies)
- IP-based access restriction for admin panel in production
- Activity logging for document access (signed URL generation)

---

## Summary

| Severity | Count | Fixed | Deferred | Accepted |
|----------|-------|-------|----------|----------|
| Critical | 0 | — | — | — |
| High | 0 | — | — | — |
| Medium | 6 | 6 | 0 | 0 |
| Low | 4 | 4 | 0 | 0 |
| Info | 3 | 0 | 0 | 3 |
| **Total** | **13** | **10** | **0** | **3** |
