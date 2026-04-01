# Kanek — AI Coding Instructions

> Community Mobility Board for Belize. **Not** a dispatch system. **Not** Uber.
> A living feed where Belizeans post rides, routes, errands, deliveries, and jobs.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Mobile | React Native + Expo | SDK 55 / RN 0.83.2 / React 19.2.0 |
| Navigation | Expo Router (file-based) | ~55.0.8 |
| Language | TypeScript (strict) | ~5.9.2 |
| State | Redux Toolkit + RTK Query | ^2.6.1 |
| Backend | Supabase (Auth, Postgres 17, Storage, Realtime, Edge Functions) | ^2.49.4 |
| Auth | Supabase Phone OTP + hCaptcha bot protection | |
| Maps | Mapbox GL (@rnmapbox/maps + mapbox-gl web) | ^10.3.0 / ^3.20.0 |
| Payments | Cash (default) + E-Kyash (digital, BZD) | |
| Push | Expo Notifications + FCM/APNs | |
| Email | Supabase Edge Functions + Resend | |
| Admin | Next.js 15.2.4 (App Router, Tailwind CSS 4, Supabase SSR) | |
| Edge Functions | Deno (Supabase Edge Functions) | |
| Node | v22 LTS | |

---

## Project Structure

```
kanek/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root: Redux Provider → Stack
│   ├── index.tsx                 # Entry redirect
│   ├── (auth)/                   # Onboarding (welcome, phone-verify, role-select, id-upload, driver-docs)
│   ├── (tabs)/                   # Bottom Tab Navigator
│   │   ├── explore/              # Feed + map + [postId] detail
│   │   ├── post/                 # Create post forms (route, errand, package, job)
│   │   ├── activity/             # Bookings, contracts, notifications, post/[postId]
│   │   └── profile/              # Profile, settings, documents, wallet, reports
│   └── modals/                   # Modal screens (SOS, rate, payment, reports, etc.)
├── src/
│   ├── components/               # All UI components
│   │   ├── cards/                # Post cards (RouteOfferCard, ErrandCard, etc.)
│   │   ├── forms/                # Form inputs (LocationInput, DateInput, PriceInput)
│   │   ├── icons/                # Custom SVG icons (Compass, MapPin, Star, etc.)
│   │   ├── map/                  # Map components (KanekMap, LiveTrackingMap, etc.)
│   │   ├── payment/              # E-Kyash payment flow
│   │   ├── profile/              # Profile cards, trust badges, ratings
│   │   └── ui/                   # Primitives (Button, TextInput, Badge, Card, etc.)
│   ├── hooks/                    # Custom hooks
│   ├── lib/                      # Utilities (supabase client, mapbox, helpers, constants)
│   ├── store/                    # Redux store
│   │   ├── api/                  # RTK Query API slices (9 slices)
│   │   └── slices/               # Redux slices (auth, location, notifications, toast)
│   ├── theme/                    # Design tokens (colors, typography, spacing)
│   └── types/                    # TypeScript types (database.ts, ekyash.ts)
├── supabase/
│   ├── migrations/               # 33 SQL migration files
│   ├── functions/                # 13 Deno edge functions
│   └── templates/                # Email templates
├── admin/                        # Next.js admin panel (separate app)
└── assets/                       # Fonts (Work Sans, Manrope), icons, splash
```

---

## Critical Rules

### 1. Navigation — Tab Isolation

Expo Router resolves routes to the tab that owns them. A screen at `/(tabs)/explore/[postId]` will **always switch to the Explore tab**, even if navigated from Activity.

**Rule:** If a screen needs to be opened from multiple tabs while preserving back-navigation, create a thin wrapper for each tab that imports a shared component.

```
src/components/PostDetailScreen.tsx   ← shared component (accepts backFallback prop)
app/(tabs)/explore/[postId].tsx       ← <PostDetailScreen backFallback="/(tabs)/explore/" />
app/(tabs)/activity/post/[postId].tsx ← <PostDetailScreen backFallback="/(tabs)/activity/" />
```

Use `safeGoBack(fallback)` from `src/lib/helpers.ts` for back navigation — it uses `router.back()` if history exists, else `router.navigate(fallback)`.

### 2. State Management Pattern

All data fetching uses **RTK Query with `fakeBaseQuery`** — queries/mutations call Supabase client directly, not HTTP endpoints.

```typescript
// Pattern for all API slices
const api = createApi({
  reducerPath: 'apiName',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Tag'],
  endpoints: (builder) => ({
    getData: builder.query({
      queryFn: async (args) => {
        const { data, error } = await supabase.from('table').select('*');
        if (error) return { error: { status: 'CUSTOM_ERROR', data: error.message } };
        return { data };
      },
      providesTags: ['Tag'],
    }),
  }),
});
```

**9 API slices:** postsApi, bookingsApi, profilesApi, ratingsApi, ekyashApi, reportsApi, notificationsApi, checkinsApi, messagesApi

**4 state slices:** authSlice, locationSlice, notificationsSlice, toastSlice

### 3. Design System — AllTrails Trailblazer

| Token | Value | Usage |
|-------|-------|-------|
| `forest-900` | `#142800` | Primary text, headers |
| `forest-600` | `#274312` | Buttons, active states |
| `forest-400` | `#656e5e` | Icons inactive, subtle text |
| `accent-green` | `#51c152` | Success, CTA, active tab |
| `neon-green` | `#65f67b` | Highlights, badges |
| `accent-blue` | `#4967f6` | Links, info |
| `neutral-50` | `#f6f6f4` | Background |
| `neutral-100` | `#efefec` | Card background |
| `neutral-200` | `#dbdad2` | Borders |
| `error` | `#d32f2f` | Errors, strikes, SOS |

