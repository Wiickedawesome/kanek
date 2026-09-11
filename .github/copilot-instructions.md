# Kanek — Copilot Repository Guide

This file is the **factual reference manual** for the Kanek mobile repository.
Every claim in this file has been verified against the source on **2026-04-28**.

It tells the agent **what is true about this repo**: file paths, configuration values,
versions, tables, env vars, build profiles. It does **not** tell the agent how to behave —
behavioral rules live in `AGENTS.md`.

If you find a claim here that contradicts the live code, **fix this file first**, then
do the work. Do not silently work around stale documentation.

> Companion files
> - `AGENTS.md` — behavioral contract (how to act, when to ask, never-do list)
> - `.github/agents/kanek-mobile-workspace.agent.md` — multi-repo agent persona
> - `/home/wicked/Projects/kanek.bz` — sibling repo (public site + admin frontend)

---

## Table of Contents

1.  Product
2.  Tech stack — exact versions
3.  Directory layout
4.  Path aliases & module resolution
5.  Environment variables
6.  Supabase — project, auth, schema, RLS, storage
7.  Edge functions — inventory, contracts, deployment
8.  Mobile app architecture
9.  Navigation — tab isolation rule
10. State management — Redux + RTK Query
11. Auth flow — providers, callbacks, onboarding
12. Design system — tokens, fonts, icons
13. Maps — Mapbox & offline data
14. Notifications — Expo + FCM/APNs
15. Sentry — crash reporting & source maps
16. Mapbox & geocoding
17. Payments — E-Kyash status
18. EAS build profiles — truth table
19. EAS env — verified state
20. App configuration — `app.json` & `eas.json`
21. iOS distribution — Apple, certs, TestFlight
22. Android distribution — Play, keystore, tracks
23. Firebase — what's hosted there, what isn't
24. Cross-repo memory — kanek + kanek.bz
25. Database tables — full reference
26. Migration discipline
27. RLS rules of thumb
28. Validation rules — at boundaries
29. File-upload pattern (RN-specific)
30. Storage buckets & policies
31. Phone, prices, coordinates — exact formats
32. Common commands
33. Verification protocol — before claiming success
34. False-error filter — what is NOT a build failure
35. Files you must not touch without explicit instruction
36. Anti-patterns
37. Known issues & deferred work
38. Documentation map (`docs/`)
39. Glossary
40. Change log of this file

---

## 1. Product

Kanek is a **community mobility board for Belize**. It is **not** a dispatch system,
**not** Uber. It is a living feed where Belizeans post:

- **Ride offers** (`route_offer`) — driver going somewhere, has seats
- **Ride requests** (`route_request`) — passenger needs a ride
- **Errands** (`errand`) — pick up something for me
- **Packages** (`package`) — small-parcel delivery
- **Jobs** (`job`) — short-term gigs

The five post types are defined in `src/lib/constants.ts` as the
`POST_TYPES` tuple — `['route_offer', 'route_request', 'errand', 'package', 'job']`.

The app is launching in **Belize only**. Phone numbers are `+501` plus exactly 7
digits. Coordinates are validated against the **Belize bounding box** in
`src/lib/constants.ts`:

| Edge | Value |
|---|---|
| North | 18.497 |
| South | 15.889 |
| East | -87.485 |
| West | -89.225 |

There are six districts: Belize, Cayo, Corozal, Orange Walk, Stann Creek, Toledo.
Each district has a `DISTRICT_CENTERS` lat/lng entry in `src/lib/constants.ts`.

---

## 2. Tech stack — exact versions

Verified from `package.json` on 2026-04-28.

| Layer | Package | Version |
|---|---|---|
| Mobile runtime | `expo` | `^55.0.17` |
| Mobile runtime | `react` | `^19.2.0` |
| Mobile runtime | `react-native` | `0.83.6` |
| Routing | `expo-router` | `~55.0.13` |
| Language | `typescript` | `~5.9.2` (devDep) |
| State | `@reduxjs/toolkit` | `^2.6.1` |
| Backend SDK | `@supabase/supabase-js` | `^2.49.4` |
| Maps (native) | `@rnmapbox/maps` | `^10.3.0` |
| Crash reporting | `@sentry/react-native` | `~7.11.0` |
| Push | `expo-notifications` | `~55.0.20` |
| Captcha | `@hcaptcha/react-native-hcaptcha` | (see `package.json`) |
| Captcha (web) | `@hcaptcha/react-hcaptcha` | (see `package.json`) |
| Storage | `@react-native-async-storage/async-storage` | (see `package.json`) |

Node version: **v24 LTS** (declared in `.nvmrc`, EAS reads it during build).

Doctor warnings (non-fatal as of 2026-04-28):
- `expo` is `^55.0.17`; doctor expects `~55.0.18`
- `expo-notifications` is `~55.0.20`; doctor expects `~55.0.21`

These warnings do **not** block builds.

---

## 3. Directory layout

```
kanek/
├── .github/
│   ├── copilot-instructions.md       # this file (factual repo guide)
│   └── agents/
│       └── kanek-mobile-workspace.agent.md
├── AGENTS.md                          # behavioral contract
├── app/                               # Expo Router screens (file-based)
│   ├── _layout.tsx                    # root: Redux Provider, fonts, useAuthListener
│   ├── index.tsx                      # entry redirect (auth + onboarding gate)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx                # provider buttons + email entry
│   │   ├── login.tsx                  # email + OTP step (back chevron)
│   │   ├── role-select.tsx            # rider / driver / both
│   │   ├── id-upload.tsx              # gov-ID photo upload (exit chevron)
│   │   └── driver-docs.tsx            # license, insurance, vehicle (exit chevron)
│   ├── auth/
│   │   └── callback.tsx               # kanek://auth/callback handler (PKCE)
│   ├── (tabs)/
│   │   ├── _layout.tsx                # bottom tab nav + onboarding redirect
│   │   ├── explore/                   # feed, map, post detail
│   │   ├── post/                      # create-post forms (route, errand, package, job)
│   │   ├── activity/                  # bookings, contracts, notifications
│   │   └── profile/                   # profile, settings, documents, wallet, reports
│   └── modals/                        # SOS, rate, payment, reports, etc.
├── src/
│   ├── components/                    # all UI components
│   │   ├── cards/                     # post cards
│   │   ├── forms/                     # form inputs
│   │   ├── icons/                     # custom SVG icons (no emoji)
│   │   ├── map/                       # Mapbox wrappers
│   │   ├── payment/                   # E-Kyash flow (gated by ENABLE_EKYASH)
│   │   ├── profile/                   # profile cards, trust badges, ratings
│   │   ├── trip/                      # active-trip UI
│   │   ├── ui/                        # primitives (Button, TextInput, Badge, Card)
│   │   ├── HCaptcha.tsx               # native captcha (returns null when key empty)
│   │   ├── HCaptcha.web.tsx           # web captcha (same null-when-empty rule)
│   │   ├── PostDetailScreen.tsx       # shared logic; per-tab thin wrappers
│   │   ├── LegalScreen.tsx
│   │   ├── CameraCapture.tsx
│   │   └── CameraCapture.web.tsx
│   ├── hooks/
│   │   ├── useAuth.ts                 # signInWithProvider, signInWithOtp, signOut
│   │   ├── useOnboardingStatus.ts
│   │   ├── useNotifications.ts
│   │   ├── useRealtime.ts
│   │   ├── useDriverTracking.ts
│   │   └── useSOS.ts
│   ├── lib/
│   │   ├── alert.ts                   # showAlert / showConfirm (cross-platform)
│   │   ├── authRedirect.ts            # idempotent OAuth callback consumer
│   │   ├── avatar.ts
│   │   ├── belizeDistricts.ts
│   │   ├── belizePois.ts
│   │   ├── constants.ts               # PHONE_REGEX, BELIZE_BBOX, feature flags
│   │   ├── geocode.ts
│   │   ├── haptics.ts
│   │   ├── helpers.ts                 # safeGoBack, formatBZD, etc.
│   │   ├── invokeFunction.ts          # wrapper for Supabase function invocations
│   │   ├── legalContent.ts
│   │   ├── mapbox.ts
│   │   ├── notify.ts
│   │   ├── offline.ts
│   │   ├── sentry.ts
│   │   ├── supabase.ts                # client; PKCE; AsyncStorage
│   │   └── tripEvents.ts
│   ├── store/
│   │   ├── index.ts                   # store setup, all reducers registered here
│   │   ├── api/                       # 11 RTK Query API slices
│   │   ├── selectors/
│   │   └── slices/                    # 4 sync slices: auth, location, notifications, toast
│   ├── theme/
│   │   ├── colors.ts                  # forest, accent, neutral, error
│   │   ├── typography.ts              # Work Sans, Manrope
│   │   ├── spacing.ts
│   │   ├── shadows.ts
│   │   └── index.ts                   # barrel
│   ├── types/
│   │   ├── database.ts                # generated by supabase CLI
│   │   └── ekyash.ts
│   ├── data/
│   │   └── belize-pois.json
│   └── __tests__/
│       └── helpers.test.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/                    # 23 SQL files (verified)
│   ├── functions/                     # 16 Deno edge functions
│   └── templates/                     # email templates
├── android/                           # native Android (managed by Expo prebuild)
├── assets/                            # fonts, icons, splash
├── data/                              # POI / street datasets (build scripts)
├── docs/                              # architecture & reference docs
├── public/                            # web assets
├── scripts/
│   ├── launch-readiness.js
│   └── store-ready-check.js
├── app.json                           # Expo manifest
├── eas.json                           # EAS build/submit config
├── google-services.json               # FCM config (committed)
├── play-store-service-account.json    # Play submit credential
├── package.json
├── tsconfig.json
├── eslint.config.js
├── jest.config.js
└── jest.setup.js
```

