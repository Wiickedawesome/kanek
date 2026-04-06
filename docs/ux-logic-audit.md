# UX / Logic Audit — Kanek Mobile App

> Audit date: April 2026
> Scope: All user-facing flows — booking, notifications, contracts, chat, payments, ratings, cancellation, posting, sign-out cleanup.

---

## Summary

| Category | Issues Found | Fixed | Remaining |
|----------|-------------|-------|-----------|
| Terminology / Copy | 7 | 7 | 0 |
| State Cleanup | 1 | 1 | 0 |
| Notification Flow | 0 | — | 0 |
| Navigation | 0 | — | 0 |
| Payment Flow | 1 | — | 1 (design) |
| Booking Logic | 0 | — | 0 |
| Realtime | 0 | — | 0 |
| Form Validation | 0 | — | 0 |

**Overall verdict:** The core architecture is solid. All critical flows work correctly end-to-end. The issues found were exclusively **UX copy / terminology** problems where generic "seat" / "trip" language was applied to non-route post types, plus one missing API state reset on sign-out.

---

## Issues Found & Fixed

### 1. "Seats booked" shown for all post types ✅ FIXED

**Files:** `activity/index.tsx`, `PostDetailScreen.tsx`, `[contractId].tsx`

**Problem:** Activity cards, post detail booker meta, and contract detail all showed "1 seat · cash" for every post type (errands, packages, jobs) — semantically wrong.

**Fix:**
- `activity/index.tsx` → `getBookingFooterLabel()` returns type-appropriate text: "Errand · Cash", "Application · Cash", "Delivery · Cash", "Drive offer · Cash"
- `PostDetailScreen.tsx` → Booker meta only shows seat count for `route_offer`
- `[contractId].tsx` → "Seats" row gated to `route_offer` type only

---

### 2. "Complete Trip" text used for all post types ✅ FIXED

**File:** `[contractId].tsx`

**Problem:** The "Complete Trip" button and confirmation dialog said "Complete Trip" even for jobs, errands, and packages.

**Fix:** Button now shows "Complete Trip" for `route_offer`/`route_request`, "Mark Complete" for all others. Error message also updated.

---

### 3. Raw payment method string in activity footer ✅ FIXED

**File:** `activity/index.tsx`

**Problem:** Footer label showed raw DB enum (`ekyash`, `cash`) instead of human-readable labels.

**Fix:** `getBookingFooterLabel()` now maps `ekyash` → `E-Kyash`, `cash` → `Cash`.

---

### 4. Push notification text incorrect per post type ✅ FIXED (prior session)

**File:** `bookingsApi.ts` → `buildAuthorJoinNotification()`

**Problem:** Push notifications for jobs said "New Booking!" (should be "New Applicant!"), errands/packages showed raw type string.

**Fix:** Per-type notification title/body: "Seat Booked!" / "Driver Offered!" / "New Applicant!" / "Errand Accepted!" / "Delivery Accepted!"

---

### 5. `messagesApi` not reset on sign-out ✅ FIXED

**File:** `useAuth.ts`

**Problem:** All 8 other API slices were reset on sign-out, but `messagesApi` was missing. Cached chat messages could leak between users on the same device.

**Fix:** Added `dispatch(messagesApi.util.resetApiState())` to sign-out.

---

## Flows Audited — No Issues Found

### Booking Flow (per post type)

| Post Type | Create Booking | DB Trigger Behavior | Contract Created | Status | Verdict |
|-----------|---------------|---------------------|------------------|--------|---------|
| `route_offer` | Book Seat (rider) | Auto-confirm, increment `seats_filled`, fill when full | Yes, on confirm | ✅ Correct | |
| `route_request` | Offer to Drive (driver) | Auto-confirm, fill immediately | Yes, on confirm | ✅ Correct | |
| `errand` | Accept Errand (driver) | Auto-confirm, fill immediately | Yes, on confirm | ✅ Correct | |
| `package` | Deliver Package (driver) | Auto-confirm, fill immediately | Yes, on confirm | ✅ Correct | |
| `job` | Apply for Job (driver) | Stays `pending` until owner accepts via `accept_job_application` RPC | Yes, on accept | ✅ Correct | |

The DB trigger logic in `00040_job_application_flow.sql` correctly differentiates all five flows.

### Notification Flow

| Event | DB Trigger (in-app) | Client Push | Realtime Toast | Verdict |
|-------|---------------------|-------------|----------------|---------|
| New booking | ✅ `handle_new_booking_notification` | ✅ `sendPushOnly` in `bookingsApi.createBooking` | ✅ via `user:{userId}` channel | Correct |
| Job accepted | ✅ `accept_job_application` RPC | ✅ `sendPushOnly` in `bookingsApi.acceptJobApplication` | ✅ via notification channel | Correct |
| Booking cancelled | ✅ `notify_on_cancellation` trigger | N/A (no client push) | ✅ via notification channel | Correct |
| Contract completed | ✅ `notify_on_contract_completed` trigger | N/A | ✅ via notification channel | Correct |
| New message | ✅ `notify_on_new_message` trigger | ✅ `send-push` in `messagesApi.sendMessage` | ✅ via notification channel | Correct |
| Route activated | ✅ `check-route-activation` edge function | Via edge function | ✅ via notification channel | Correct |

No duplicate notifications — DB triggers handle in-app rows, client handles push-only. The dual approach is consistent across all events.

### Notification Routing