**Typography:** Work Sans (headings, bold 700), Manrope (body, regular 400 / bold 700)

**Icons:** All custom SVG via `react-native-svg`. **No emoji anywhere in UI.**

**Components:** Pill-shaped buttons, 12px rounded cards with subtle shadow, 24x24 outlined stroke icons.

### 4. Database — Key Facts

- **Supabase project:** `tlggdherqjvybpddsqjj`
- **33 migrations** — run sequentially, never modify deployed migrations
- **20+ tables** with RLS policies (see `docs/database-schema.md` for full reference)
- **Types generated** via `supabase gen types typescript` → `src/types/database.ts`
- **All prices in cents** (integer) — display as `$X.XX BZD`
- **All coordinates:** lat `numeric(10,7)`, lng `numeric(10,7)`
- **Belize bounding box:** lat 15.889–18.497, lng -89.225 to -87.485

### 5. Validation Rules

Validate at boundaries only (forms + edge functions). Internal code trusts validated data.

| Field | Rule |
|-------|------|
| Phone | `+501` + exactly 7 digits (`/^\+501[0-9]{7}$/`) |
| Price | Positive integer cents, max 999900 ($9,999 BZD) |
| Seats | 1–20 integer |
| Description | 1–500 chars, no HTML |
| Name | 1–50 chars |
| ID photo | JPEG/PNG, max 5MB, min 640px width |
| Coordinates | Within `BELIZE_BBOX` |

### 6. Edge Functions

13 Deno edge functions in `supabase/functions/`:

| Function | Purpose |
|----------|---------|
| `ekyash-authorize` | Get E-Kyash session token |
| `ekyash-create-invoice` | Create payment invoice (3% platform fee + optional donation) |
| `ekyash-invoice-info` | Query invoice status |
| `ekyash-callback` | Webhook: receive payment status from E-Kyash |
| `ekyash-cancel-invoice` | Cancel pending invoice |
| `ekyash-refund` | Issue refund |
| `send-push` | Push notification via Expo Push API |
| `send-email-receipt` | Email receipt via Resend |
| `send-sms-sos` | SOS SMS with GPS location |
| `expire-posts` | Cron: expire old posts/reports |
| `process-strikes` | Cron: enforce strike penalties |
| `check-route-activation` | Check if route can activate |
| `update-rating-avg` | Trigger: recalculate rating after new review |

### 7. E-Kyash Payment Flow

1. App calls `ekyash-authorize` → gets session token
2. App calls `ekyash-create-invoice` with contract details → gets QR URL + payment link
3. User scans QR or opens E-Kyash app
4. E-Kyash calls `ekyash-callback` webhook → updates transaction status
5. App polls `ekyash-invoice-info` for confirmation

Platform fee: **3%** of transaction. Optional community donation tracked in `donation_totals`.

### 8. Key Constants (`src/lib/constants.ts`)

```typescript
PHONE_REGEX = /^\+501[0-9]{7}$/
BELIZE_BBOX = { north: 18.497, south: 15.889, east: -87.485, west: -89.225 }
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  // 5MB
MAX_SEATS = 20
MAX_PRICE_CENTS = 999_900
MAX_DESCRIPTION_LENGTH = 500
TOP_ROUTES_LIMIT = 10
GAS_PRICES_LIMIT = 5
```

### 9. Environment Variables

**Mobile app** (`.env.local`):
```
EXPO_PUBLIC_SUPABASE_URL=https://tlggdherqjvybpddsqjj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=<mapbox-token>
EXPO_PUBLIC_HCAPTCHA_SITE_KEY=<hcaptcha-site-key>
```

**Admin panel** (`admin/.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=https://tlggdherqjvybpddsqjj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

**Edge function secrets** (set in Supabase dashboard):
```
EKYASH_SID, EKYASH_PIN_HASH, EKYASH_API_KEY
RESEND_API_KEY
```

### 10. Common Commands

```bash
npm start                    # Expo dev server
npm run web                  # Web (localhost:8081)
npm run ios                  # iOS simulator
npm run android              # Android emulator
npm run typecheck            # tsc --noEmit
npm run lint                 # ESLint

cd admin && npm run dev      # Admin panel (localhost:3001)

supabase link --project-ref tlggdherqjvybpddsqjj
supabase db push             # Apply migrations
supabase functions deploy    # Deploy all edge functions
supabase gen types typescript --project-id tlggdherqjvybpddsqjj > src/types/database.ts
```

### 11. App Configuration

- **Bundle ID:** `bz.kanek.app` (iOS + Android)
- **URL scheme:** `kanek://`
- **Orientation:** Portrait only
- **Splash background:** `#142800` (forest-900)

### 12. Known Deferred Issues

- `flags.target_id` has no FK constraint (polymorphic pattern)
- `email_receipts` allows both `contract_id` and `ekyash_txn_id` to be NULL (needs CHECK)
- `ekyash_txn_id` FK on email_receipts defaults to RESTRICT (consider CASCADE)

---

## Anti-Patterns to Avoid

1. **Don't navigate to another tab's route** — it switches tabs and breaks back-navigation
2. **Don't add HTTP base queries** — all RTK Query slices use `fakeBaseQuery()` with Supabase client
3. **Don't use emoji in UI** — all icons are custom SVG components
4. **Don't modify deployed migrations** — create new migration files instead
5. **Don't hardcode prices** as dollars — always use cents (integer), format at display
6. **Don't skip RLS policies** — every new table needs proper Row Level Security
7. **Don't add validation in internal code** — validate at form boundary and edge function boundary only