---

## 4. Path aliases & module resolution

`tsconfig.json` defines `"@/*"` → `"src/*"`. Every import from `src/` should use the
alias. Examples:

```typescript
import { supabase } from '@/lib/supabase';
import { colors, typography, spacing } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';
import type { Database } from '@/types/database';
```

The `app/` directory does **not** use the alias because Expo Router resolves it
relative to the project root.

Platform-specific files use the `.web.tsx` suffix. Metro will pick `.web.tsx` for
web bundles and `.tsx` (or `.native.tsx`) for native. Examples in this repo:

| Native | Web |
|---|---|
| `src/components/HCaptcha.tsx` | `src/components/HCaptcha.web.tsx` |
| `src/components/CameraCapture.tsx` | `src/components/CameraCapture.web.tsx` |

---

## 5. Environment variables

### Mobile app (`EXPO_PUBLIC_*`, embedded in JS bundle)

These are embedded **at build time**. They are NOT secrets — anyone can extract
them from a published app. The Supabase anon key is safe to embed because RLS is
the security boundary.

| Var | Source | Purpose | Required |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project | API base URL | yes |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase project | anon JWT | yes |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox account | client-side map tile auth | yes |
| `EXPO_PUBLIC_ENABLE_EMAIL_AUTH` | feature flag | default `true` unless set to `'false'` | no |
| `EXPO_PUBLIC_ENABLE_GOOGLE_AUTH` | feature flag | only `'true'` enables it | no |
| `EXPO_PUBLIC_ENABLE_APPLE_AUTH` | feature flag | only `'true'` enables it | no |
| `EXPO_PUBLIC_HCAPTCHA_SITE_KEY` | hCaptcha account | captcha site key | **see §37** |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry project | runtime SDK init; without it `initSentry()` no-ops | yes for crash reporting |

> The hCaptcha site key is currently **empty**. The captcha components in
> `src/components/HCaptcha.tsx` and `HCaptcha.web.tsx` early-return `null` when
> the key is empty, which means **bot protection is currently bypassed**. This
> is a known issue tracked in §37; do not assume the captcha is active.

### Build-time (EAS env, not embedded in JS)

| Var | Visibility | Purpose |
|---|---|---|
| `SENTRY_AUTH_TOKEN` | sensitive | Sentry source-map upload during native build |
| `MAPBOX_DOWNLOAD_TOKEN` | (`storeTest` via `eas.json`) | Mapbox SDK download token for native |

### Edge function secrets (Supabase dashboard, Deno-side only)

These are **not** in any `.env` file. Set them via the Supabase dashboard under
Settings → Edge Functions → Secrets, or `supabase secrets set`.

| Var | Purpose |
|---|---|
| `EKYASH_SID` | E-Kyash merchant SID |
| `EKYASH_PIN_HASH` | E-Kyash auth secret |
| `EKYASH_API_KEY` | E-Kyash API key (used to sign JWTs) |
| `RESEND_API_KEY` | Resend SMTP / transactional email |

### Local development (`.env.local`)

Mirrors the public mobile vars only. Never commit. The file is in `.gitignore`.

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=...
EXPO_PUBLIC_ENABLE_EMAIL_AUTH=true
EXPO_PUBLIC_ENABLE_GOOGLE_AUTH=true
EXPO_PUBLIC_ENABLE_APPLE_AUTH=true
EXPO_PUBLIC_HCAPTCHA_SITE_KEY=     # empty until §37 is resolved
EXPO_PUBLIC_SENTRY_DSN=https://...@oNNN.ingest.us.sentry.io/NNN
```

### EAS env state (verified 2026-05-09)

| Variable | production | preview | development |
|---|:-:|:-:|:-:|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | ✅ | ✅ | ✅ |
| `EXPO_PUBLIC_ENABLE_EMAIL_AUTH=true` | ✅ | ✅ | ✅ |
| `EXPO_PUBLIC_ENABLE_GOOGLE_AUTH=true` | ✅ | ✅ | ✅ |
| `EXPO_PUBLIC_ENABLE_APPLE_AUTH=true` | ✅ | ✅ | ✅ |
| `EXPO_PUBLIC_HCAPTCHA_SITE_KEY` | ❌ missing (§37) | ❌ missing (§37) | ❌ missing (§37) |
| `EXPO_PUBLIC_SENTRY_DSN` | ✅ | ✅ | ✅ |
| `SENTRY_AUTH_TOKEN` (sensitive) | ✅ | ✅ | ✅ |

The current build profiles read runtime vars from `preview` for `deviceTest`
and `production` for `storeTest`.

To verify the live state at any time:

```bash
for env in production preview development; do
  echo "=== $env ==="
  npx eas-cli env:list "$env" 2>/dev/null | grep -E "^(SENTRY|EXPO_PUBLIC_)" | sort
done
```

---

## 6. Supabase — project, auth, schema, RLS, storage

### Project

- **Project ref:** `tlggdherqjvybpddsqjj`
- **API URL:** `https://tlggdherqjvybpddsqjj.supabase.co`
- **Postgres version:** 17
- **Region:** verify via Supabase dashboard before claiming

### Auth

- **Flow:** PKCE, configured in `src/lib/supabase.ts`:

```typescript
auth: {
  storage: AsyncStorage,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,   // we handle the redirect ourselves
  flowType: 'pkce',
}
```

- **Providers enabled:** Email OTP (Resend SMTP), Google OAuth, Apple OAuth, Phone OTP (defined but disabled in onboarding flow in favor of email).
- **OAuth callback:** `kanek://auth/callback` — handled by `app/auth/callback.tsx` which calls `consumeAuthRedirectUrl(url)` from `src/lib/authRedirect.ts`. The consumer is **idempotent** — it dedupes redirects via a `handledRedirects` Map and exchanges the code via `supabase.auth.exchangeCodeForSession(authCode)`.
- **SMTP:** Resend (`smtp.resend.com:465`), sender `support@belizechain.org`. Configured in Supabase dashboard, not in code.

### Schema migrations (verified 2026-09-11)

There are **23 migration files** under `supabase/migrations/`. Each is run sequentially. **Never modify a migration that is already deployed** — create a new one.

| # | File | Purpose (from filename + brief) |
|---|---|---|
| 00001 | `00001_initial_schema.sql` | Base tables, RLS, triggers |
| 00002 | `00002_admin_studio_migration.sql` | Admin views/functions for Supabase Studio |
| 00003 | `00003_fix_handle_new_user_trigger.sql` | Fix profile-creation trigger |
| 00004 | `00004_storage_bucket_policies.sql` | Bucket policies (avatars, documents) |
| 00005 | `00005_set_initial_role_rpc.sql` | RPC to set first role |
| 00006 | `00006_soft_delete_retention.sql` | Soft-delete retention windows |
| 00007 | `00007_reactivate_account_rpc.sql` | RPC to reactivate after soft-delete |
| 00008 | `00008_rename_route_to_ride_text.sql` | UX rename (data unchanged) |
| 00009 | `00009_route_repeat_days_return_time.sql` | Route schedule fields |
| 00010 | `00010_messaging_24h_cutoff.sql` | DM expiry rule |
| 00011 | `00011_ekyash_partial_refund.sql` | Partial refund support |
| 00012 | `00012_add_suspended_pending_deletion_status.sql` | New profile statuses |
| 00013 | `00013_fix_switch_to_driver_role.sql` | Role-change RPC fix |
| 00014 | `00014_check_user_availability_rpc.sql` | Availability RPC |
| 00015 | `00015_scrub_invalid_coords.sql` | Clean stored coords outside Belize bbox |
| 00016 | `00016_route_proceed_cancel_rpcs.sql` | Route proceed/cancel RPCs |
| 00017 | `00017_recurring_route_until_confirm.sql` | Recurring route until-confirm logic |
| 00018 | `00018_notification_preferences.sql` | Notification preferences table and defaults |
| 00019 | `00019_audit_remediation.sql` | RLS and policy remediation from security audit |
| 00020 | `00020_fix_plpgsql_lint_errors.sql` | PL/pgSQL function lint and variable shadowing fixes |
| 00021 | `00021_drop_road_reports_and_waitlist.sql` | Drop road_reports and waitlist tables |
| 00022 | `00022_taxi_associations.sql` | Belize taxi associations directory (26 records), driver affiliations, and sync trigger |
| 00023 | `00023_optimize_rls_initplan_and_security.sql` | RLS (select auth.uid()) InitPlan optimization, consolidated policies, and function hardening |