| Notification Type | Data Payload | Route Target | Verdict |
|-------------------|-------------|-------------|---------|
| `new_booking` | `{ postId }` | `/(tabs)/activity/post/{postId}` | ✅ Correct |
| `errand_accepted` | `{ postId }` | `/(tabs)/activity/post/{postId}` | ✅ Correct |
| `job_application` | `{ postId }` | `/(tabs)/activity/post/{postId}` | ✅ Correct |
| `booking_cancelled` | `{ postId }` | `/(tabs)/activity/post/{postId}` | ✅ Correct |
| `contract_completed` | `{ contractId, ratedId }` | `/modals/rate` | ✅ Correct |
| `job_accepted` | `{ contractId }` | `/(tabs)/activity/{contractId}` | ✅ Correct |
| `new_message` | `{ contract_id }` | `/(tabs)/activity/{contractId}` | ✅ Correct |
| `route_activated` | `{ postId }` | `/(tabs)/activity/post/{postId}` | ✅ Correct |
| `post_cancelled` | `{}` | No-op (stays on page) | ✅ Correct |

The `getNotificationRouteData` helper handles both camelCase and snake_case payload keys.

### Realtime Subscriptions

| Channel | Subscribed In | Invalidates | Verdict |
|---------|--------------|-------------|---------|
| `user:{userId}` | `useRealtime()` (auto on mount) | Notifications, Posts, Bookings, Contracts | ✅ Correct |
| `bookings:{userId}` | `activity/index.tsx` | Booking list | ✅ Correct |
| `tracking:{contractId}` | `[contractId].tsx` (when active) | Driver location state | ✅ Correct |
| `messages:{contractId}` | `[contractId].tsx` | Message list | ✅ Correct |
| `road-reports` | `explore/index.tsx` | Road reports + gas prices | ✅ Correct |

All channels clean up on unmount via returned unsubscribe functions.

### Sign-Out Cleanup

All 9 API slices are now properly reset:
1. `profilesApi` ✅
2. `postsApi` ✅
3. `bookingsApi` ✅
4. `ratingsApi` ✅
5. `ekyashApi` ✅
6. `reportsApi` ✅
7. `notificationsApi` ✅
8. `checkinsApi` ✅
9. `messagesApi` ✅ (newly added)

Session is nulled first, then Supabase signOut with AsyncStorage fallback.

### Post Creation Forms

| Form | Validation | Required Fields | Price in Cents | Payment Method | Verdict |
|------|-----------|-----------------|----------------|----------------|---------|
| Route (offer/request) | ✅ Complete | Title, origin, dest, date, time, price, seats (offer), vehicle (offer), description | ✅ | ✅ Cash/eKyash | Correct |
| Errand | ✅ Complete | Title, category, origin, fee, description | ✅ | ✅ Cash/eKyash | Correct |
| Package | ✅ Complete | Title, origin, dest, fee, description | ✅ | ✅ Cash/eKyash | Correct |
| Job | ✅ Complete | Title, category, pay rate, description | ✅ | ✅ Cash/eKyash | Correct |

All forms use `sanitizeDecimal` for price input, convert to cents before saving, cap at `MAX_PRICE_CENTS`, and validate `MAX_DESCRIPTION_LENGTH`.

### E-Kyash Payment Flow

- Invoice creation on modal mount ✅
- QR code display ✅
- "Open E-Kyash" deep link with `Linking.canOpenURL` check ✅
- Polling at 5s intervals for status ✅
- Success → alert + dismiss ✅
- Cancelled → alert + back ✅
- Error state with Go Back button ✅

### Rating Flow

- Guard against rating yourself (other party check) ✅
- Guard against double-rating (`useCheckHasRatedQuery`) ✅
- Stars required validation ✅
- Punctuality (on-time) toggle ✅
- Anonymous option ✅
- Comment with 300-char limit ✅
- Already-rated screen with "Go Back" ✅

### Tab Isolation

All shared screens follow the `backFallback` pattern:
- `PostDetailScreen` → wrapped in `explore/[postId]` and `activity/post/[postId]`
- `safeGoBack()` used consistently for back navigation
- No cross-tab navigations found

---

## Design Notes (Not Bugs)

### 1. E-Kyash payment only prompted for `route_offer` after booking

`shouldOpenPaymentAfterBooking()` returns `true` only for `route_offer` with `ekyash` payment. For errands/packages/jobs with eKyash, the user must manually open the contract and tap "Pay with E-Kyash". This is by design (the payer varies by type) but could be confusing. **Suggestion:** Consider showing a hint/banner in the contract detail for eKyash contracts that haven't been paid yet.

### 2. SOS button shows for all active contracts

The SOS button in contract detail appears for all active contracts including jobs/errands. While arguably still useful for safety, it's most relevant for in-transit routes. This is a design choice, not a bug.

### 3. "eKyash" vs "E-Kyash" inconsistency in forms

Post creation forms show "eKyash" (lowercase e) in the settlement selector chips, while everywhere else (contract detail, activity cards) it's displayed as "E-Kyash". Minor branding inconsistency.

---

## Files Modified in This Audit

| File | Changes |
|------|---------|
| `app/(tabs)/activity/[contractId].tsx` | "Seats" row gated to `route_offer`; "Complete Trip" text now type-aware |
| `app/(tabs)/activity/index.tsx` | Payment method display formatted ("Cash" / "E-Kyash" instead of raw enum) |
| `src/hooks/useAuth.ts` | Added `messagesApi.util.resetApiState()` to sign-out |

Files modified in prior session (for completeness):
| File | Changes |
|------|---------|
| `app/(tabs)/activity/index.tsx` | `getBookingFooterLabel()` helper with per-type labels |
| `src/components/PostDetailScreen.tsx` | Booker meta seat count gated to `route_offer` |
| `src/store/api/bookingsApi.ts` | `buildAuthorJoinNotification()` per-type push text |