For the full table catalogue see `docs/database-schema.md`. The most-touched tables are listed in §25.

### Generated types

```bash
supabase gen types typescript --project-id tlggdherqjvybpddsqjj > src/types/database.ts
```

Re-run after every schema change and commit `src/types/database.ts`.

### Storage buckets

Defined in migration `00004_storage_bucket_policies.sql`. The two production buckets are:

| Bucket | Purpose | Visibility |
|---|---|---|
| `avatars` | Profile photos | public-read |
| `documents` | Government IDs, driver docs | private (signed URLs only) |

The `documents` bucket is private — the admin frontend in the sibling repo gets signed URLs through the `admin-api` edge function, not by SDK.

---

## 7. Edge functions — inventory, contracts, deployment

There are **16 Deno edge functions** in `supabase/functions/`, plus a `_shared/` folder with utilities (`supabase.ts`, `ekyash.ts`).

| Function | Auth | Purpose | Source |
|---|---|---|---|
| `ekyash-authorize` | user JWT | Get E-Kyash session token | `supabase/functions/ekyash-authorize/index.ts` |
| `ekyash-create-invoice` | user JWT | Create invoice (3% platform fee + optional donation) | `supabase/functions/ekyash-create-invoice/index.ts` |
| `ekyash-invoice-info` | user JWT | Query invoice status | `supabase/functions/ekyash-invoice-info/index.ts` |
| `ekyash-callback` | HMAC hash (webhook) | E-Kyash → us, payment status | `supabase/functions/ekyash-callback/index.ts` |
| `ekyash-cancel-invoice` | user JWT | Cancel pending invoice | `supabase/functions/ekyash-cancel-invoice/index.ts` |
| `ekyash-refund` | user JWT | Issue full or partial refund | `supabase/functions/ekyash-refund/index.ts` |
| `send-push` | user JWT or internal | Push via Expo Push API | `supabase/functions/send-push/index.ts` |
| `send-email-receipt` | user JWT | Receipt via Resend | `supabase/functions/send-email-receipt/index.ts` |
| `send-sms-sos` | user JWT | SOS SMS with GPS location | `supabase/functions/send-sms-sos/index.ts` |
| `expire-posts` | **internal-only** (cron) | Expire overdue posts, advance recurring routes | `supabase/functions/expire-posts/index.ts` |
| `process-strikes` | **internal-only** (cron) | Apply soft/hard strikes | `supabase/functions/process-strikes/index.ts` |
| `check-route-activation` | **internal-only** (cron) | Activate routes when min_riders met | `supabase/functions/check-route-activation/index.ts` |
| `update-rating-avg` | trigger or internal | Recalc `profiles.rating_avg` | `supabase/functions/update-rating-avg/index.ts` |
| `notify-user` | user JWT or internal | Targeted notification | `supabase/functions/notify-user/index.ts` |
| `delete-account` | user JWT | Soft-delete + anonymise | `supabase/functions/delete-account/index.ts` |
| `purge-deleted-accounts` | **internal-only** (cron) | Permanent purge after retention | `supabase/functions/purge-deleted-accounts/index.ts` |

> **Internal-only** functions verify the request is **not** from a user via
> `verifyAuthOrInternal` — if `authResult.userId !== null`, they return `403`.
> This means user-facing JWTs can never trigger them; only the cron scheduler
> with the service-role token can.

### Sibling-repo edge function

The sibling repo `kanek.bz` ships a single edge function deployed to the **same**
Supabase project:

| Function | Source repo | Purpose |
|---|---|---|
| `admin-api` | `kanek.bz/supabase/functions/admin-api/index.ts` | Admin frontend back-end. Uses service role + verifies caller is `profiles.role = 'admin'`. |

Do **not** duplicate `admin-api` here. The sibling repo owns it.

### Shared edge code

| File | Exports |
|---|---|
| `supabase/functions/_shared/supabase.ts` | `createServiceClient`, `getCorsHeaders`, `jsonResponse`, `errorResponse`, `verifyAuth`, `verifyAuthOrInternal` |
| `supabase/functions/_shared/ekyash.ts` | `buildEkyashJwt`, `getEkyashApiUrl`, `getEkyashCredentials`, `verifyCallbackHash`, `generateOrderId`, `calculateFees` |

### Deployment

```bash
supabase link --project-ref tlggdherqjvybpddsqjj   # once
supabase functions deploy                           # deploy all
supabase functions deploy <name>                    # deploy one
supabase functions deploy <name> --no-verify-jwt    # only for explicit webhooks (ekyash-callback)
```

Default-deny: every function should call `verifyAuth` or `verifyAuthOrInternal`
unless it's a webhook with its own signature verification.

### Local testing

```bash
supabase functions serve <name>
# Then from another terminal:
curl -i -X POST http://localhost:54321/functions/v1/<name> \
  -H "Authorization: Bearer $(cat .env.local | grep ANON_KEY | cut -d= -f2)" \
  -H 'Content-Type: application/json' \
  -d '{...}'
```

For deeper per-function detail, read `docs/edge-functions.md` and the `index.ts`
header of the function in question — do not paraphrase from this guide alone.

---

## 8. Mobile app architecture

### Boot order (root → tab)

1. `app/_layout.tsx` mounts the Redux Provider, loads fonts, calls `useAuthListener()`.
2. `useAuthListener()` (`src/hooks/useAuth.ts`) reads the persisted Supabase session and dispatches into `authSlice`.
3. `app/index.tsx` redirects based on auth + onboarding state.
4. `app/(tabs)/_layout.tsx` calls `useOnboardingStatus()`. Incomplete → push to the right `(auth)` screen.
5. `useOnboardingStatus()` (`src/hooks/useOnboardingStatus.ts`) reads `profiles.role`, `profiles.id_verified`, and (for drivers) `driver_documents` rows.

### Sign-out

`useAuth().signOut` clears Redux state **first**, then calls `supabase.auth.signOut()`.
Order matters: clearing Redux first prevents stale selectors from firing during the
auth transition.

### Tabs

| Tab | File | Responsibility |
|---|---|---|
| Explore | `app/(tabs)/explore/` | feed (RouteOfferCard, ErrandCard…), map, post detail |
| Post | `app/(tabs)/post/` | create-post forms (route, errand, package, job) |
| Activity | `app/(tabs)/activity/` | bookings, contracts, notifications |
| Profile | `app/(tabs)/profile/` | profile, settings, documents, wallet, reports |

---

## 9. Navigation — tab isolation rule

This is the most-violated rule in the repo.

**Expo Router binds a route to its owning tab.** A screen at
`/(tabs)/explore/[postId]` will **always switch to the Explore tab**, even if the
user navigated to it from Activity. The "back" button then goes to Explore's
history, breaking the user's mental model.

**Pattern.** When a screen is reachable from multiple tabs, put the logic in a
shared component under `src/components/` and create a thin per-tab wrapper:

```
src/components/PostDetailScreen.tsx               ← shared component, accepts backFallback prop
app/(tabs)/explore/[postId].tsx                   ← <PostDetailScreen backFallback="/(tabs)/explore/" />
app/(tabs)/activity/post/[postId].tsx             ← <PostDetailScreen backFallback="/(tabs)/activity/" />
```

Use `safeGoBack(fallback)` from `src/lib/helpers.ts` for back navigation. It calls
`router.back()` if history exists, otherwise `router.navigate(fallback)`.

```typescript
import { safeGoBack } from '@/lib/helpers';

const handleBack = () => safeGoBack('/(tabs)/explore/');
```

Detailed guide: `docs/navigation.md`.

---

## 10. State management — Redux + RTK Query

The Redux store is configured in `src/store/index.ts`. There are **11 RTK Query
API slices** under `src/store/api/` and **4 sync slices** under `src/store/slices/`.

### API slices (RTK Query)

All API slices use `fakeBaseQuery()` — they call the Supabase client directly,
not HTTP endpoints.

| Slice | File | Purpose |
|---|---|---|
| `postsApi` | `src/store/api/postsApi.ts` | Feed, post detail, create/update post |
| `bookingsApi` | `src/store/api/bookingsApi.ts` | Bookings, contracts |
| `profilesApi` | `src/store/api/profilesApi.ts` | Self profile, public profiles |
| `ratingsApi` | `src/store/api/ratingsApi.ts` | Reviews, averages |
| `ekyashApi` | `src/store/api/ekyashApi.ts` | Invoice + status (calls edge functions) |
| `reportsApi` | `src/store/api/reportsApi.ts` | Flags, gas reports, road reports |
| `notificationsApi` | `src/store/api/notificationsApi.ts` | Server-side notification log |
| `checkinsApi` | `src/store/api/checkinsApi.ts` | Selfie check-ins during trip |
| `messagesApi` | `src/store/api/messagesApi.ts` | DM threads (24h cutoff) |
| `contractEventsApi` | `src/store/api/contractEventsApi.ts` | Contract event log |
| `driverDocumentsApi` | `src/store/api/driverDocumentsApi.ts` | License, insurance, vehicle |

### Canonical pattern

```typescript
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';

export const postsApi = createApi({
  reducerPath: 'postsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Post'],
  endpoints: (builder) => ({
    getPosts: builder.query({
      queryFn: async (args) => {
        const { data, error } = await supabase.from('posts').select('*');
        if (error) {
          return { error: { status: 'CUSTOM_ERROR', data: error.message } };
        }
        return { data };
      },
      providesTags: ['Post'],
    }),
  }),
});
```

**Never add `fetchBaseQuery` with HTTP.** All data flow goes through the Supabase
client so RLS is enforced.

### Sync slices

| Slice | File | Purpose |
|---|---|---|
| `authSlice` | `src/store/slices/authSlice.ts` | session, user id, role, onboarding flags |
| `locationSlice` | `src/store/slices/locationSlice.ts` | last known coords, permission state |
| `notificationsSlice` | `src/store/slices/notificationsSlice.ts` | unread count, push token |
| `toastSlice` | `src/store/slices/toastSlice.ts` | transient UI messages |

Detailed guide: `docs/state-management.md`.

---

## 11. Auth flow — providers, callbacks, onboarding

### Provider matrix

| Provider | Status | Native SDK? |
|---|---|---|
| Email OTP | enabled (Resend SMTP) | no |
| Phone OTP | defined but unused in onboarding | no |
| Google OAuth | enabled (web flow via Supabase) | **no** — we deliberately do NOT use `@react-native-google-signin/google-signin` |
| Apple OAuth | enabled (web flow via Supabase) | **no** — we deliberately do NOT use `expo-apple-authentication` |

The unified web-OAuth pattern is:

1. App calls `supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } })`.
2. App calls `WebBrowser.openAuthSessionAsync(data.url, redirectTo)` (Expo).
3. Supabase redirects to `kanek://auth/callback?code=...&state=...`.
4. The `app/auth/callback.tsx` route runs and calls `consumeAuthRedirectUrl(url)`.
5. `consumeAuthRedirectUrl` (`src/lib/authRedirect.ts`) is **idempotent**: it dedupes via a `handledRedirects` Map keyed by `code+state`, then calls `supabase.auth.exchangeCodeForSession(authCode)`.
6. The auth listener in `useAuthListener` updates Redux.

If you change either link in this chain (provider redirect URL, scheme, callback
route, or PKCE flow), the OAuth round-trip breaks for both providers.

### Onboarding flow

```
welcome  →  login (email OTP)  →  role-select  →  id-upload  →  driver-docs (drivers only)  →  app
              ↑                                                                             ↓
              └──────────────────  signOut from any of these screens   ─────────────────────┘
```

Every onboarding screen has a **visible escape path**:

- `welcome.tsx` → no escape needed (entry)
- `login.tsx` → back chevron (returns from OTP step to email step, or from email step to welcome)
- `role-select.tsx` → confirm before leaving
- `id-upload.tsx` → exit chevron calls `signOut()`
- `driver-docs.tsx` → exit chevron calls `signOut()`

Without the exit chevron on `id-upload` / `driver-docs`, users get **stuck** because `(tabs)/_layout.tsx` redirects incomplete onboarding back to the same screen.

### Apple Sign In configuration (verified)

| Field | Value |
|---|---|
| Apple Team ID | `6VR44TAYT7` (Johnito Chuc, Individual) |
| App ID | `bz.kanek.app` with Sign in with Apple capability enabled |
| Services ID | `bz.kanek.app.signin` |
| Key ID | `7P82FW3ANU` |
| `.p8` file | `/home/wicked/Documents/AuthKey_7P82FW3ANU.p8` (NOT in repo) |
| Supabase Apple Client IDs field | `bz.kanek.app,bz.kanek.app.signin` (comma-separated; live Auth config currently serves `bz.kanek.app` first on the authorize endpoint) |

JWT regeneration uses ES256, `dsaEncoding: 'ieee-p1363'`, claims:

```
aud: https://appleid.apple.com
sub: bz.kanek.app.signin
iss: 6VR44TAYT7
```

The Apple JWT in Supabase has a finite lifetime (Apple max ~6 months). Decode the
`exp` claim of the live JWT before relying on a date — do not assume from
documentation.

### Google Sign In configuration (verified)

| Field | Value |
|---|---|
| Firebase project | `kanek-bz` |
| Web OAuth Client ID | `193141846291-spcg986c9jjrt15uk0oma6knh1skmgj3.apps.googleusercontent.com` |
| Authorized redirect URI in Google console | `https://tlggdherqjvybpddsqjj.supabase.co/auth/v1/callback` |

The Google client_secret is in Supabase's Google provider config, not in this repo.

### Phone OTP

Format: `+501` + exactly 7 digits. Validated by `PHONE_REGEX = /^\+501[0-9]{7}$/` in `src/lib/constants.ts`. Currently disabled in the active onboarding flow but the validator and UI helpers are still imported by other screens.

---

## 12. Design system — tokens, fonts, icons

Tokens live in `src/theme/`. Import via the barrel:

```typescript
import { colors, typography, spacing, shadows } from '@/theme';
```

### Colors (verified subset)

| Token | Value | Usage |
|---|---|---|
| `colors.forest[900]` | `#142800` | Primary text, headers |
| `colors.forest[600]` | `#274312` | Buttons, active states |
| `colors.forest[400]` | `#656e5e` | Icons inactive, subtle text |
| `colors.accent.green` | `#51c152` | Success, CTA, active tab |
| `colors.accent.neonGreen` | `#65f67b` | Highlights, badges |
| `colors.accent.blue` | `#4967f6` | Links, info |
| `colors.neutral[50]` | `#f6f6f4` | Background |
| `colors.neutral[100]` | `#efefec` | Card background |
| `colors.neutral[200]` | `#dbdad2` | Borders |
| `colors.error` | `#d32f2f` | Errors, strikes, SOS |

For the canonical list, read `src/theme/colors.ts`. Do **not** copy values into
new components — always import from the theme.

### Typography

- **Headings:** Work Sans (700)
- **Body:** Manrope (400 / 700)

Loaded in `app/_layout.tsx` via `expo-font`. Available via `typography.h1`,
`typography.body1`, `typography.body2`, etc.

### Icons

All icons are **custom SVG components** in `src/components/icons/`, each exporting
a default component that takes `{ size, color }`. **No emoji in the UI ever.**

Verified inventory:

```
AlertTriangle, Bell, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
CircleDot, ClipboardList, Clock, Compass, Construction, ExternalLink,
Filter, Fuel, Lock, MapPin, MessageCircle, Navigation, Package, Phone,
PlusCircle, QrCode, Receipt, Search, Send, ShieldAlert, Star, User, X
```

Barrel + name lookup is in `src/components/icons/index.tsx`. To add a new icon:

1. Create `src/components/icons/MyIcon.tsx` with the standard `IconProps` signature.
2. Re-export from `index.tsx`.
3. Use either as a direct import or `<Icon name="my-icon" />` if the lookup map supports it.

### Components

Pill-shaped buttons, 12 px rounded cards, subtle shadow, 24×24 outlined stroke
icons. Primitives live in `src/components/ui/`.

Detailed guide: `docs/design-system.md`.

---

## 13. Maps — Mapbox & offline data

- **Native:** `@rnmapbox/maps@^10.3.0`
- **Web:** `mapbox-gl@^3.20.0`
- **Access token:** `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`
- **SDK download token:** `MAPBOX_DOWNLOAD_TOKEN` — set in `eas.json` `build.storeTest.env`, used to fetch the native SDK during store-distributed native builds. Without it, native builds fail at `MAPBOX_DOWNLOAD_TOKEN` resolution.
- **Districts source:** `geoBoundaries BLZ ADM1` (recorded in commit `16b59d8`). Replaces an earlier broken-polygons set.
- **POI dataset:** `src/data/belize-pois.json`, generated by `data/belize-pois/build-poi-dataset.py`.

Components live under `src/components/map/`. The `KanekMap` and `LiveTrackingMap`
wrappers add gestures, district overlays, and the markers needed by the feed.

---

## 14. Notifications — Expo + FCM/APNs

- **Library:** `expo-notifications@~55.0.20`
- **Android:** FCM via `google-services.json` at the repo root and under `android/app/`. Both files must match the production Firebase project.
- **iOS:** APNs key uploaded to Expo (managed credentials). Apple push key + Team ID match `eas.json` submit config (`6VR44TAYT7`).
- **Token registration:** `src/hooks/useNotifications.ts`. Stored on `profiles.push_token` (text). Stale tokens are cleared by `send-push` and `notify-user` when Expo returns `DeviceNotRegistered` / `InvalidCredentials`.
- **Sender:** Edge function `send-push` calls `https://exp.host/--/api/v2/push/send`.

---

## 15. Sentry — crash reporting & source maps

- **Org slug:** `kanekbz`
- **Project slug:** `kanek` (renamed from `react-native` on 2026-05-09; matched in `app.json` Sentry plugin config)
- **Plan:** Free Developer plan (5 K errors/mo). The Business/Team trial ended 2026-04. Do not assume paid features.
- **Build-time uploader:** `@sentry/cli` bundled inside `node_modules/@sentry/react-native`. Runs automatically during the iOS Xcode build phase and Android Gradle phase.
- **Auth token:** `SENTRY_AUTH_TOKEN` (sensitive) — set on production / preview / development EAS env. Verified valid against renamed project slug on 2026-05-09.
- **Runtime DSN:** `EXPO_PUBLIC_SENTRY_DSN` — set on all three EAS envs on 2026-05-09. Without it, `initSentry()` in `src/lib/sentry.ts` early-returns and the SDK never initializes (no events sent). Builds before this date had no runtime SDK, only build-time source-map upload.

### Skip flags (emergency only)

| Flag | Honored by | Effect |
|---|---|---|
| `SENTRY_ALLOW_FAILURE=true` | iOS | Continue build if upload fails |
| `SENTRY_DISABLE_AUTO_UPLOAD=true` | Android (and iOS) | Skip upload entirely; minified stack traces |

Both flags were deliberately **removed** from preview/development on 2026-04-28
once the auth token was set. Do not re-add as a workaround for missing tokens.

### Verifying token + project

```bash
SENTRY_AUTH_TOKEN=<token> npx @sentry/cli releases list \
  --org kanekbz --project kanek | head -5
```

Empty output with exit 0 means the token + project are valid. Anything else
(403, project-not-found) is a real failure.

---

## 16. Mapbox & geocoding

The geocoder lives in `src/lib/geocode.ts`. It calls the Mapbox Geocoding API with
the public `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`. Coordinate validation against
`BELIZE_BBOX` happens at form boundaries.

POIs in `src/data/belize-pois.json` are baked into the bundle so the search box
can suggest names without a network call.

---

## 17. Payments — E-Kyash status

E-Kyash is the digital BZD payment integration. **It is currently disabled at the
app level** by the feature flag in `src/lib/constants.ts`:

```typescript
export const ENABLE_EKYASH = false;
export const EKYASH_COMING_SOON_MESSAGE =
  'E-Kyash is coming soon and is not part of this launch yet.';
```

What this means:

- The six `ekyash-*` edge functions are deployed and reachable.
- The mobile UI components in `src/components/payment/` exist but are gated behind `ENABLE_EKYASH`.
- The feed shows the "coming soon" message instead of payment buttons.

When E-Kyash is re-enabled:

1. Set `ENABLE_EKYASH = true` and ship a build.
2. Verify `EKYASH_SID`, `EKYASH_PIN_HASH`, `EKYASH_API_KEY` are set in Supabase secrets.
3. Verify the callback URL registered with E-Kyash points to `https://tlggdherqjvybpddsqjj.supabase.co/functions/v1/ekyash-callback`.

### Payment flow (when enabled)

1. App calls `ekyash-authorize` → session token.
2. App calls `ekyash-create-invoice` with contract details → QR URL + payment link.
3. User scans QR or opens the E-Kyash app.
4. E-Kyash calls `ekyash-callback` (HMAC-signed webhook) → updates transaction.
5. App polls `ekyash-invoice-info` for confirmation.

Platform fee: **3 %** of transaction. Optional community donation tracked in
`donation_totals`.

Detailed reference: `docs/ekyash-api-reference.md`, `docs/payments.md`.

---

## 18. EAS build profiles — truth table

`eas.json` now defines two active profiles. They map directly to the two lanes
the repo actually uses: direct device installs and store-distributed testing.

| Profile | `distribution` | Lands at | Auto-submit | Use when |
|---|---|---|---|---|
| `deviceTest` | `internal` | EAS internal install page, **iOS limited to registered UDIDs** | no | Direct on-device installs without TestFlight / Play review |
| `storeTest` | `store` | App Store Connect → **TestFlight**, Play **Internal Testing** | yes when `--auto-submit` | Real tester distribution through Apple/Google |

### Hard rules

1. **Never pick a profile silently.** The user almost never says "use profile X" — they say "build for testing" or "send to TestFlight" or "ship it". Translate that into a profile, **state which profile you chose and why**, and ask before running.
2. `deviceTest` is an internal install lane. It does **not** reach TestFlight or Play Internal.
3. `storeTest` reaches TestFlight / Play Internal only when `--auto-submit` is included **or** a separate `eas submit` is run after.
4. iOS `deviceTest` builds only install on devices whose UDID is in the provisioning profile. Currently registered: `00008140-000D75241E07001C` (one iPhone). Building for any other iPhone requires `storeTest` + TestFlight, or registering the new UDID.
5. The free Expo tier provides **1 concurrent build slot.** `--platform all` queues both; the second waits for the first. Building both = 2 slots consumed.
6. **Expo Updates is configured** in this repo (`expo-updates` dependency plus `app.json` `updates.url` / `runtimeVersion`). Do **not** run `eas update` or treat OTA as a substitute for `storeTest` unless the user explicitly asks for an OTA publish; store-distributed testing still uses `storeTest` builds.

### Build decision script

```
User says: "rebuild" / "make a new build" / "ship it"
  ↓
Q1 — What distribution channel?
  • TestFlight + Play Internal (testers)        → storeTest --auto-submit
  • Direct install on a registered device       → deviceTest
  • Public stores (real users)                  → add a dedicated launch profile first; current `eas.json` does not define one
  ↓
Q2 — Which platforms? (both = 2 free-tier slots)
  ↓
Q3 — Auto-submit? (only meaningful for storeTest)
  ↓
ASK USER if any of Q1/Q2/Q3 is ambiguous. Do NOT pick silently.
```

### Verified build IDs (2026-04-28)

| Date | Profile | Platform | Build ID | Outcome |
|---|---|---|---|---|
| 2026-04-27 | storeTest #5 | iOS | (TestFlight #5) | Predates current auth/Sentry/back-button fixes |
| 2026-04-28 | legacy `preview` | Android | `b458d74b-bc9c-4a70-815b-b25a3b801719` | Finished (internal install page only, NOT TestFlight) |
| 2026-04-28 | legacy `preview` | iOS | `e37208e7-2962-4bce-b35b-87aefd308e39` | Finished (internal install page only, restricted to UDID `00008140-000D75241E07001C`) |

The `preview` entries above are historical and predate the current two-profile
setup. When the user references a build by date or number, **always verify the
profile** before claiming it includes a given fix.

---

## 19. EAS env — verified state

See §5 for the truth table. The active build profiles use `preview`
(`deviceTest`) and `production` (`storeTest`). The verification command:

```bash
for env in production preview development; do
  echo "=== $env ==="
  npx eas-cli env:list "$env" 2>/dev/null | grep -E "^(SENTRY|EXPO_PUBLIC_)" | sort
done
```

CLI quirks to remember:

- `env:list` does **not** support `--json`. Use `--format long` for type/visibility.
- `env:create --force` can move a variable's environment scope rather than duplicate it. Verify with `env:list` after.
- `env:list` and `env:delete` take the environment as a **positional argument**.
- `env:create` takes the environment as the `--environment` **flag**.

### EAS CLI command reference

```bash
# List
npx eas-cli env:list production
npx eas-cli env:list production --include-sensitive --format long

# Create / update
npx eas-cli env:create --environment production \
  --name VAR_NAME --value "..." \
  --visibility plaintext|sensitive|secret \
  --type string --non-interactive --force

# Delete
npx eas-cli env:delete production --variable-name VAR_NAME --non-interactive

# Build
npx eas-cli build --platform all|ios|android --profile <profile> --non-interactive
npx eas-cli build --platform ios --profile deviceTest --non-interactive
npx eas-cli build --platform ios --profile storeTest --non-interactive --auto-submit

# Build logs
npx eas-cli build:logs <build-id>

# Submit a previously built artifact
npx eas-cli submit --platform ios --profile storeTest --latest
```

---

## 20. App configuration — `app.json` & `eas.json`

### `app.json` (verified)

```jsonc
{
  "expo": {
    "name": "Kanek",
    "slug": "kanek",
    "version": "1.0.0",
    "scheme": "kanek",
    "orientation": "portrait",
    "ios": { "bundleIdentifier": "bz.kanek.app", "supportsTablet": false },
    "android": { "package": "bz.kanek.app" },
    "updates": {
      "fallbackToCacheTimeout": 0,
      "url": "https://u.expo.dev/71a76ae0-95d7-41de-9ce0-b396dc088437"
    },
    "runtimeVersion": { "policy": "appVersion" },
    "plugins": [
      "expo-router",
      "expo-font",
      "expo-secure-store",
      "expo-notifications",
      "expo-location",
      ["expo-image-picker", { "microphonePermission": false }],
      ["@rnmapbox/maps", { "RNMAPBOX_MAPS_DOWNLOAD_TOKEN": "${MAPBOX_DOWNLOAD_TOKEN}" }],
      "expo-image",
      ["@sentry/react-native/expo", {
        "url": "https://sentry.io/",
        "project": "kanek",
        "organization": "kanekbz"
      }],
      "expo-web-browser"
    ],
    "extra": { "eas": { "projectId": "71a76ae0-95d7-41de-9ce0-b396dc088437" } }
  }
}
```

Splash background: `#142800` (forest-900).

### `eas.json` (verified)

```jsonc
{
  "cli": { "version": ">= 18.4.0", "appVersionSource": "remote" },
  "build": {
    "deviceTest": {
      "channel": "device-test",
      "distribution": "internal",
      "environment": "preview",
      "ios": { "simulator": false }
    },
    "storeTest": {
      "channel": "store-test",
      "distribution": "store",
      "autoIncrement": true,
      "environment": "production",
      "env": { "MAPBOX_DOWNLOAD_TOKEN": "${MAPBOX_DOWNLOAD_TOKEN}" }
    }
  },
  "submit": {
    "storeTest": {
      "ios":     { "ascAppId": "6764087212", "appleTeamId": "6VR44TAYT7" },
      "android": {
        "serviceAccountKeyPath": "./play-store-service-account.json",
        "track": "internal",
        "releaseStatus": "draft"
      }
    }
  }
}
```

Note the Android submit track is `"internal"` with `"draft"` release status.
That means `storeTest --auto-submit` creates/uploads a Play Internal draft release;
it does not mark the Android release completed for testers unless the Play release
is completed afterward.

---

## 21. iOS distribution — Apple, certs, TestFlight

| Field | Value |
|---|---|
| Apple Team ID | `6VR44TAYT7` |
| Bundle ID | `bz.kanek.app` |
| ASC App ID (`ascAppId`) | `6764087212` |
| Distribution Certificate serial | `5D2DDF8B14D7685973465E43D6511DAC` (expires 2027-04-27) |
| Provisioning Profile ID | `3UASW938WJ` (expires 2027-04-27) |
| Registered ad-hoc UDIDs (`deviceTest` profile) | `00008140-000D75241E07001C` (one iPhone) |

TestFlight is reached via the `storeTest` profile **plus**
`--auto-submit`. After the build finishes, App Store Connect takes ~10–25 minutes
to process before testers see the build.

Internal testers vs external testers:

- **Internal:** up to 100 Apple Developer team members, no review.
- **External:** invited testers, requires beta review (~24 h first time, faster after).

---

## 22. Android distribution — Play, keystore, tracks

| Field | Value |
|---|---|
| Package | `bz.kanek.app` |
| Service account JSON | `play-store-service-account.json` (in repo root) |
| Upload keystore | Managed by EAS — credential id `Build Credentials KkhKYEncH7` |
| `eas.json` submit track | `internal` |
| Release status | `draft` |

Tracks: `internal` (instant), `closed`, `open`, `production`. The `storeTest`
profile submits to `internal` by default per `eas.json`.

---

## 23. Firebase — what's hosted there, what isn't

Firebase is **only** used for:

1. **Website hosting** (`kanek.bz` → Firebase Hosting site `kanek-bz`)
2. **Google OAuth web client** (the OAuth client that Supabase wraps)

It is **not** the mobile backend. The mobile backend is Supabase.

| Field | Value |
|---|---|
| Firebase project | `kanek-bz` (under `belizechain@gmail.com`) |
| Hosting site | `kanek-bz` → `https://kanek-bz.web.app` |
| Custom domains | `kanek.bz` (apex), `www.kanek.bz` (redirect to apex) |

DNS (Namecheap, configured 2026-04-24):

- apex A `199.36.158.100`
- apex TXT `hosting-site=kanek-bz`
- apex `_acme-challenge` TXT (ownership)
- `www` CNAME `kanek-bz.web.app`
- `www` `_acme-challenge` TXT

Hosting deploy is handled by the **sibling repo's** GitHub Actions workflow on
push to `main`. This mobile repo does **not** push to Firebase Hosting. Do not
run `firebase deploy` from here.

---

## 24. Cross-repo memory — kanek + kanek.bz

This repo (`/home/wicked/Projects/kanek`) is one of two Kanek codebases. The
sibling lives at `/home/wicked/Projects/kanek.bz` and ships the public website
plus admin frontend. Both share the same Supabase backend
(`tlggdherqjvybpddsqjj`), so any schema, RLS, or auth change in one repo affects
the other.

### Repo ownership matrix

| Concern | Owner repo |
|---|---|
| Mobile app (iOS + Android) | `kanek` |
| App auth flows (OTP + OAuth callback) | `kanek` |
| Public marketing site | `kanek.bz` |
| Admin frontend | `kanek.bz` |
| `admin-api` edge function | `kanek.bz` |
| All other 16 edge functions | `kanek` |
| DB schema + migrations | `kanek` |
| RLS policies | `kanek` |
| Generated types `database.ts` | each repo generates its own |
| Firebase Hosting | `kanek.bz` |
| Domain `kanek.bz` DNS | `kanek.bz` |
| Mobile distribution (App Store / Play) | `kanek` |

### Sibling repo facts (verified 2026-04-28)

```
/home/wicked/Projects/kanek.bz
├── src/app/                   Next.js 16 App Router (React 19.2.4)
│   ├── (public)/              public marketing pages
│   ├── admin/                 admin frontend (static, requires auth)
│   ├── globals.css
│   └── layout.tsx
├── src/components/
├── src/lib/
├── supabase/functions/admin-api/
│   └── index.ts
├── public/
├── out/                       static export target (gitignored)
├── firebase.json              site=kanek-bz, public=out
├── .firebaserc                project default = kanek-bz
└── .github/workflows/
    ├── deploy.yml             Firebase Hosting deploy on push to main
    ├── review.yml
    └── security.yml
```

**Stack:** Next.js 16.2.3 (canary App Router), Tailwind v4, shadcn,
framer-motion, gsap.

**Repo secrets in sibling:** `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `FIREBASE_SERVICE_ACCOUNT_KANEK_BZ`. The admin
API URL is derived in `deploy.yml` as
`${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-api`.

### Cross-repo discovery protocol — required

Before making any claim about behavior, file paths, env wiring, or ownership in
the other repo:

1. `ls /home/wicked/Projects/kanek.bz` to confirm the repo is on disk.
2. `cat /home/wicked/Projects/kanek.bz/AGENTS.md` for that repo's ownership map.
3. Inspect the actual file referenced before describing it. **Never paraphrase from memory.**
4. If a change in this repo requires a paired change in the sibling, **say so explicitly** and pause for confirmation.
5. Never push changes to the sibling repo without explicit instruction.

### Cross-repo change patterns

| Mobile change | Triggers sibling work? |
|---|---|
| Add a new RLS policy | yes if `admin-api` reads/writes that table |
| Rename a column | yes — admin queries break |
| Add a new `profiles` field | maybe — admin frontend may need it |
| Change auth flow / token format | yes — admin login uses the same Supabase Auth |
| Add a new edge function (mobile only) | no |
| Update mobile branding (colors, copy) | sometimes — site may want parity |
| Change Supabase project or anon key | yes — both repos must update |

### Cross-repo discovery commands

```bash
rg --no-heading "useAuth" /home/wicked/Projects/kanek/ /home/wicked/Projects/kanek.bz/
rg "from\(['\"]profiles['\"]" /home/wicked/Projects/kanek/src /home/wicked/Projects/kanek.bz/src
rg --no-heading "" /home/wicked/Projects/kanek.bz/supabase/functions/admin-api/
git -C /home/wicked/Projects/kanek.bz log --oneline -20
```

### Multi-root workspace

Preferred VS Code workspace: `/home/wicked/Projects/Kanek.code-workspace`. When
the user is in that workspace, treat **both folders as in-scope** and prefix
relative paths explicitly (`kanek/...` vs `kanek.bz/...`).

---

## 25. Database tables — full reference

For the full catalogue see `docs/database-schema.md`. The most-touched tables:

| Table | Purpose | Notes |
|---|---|---|
| `profiles` | per-user info, role, verification | one per auth user; created by trigger in 00001/00003 |
| `posts` | the feed (rides, errands, packages, jobs) | `kind` discriminator across the 5 `POST_TYPES` |
| `bookings` | request to take a post | |
| `contracts` | accepted booking → payment | |
| `ratings` | post-contract reviews | trigger updates `profiles.rating_avg` via `update-rating-avg` |
| `flags` | user-submitted abuse reports | `target_id` polymorphic, no FK (deferred §37) |
| `gas_prices` | crowd-sourced fuel prices by station | verified count tracking |
| `notifications` | user notification log | |
| `messages` | DM threads | 24 h cutoff (migration 00010) |
| `driver_documents` | license, insurance, vehicle photos | |
| `ekyash_txns` | payment transactions | |
| `email_receipts` | sent receipts log | both `contract_id` and `ekyash_txn_id` nullable (deferred CHECK §37) |
| `donation_totals` | optional community donations | |

All prices are **integers in cents**. Use `formatBZD(cents)` from
`src/lib/helpers.ts` for display. Coordinates are `numeric(10,7)` for both lat
and lng.

---

## 26. Migration discipline

- File naming: `NNNNN_<slug>.sql`. The Supabase CLI generates timestamped names; we use 5-digit zero-padded sequence numbers.
- **Never edit a deployed migration.** Create a new file.
- Always include `down` logic that restores the prior state, even if you don't expect to roll back.
- Re-run `supabase gen types typescript --project-id tlggdherqjvybpddsqjj > src/types/database.ts` after every schema change and commit the result.
- After applying, re-deploy any edge function that depends on the changed shape.

```bash
supabase link --project-ref tlggdherqjvybpddsqjj
supabase db push                         # apply migrations
supabase migration list --linked         # confirm
```

---

## 27. RLS rules of thumb

- **Read-self:** `auth.uid() = user_id` on user-scoped tables.
- **Read-public:** posts and ratings are world-readable for the anon role.
- **Write-self:** insert/update/delete only when the row's owner column matches `auth.uid()`.
- **Admin override:** there is **no** `service_role` policy on the mobile-facing app. Admin reads/writes go through the `admin-api` edge function in the sibling repo, which uses the service-role key server-side and does its own role check (`profiles.role = 'admin'`).

Every new table needs an explicit RLS policy. Default-deny by enabling RLS on
the table without any policy is a valid posture during development but must not
ship without policies.

---

## 28. Validation rules — at boundaries

Validate **only** at form boundaries and edge function entry points. Internal
code trusts validated data — **don't add defensive validation in helpers**.

| Field | Rule |
|---|---|
| Phone | `+501` + exactly 7 digits — `PHONE_REGEX = /^\+501[0-9]{7}$/` |
| Price | Positive integer cents, max `999_900` ($9,999 BZD) |
| Seats | 1–20 integer |
| Description | 1–500 chars, no HTML — `MAX_DESCRIPTION_LENGTH = 500` |
| Name | 1–50 chars — `MAX_NAME_LENGTH = 50` |
| Title | 1–100 chars — `MAX_TITLE_LENGTH = 100` |
| ID photo | JPEG/PNG, max 5 MB, min 640 px width — `MAX_UPLOAD_SIZE`, `MIN_IMAGE_WIDTH` |
| Coordinates | Within `BELIZE_BBOX` |

All constants are in `src/lib/constants.ts`.

---

## 29. File-upload pattern (RN-specific)

The Supabase JS SDK cannot stream a `Blob` correctly on React Native. Always
convert via `arrayBuffer()`:

```typescript
// CORRECT — works on RN, web, native
const response = await fetch(localUri);
const blob = await response.blob();
const arrayBuffer = await blob.arrayBuffer();

const { error } = await supabase.storage
  .from(bucket)
  .upload(path, arrayBuffer, { contentType, upsert: true });

// WRONG — fails on RN with "Network request failed"
.upload(path, blob, { contentType });
```

Apply this to every upload (avatars, ID photos, driver docs, future media). The
fix shipped in commit `1a13564`.

---

## 30. Storage buckets & policies

Defined in migration `00004_storage_bucket_policies.sql`.

| Bucket | Visibility | Upload allowed for |
|---|---|---|
| `avatars` | public-read | the row's owner only |
| `documents` | private | the row's owner only; admin reads via signed URL |

Signed URLs for `documents` are minted by the `admin-api` edge function in the
sibling repo when an admin needs to view a user's ID. **Mobile clients should
never request `documents` URLs directly** — RLS will reject them.

---

## 31. Phone, prices, coordinates — exact formats

### Phone

```typescript
const PHONE_REGEX = /^\+501[0-9]{7}$/;
// "+5016123456" → valid
// "5016123456"  → invalid (no +)
// "+5016123"    → invalid (too short)
```

### Prices

All prices are integers in cents. Display via `formatBZD(cents)`:

```typescript
formatBZD(1500)    // "$15.00"
formatBZD(0)       // "$0.00"
formatBZD(999900)  // "$9,999.00"
```

`MAX_PRICE_CENTS = 999_900`. Anything higher is rejected at the form boundary.

### Coordinates

`numeric(10,7)` in Postgres for both lat and lng. App-side they are `number`.
Validation against `BELIZE_BBOX`:

```typescript
const inBelize = (lat: number, lng: number) =>
  lat >= BELIZE_BBOX.south &&
  lat <= BELIZE_BBOX.north &&
  lng >= BELIZE_BBOX.west &&
  lng <= BELIZE_BBOX.east;
```

---

## 32. Common commands

```bash
# Install
npm install --legacy-peer-deps      # required flag for peer-dep conflicts

# Run
npm start                           # Expo dev server
npm run web                         # web (localhost:8081)
npm run ios                         # iOS simulator (after store-ready check)
npm run android                     # Android emulator (after store-ready check)

# QA
npm run typecheck                   # tsc --noEmit
npm run lint                        # expo lint
npm test                            # jest
npm run launch:check                # scripts/launch-readiness.js
npm run store:check                 # scripts/store-ready-check.js
npm run mobile:check                # scripts/mobile-ready-check.js

# Supabase
supabase link --project-ref tlggdherqjvybpddsqjj
supabase db push
supabase functions deploy
supabase functions deploy <name>
supabase gen types typescript --project-id tlggdherqjvybpddsqjj > src/types/database.ts

# EAS (see §19)
npx eas-cli env:list <env>
npx eas-cli build --platform <ios|android|all> --profile <profile> --non-interactive
```

The `expo lint` command runs ESLint with the Expo config — same as `npm run lint`.

---

## 33. Verification protocol — before claiming success

Do **not** assert "this is fixed", "this works now", or "the build will succeed"
without running at least one verification step from the relevant table below.

### Before claiming an env variable is set

```bash
npx eas-cli env:list <environment> | grep VAR_NAME
```

### Before claiming a build will use a given env

The build header logs which env vars were loaded. Look for:

```
Environment variables with visibility "Plain text" and "Sensitive" loaded
from the "<environment>" environment on EAS: VAR_A, VAR_B, ...
```

If the variable name is not in that list, the build does **not** have it.

### Before claiming a build "went to TestFlight"

- Confirm `eas.json` for the chosen profile has `"distribution": "store"` (directly or via `extends`).
- Confirm the build command included `--auto-submit`, OR a separate `eas submit` was run.
- Wait 10–25 min after build finishes for App Store Connect processing.
- Verify in App Store Connect → TestFlight → Builds before telling the user it's live.

### Before claiming Supabase is reachable from the app

```bash
curl -s "https://tlggdherqjvybpddsqjj.supabase.co/auth/v1/health"
curl -s "https://tlggdherqjvybpddsqjj.supabase.co/rest/v1/" -H "apikey: $ANON_KEY"
```

### Before claiming a code change typechecks

```bash
npm run typecheck
```

### Before claiming a code change passes lint

```bash
npm run lint
```

### Before claiming a migration is applied

```bash
supabase migration list --linked
```

### Before claiming an edge function is deployed

```bash
supabase functions list
```

### Before claiming a Sentry release will receive symbols

```bash
SENTRY_AUTH_TOKEN=<token> npx @sentry/cli releases list \
  --org kanekbz --project kanek | head -5
```

### Before claiming the Apple JWT is valid

Decode the `exp` claim of the JWT pasted into Supabase. Do not assume from
documentation — Apple JWTs have a finite lifetime (~6 months max).

### Before claiming a domain is properly DNSed

```bash
dig +short kanek.bz       # apex should resolve to 199.36.158.100
dig +short www.kanek.bz   # www should CNAME to kanek-bz.web.app
```

---

## 34. False-error filter — what is NOT a build failure

When you read logs, distinguish:

- **REAL ERROR** — operation failed with a non-zero exit code or a clear `FAILED` line, and the failure blocks the user's actual goal.
- **WARNING / INFO** — visible in logs but the operation completed successfully. Do **not** report as failure.
- **EXPECTED BEHAVIOR** — informational lines like distribution-cert validation skips.

### Common false errors on this repo (do not flag)

| Output | Meaning | Action |
|---|---|---|
| `The EAS build profile does not specify a Node.js version. Using the version specified in .nvmrc: 24` | Info | None |
| `Distribution Certificate is not validated for non-interactive builds` | Info | None |
| `Skipping Provisioning Profile validation on Apple Servers because we aren't authenticated` | Info | None |
| `Some dependencies are installed with unexpected versions:` (expo-doctor) | Warning | Only act if user asks |
| `peer dep` warnings during `npm install` | Expected — use `--legacy-peer-deps` | Not a build blocker |
| Sentry `info: 'X' is not a known release` | Info; release is auto-created | None |
| Hermes bytecode warnings | Info | None |
| `Compressed project files Xs (~108 MB)` | Info | None |

If unsure, read the **full build log** via `eas-cli build:logs <id>`, find the
failed task, and quote the exact failing command. Do not paraphrase.

---

## 35. Files you must not touch without explicit instruction

| File | Why |
|---|---|
| `supabase/migrations/*` (existing) | Already deployed; create a new migration |
| `google-services.json` (root + `android/app/`) | Generated/downloaded from Firebase; must match production |
| `play-store-service-account.json` | Long-lived service account credential |
| `eas.json` build profile distribution settings | Changing distribution silently retargets stores |
| `app.json` `bundleIdentifier` / `package` | Changing breaks signing & store listing |
| `app.json` `scheme` | Breaks deep links system-wide |
| `.env.local` | Contains user's local secrets; read but never overwrite without saying so |
| `android/` (native bits) | `expo prebuild` regenerates; don't hand-edit unless aligned |
| `package-lock.json` | Mass changes can break peer-dep balance; only touch via `npm install` |

---

## 36. Anti-patterns

1. **Don't navigate to another tab's route** — it switches tabs and breaks back-navigation. Use the per-tab wrapper pattern.
2. **Don't add HTTP base queries** — all RTK Query slices use `fakeBaseQuery()` with the Supabase client.
3. **Don't use emoji in UI** — all icons are custom SVG components.
4. **Don't modify deployed migrations** — create new migration files instead.
5. **Don't hardcode prices as dollars** — always integer cents, format at display.
6. **Don't skip RLS policies** — every new table needs proper RLS.
7. **Don't add validation in internal code** — only at form and edge-function boundaries.
8. **Don't use `Alert.alert` directly** — use `showAlert`/`showConfirm` from `src/lib/alert.ts` for web compat.
9. **Don't install native social SDKs** (`expo-apple-authentication`, `@react-native-google-signin/google-signin`) — the auth flow is web-OAuth via Supabase.
10. **Don't apply Sentry skip flags as a "fix"** for missing token. Set `SENTRY_AUTH_TOKEN` instead. The skip flags are emergency-only.
11. **Don't push to Firebase Hosting from this repo** — that's the sibling's job.
12. **Don't duplicate `admin-api`** here — it lives in the sibling repo.

---

## 37. Known issues & deferred work

### Captcha is currently bypassed

`src/components/HCaptcha.tsx` and `HCaptcha.web.tsx` early-return `null` when
`SITE_KEY` is empty:

```typescript
const SITE_KEY = process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY ?? '';
// ...
if (!SITE_KEY) return null;
```

`EXPO_PUBLIC_HCAPTCHA_SITE_KEY` is **not set** in any EAS environment
(currently the active build profiles use `production` and `preview`). Result:
bot protection is **off** in all shipped builds.

To restore:

1. Generate a site key at https://hcaptcha.com (free tier is sufficient for launch).
2. Set the EAS env on the active build environments:
   ```bash
  for env in production preview; do
     npx eas-cli env:create --environment $env \
       --name EXPO_PUBLIC_HCAPTCHA_SITE_KEY --value "<site-key>" \
       --visibility plaintext --type string --non-interactive --force
   done
   ```
3. Set the matching **secret** in the Supabase dashboard under Auth → Settings → CAPTCHA so the server-side verification accepts the token.
4. Verify in `app/(auth)/login.tsx` that the captcha now renders before OTP is requested.
5. Smoke-test: send OTP without solving captcha and confirm Supabase rejects the request.

### Schema deferred items

- `flags.target_id` has no FK constraint (polymorphic across `posts`, `users`, `messages`).
- `email_receipts` allows both `contract_id` and `ekyash_txn_id` to be `NULL` (needs CHECK to require one).
- `email_receipts.ekyash_txn_id` FK defaults to RESTRICT (consider CASCADE).

### Tooling warnings

- `expo` version is `^55.0.17`; doctor expects `~55.0.18`.
- `expo-notifications` is `~55.0.20`; doctor expects `~55.0.21`.

Both are non-fatal and the most recent successful production build shipped with
these versions.

### E-Kyash gating

`ENABLE_EKYASH = false` in `src/lib/constants.ts`. Re-enable per §17 when the
payments rollout is scheduled.

---

## 38. Documentation map (`docs/`)

The `docs/` folder is the canonical source for deeper reference. Always read the
relevant doc before answering:

| File | Topic |
|---|---|
| `docs/admin-studio-workflow.md` | Admin operations via Supabase Studio |
| `docs/architecture.md` | System overview |
| `docs/database-schema.md` | Full table + column reference |
| `docs/deep-links-setup.md` | `kanek://` scheme & universal links |
| `docs/design-system.md` | Tokens, components, motion |
| `docs/edge-functions.md` | Per-function detail |
| `docs/ekyash-api-reference.md` | E-Kyash API |
| `docs/environment-setup.md` | Local dev |
| `docs/navigation.md` | Tab isolation pattern (deep dive) |
| `docs/payments.md` | Payment flows |
| `docs/state-management.md` | Redux + RTK Query (deep dive) |
| `docs/store-launch-checklist.md` | Pre-submit checklist |
| `docs/README.md` | Index of the above |

---

## 39. Glossary

| Term | Meaning |
|---|---|
| BZD | Belize Dollar (1 BZD ≈ 0.50 USD, fixed peg) |
| E-Kyash | Belize digital wallet — local payment integration |
| `+501` | Belize country code |
| Forest green | The dark green of the AllTrails-Trailblazer palette (`#142800`) |
| RLS | Postgres Row Level Security |
| RTK Query | Redux Toolkit's data-fetching layer |
| PKCE | Proof Key for Code Exchange — OAuth security flow |
| EAS | Expo Application Services — build + submit |
| TestFlight | Apple's pre-release distribution channel (iOS) |
| Play Internal | Google Play's internal testing track (Android) |
| ASC | App Store Connect |
| OTA | Over-the-air update via Expo Updates; configured in app metadata but only publish with explicit user direction |

---

## 40. Change log of this file

| Date | Change |
|---|---|
| 2026-04-28 | Rewritten from scratch: factual repo guide only, behavioral rules moved to `AGENTS.md`. Verified package versions, migration count (14), edge function inventory (16), EAS profile distribution settings, ASC App ID, hCaptcha bypass status, E-Kyash gating, sibling repo facts. |
| 2026-05-09 | Sentry project renamed `react-native` → `kanek`; `EXPO_PUBLIC_SENTRY_DSN` added to all EAS envs and to env tables; `app.json` plugin config updated; verification commands updated. Back-button bug fixed in `app/(tabs)/activity/[contractId].tsx` (was hard-coded `router.navigate` to activity root, now uses `safeGoBack`). Google OAuth consent branding configured (App name `Kanek`, authorized domains `kanek.bz` + Supabase host, home/privacy/terms URLs). |

---

**End of repository guide.**

When in doubt, do not invent. Run a tool, read the file, ask the user. The
behavioral rules for the agent — when to ask, when to pause, what never to
do — are in `AGENTS.md`. The cross-repo agent persona is in
`.github/agents/kanek-mobile-workspace.agent.md`.
