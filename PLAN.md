# kanek — Technical Plan

> Community Mobility Board for Belize
> "AllTrails for routes & drivers"

---

## 1. What kanek IS

A **community board** where Belizeans post mobility needs — rides, routes, errands, deliveries, jobs — and others respond. It is NOT a dispatch system. It is NOT Uber. It is a living feed of people helping people move.

Think AllTrails: you open the app, you see a feed of routes and posts near you. You browse, you join, you post your own. The map shows what's happening. The community reports road conditions and gas prices. Everything is built around trust profiles, contracts, and the way Belizeans already operate.

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Mobile App | React Native + Expo (SDK 52) | iOS + Android, single codebase |
| Routing | Expo Router (file-based) | Navigation |
| Language | TypeScript (strict) | Type safety |
| State | Redux Toolkit + RTK Query | Global state + API caching |
| Backend | Supabase | Auth, Postgres DB, Storage, Realtime, Edge Functions |
| Auth | Supabase Phone OTP | Phone number is the identity |
| Admin | Next.js (kanek.bz) | Web admin panel for review/moderation |
| Maps | Mapbox GL | Map display, routing, geocoding |
| Payments | Cash (default) + E-Kyash (digital) | E-Kyash via Supabase Edge Functions |
| Push | Expo Notifications + FCM/APNs | Alerts, reminders, SOS |
| Email | Supabase Edge Functions + Resend | Transaction receipts |
| Icons | Custom SVG (react-native-svg) | No emojis — all icons are SVG components |
| Project | `tlggdherqjvybpddsqjj.supabase.co` | Existing Supabase project |
| Node | v22 LTS | Runtime |

---

## 3. Design System — "kanek Green"

Adapted from AllTrails Trailblazer. Forest greens fit Belize (jungle, nature, community).

### Color Tokens

```
// Primary
forest-900:    #142800   // Deepest green — text, headers
forest-800:    #1c2513   // Dark backgrounds
forest-700:    #2b381f   // Secondary dark
forest-600:    #274312   // Buttons, active states
forest-500:    #4c5c43   // Muted green
forest-400:    #656e5e   // Subtle text, icons

// Neutral
neutral-0:     #ffffff   // White
neutral-50:    #f6f6f4   // Background
neutral-100:   #efefec   // Card background
neutral-200:   #dbdad2   // Borders, dividers
neutral-300:   #c2c2b8   // Disabled state
neutral-400:   #a7a99f   // Placeholder text
neutral-500:   #8b9182   // Secondary text

// Accent
accent-green:  #51c152   // Success, active, CTA
neon-green:    #65f67b   // Highlights, badges
neon-teal:     #49de61   // Secondary accent
accent-blue:   #4967f6   // Links, info

// Semantic
error:         #d32f2f   // Strikes, SOS, errors
warning:       #f9a825   // Caution states
```

### Typography

| Role | Font | Weight | Size/Line |
|---|---|---|---|
| H1 | Work Sans | Bold (700) | 32/36 |
| H2 | Work Sans | Bold (700) | 24/28 |
| H3 | Work Sans | Medium (500) | 20/24 |
| Body 1 | Manrope | Regular (400) | 16/24 |
| Body 1 Bold | Manrope | Bold (700) | 16/24 |
| Body 2 | Manrope | Regular (400) | 14/20 |
| Body 2 Bold | Manrope | Bold (700) | 14/20 |
| Caption | Manrope | Regular (400) | 12/16 |

### Icons

All icons are **custom SVG components** via `react-native-svg`. No emojis anywhere in the UI.

Icon library: outlined stroke style, 24x24 default, forest-400 inactive / accent-green active.

| Icon Name | Usage |
|---|---|
| `compass` | Explore tab |
| `plus-circle` | Post tab |
| `clipboard-list` | Activity tab |
| `user` | Profile tab |
| `circle-dot` (green fill) | Driver Offering badge |
| `circle-dot` (blue fill) | Riders Looking badge |
| `package` | Errand / Package badge |
| `alert-triangle` | Road Report badge |
| `star` | Rating display |
| `clock` | Punctuality percentage |
| `map-pin` | Location pins |
| `navigation` | Route direction |
| `search` | Search bar |
| `filter` | Filter controls |
| `phone` | Contact / auth |
| `shield-alert` | SOS button |
| `receipt` | Transaction / receipt |
| `qr-code` | E-Kyash QR display |
| `fuel` | Gas price reports |
| `construction` | Road condition reports |

### Component Style

- **Buttons**: Pill-shaped (full border-radius), forest-600 primary, white text
- **Cards**: Rounded corners (12px), subtle shadow, neutral-100 background
- **Icons**: SVG outlined stroke, forest-400 default, accent-green active
- **Map controls**: Floating circular buttons (white bg, shadow)
- **Navigation**: Bottom tab bar (Explore, Post, Activity, Profile)
- **Search**: Prominent search bar at top of Explore, rounded

---

## 4. App Structure — Screens & Navigation

### Bottom Tab Bar

```
┌─────────┬─────────┬─────────┬─────────┐
│ Explore │  Post   │Activity │ Profile │
│ compass │ plus-   │clipboard│  user   │
│  (svg)  │ circle  │ -list   │  (svg)  │
└─────────┴─────────┴─────────┴─────────┘
```

### Screen Map

```
(auth)
├── onboarding/
│   ├── welcome           — Splash + tagline
│   ├── phone-verify      — Phone number entry + OTP
│   ├── role-select       — "I need rides" / "I drive" (can do both later)
│   ├── id-upload         — Government ID photo (all users)
│   └── driver-docs       — License, insurance, vehicle info (drivers only)
│
(tabs)
├── explore/
│   ├── index             — Community board feed (cards, search, filters)
│   ├── map               — Full map view with post pins
│   ├── [postId]          — Post detail (route/errand/job)
│   └── search            — Search + filter results
│
├── post/
│   ├── index             — "What do you need?" — choose post type
│   ├── route             — Create route offer (driver) or route request (rider)
│   ├── errand            — Create errand request
│   ├── package           — Create package delivery
│   └── job               — Create job posting
│
├── activity/
│   ├── index             — Active + upcoming bookings
│   ├── history           — Past trips & contracts
│   └── [contractId]      — Contract detail + live tracking (when active)
│
├── profile/
│   ├── index             — My profile (rating, punctuality, stats)
│   ├── settings          — Account settings, role upgrade, emergency contact
│   ├── documents         — Manage verification documents
│   ├── wallet            — E-Kyash connection status, transaction history
│   └── reports           — My traffic/gas reports
│
(modals / overlays)
├── sos                   — SOS trigger (sends GPS to emergency contact)
├── report-road           — Submit road/traffic report
├── report-gas            — Submit gas price report
├── rate                  — Post-trip rating modal
├── payment-select        — Cash vs E-Kyash choice
├── ekyash-pay            — E-Kyash QR display / deep link launch
├── flag-content          — Report a post / user
└── download-map          — Select region to download for offline use
```

### Navigation Flow

```
First launch → Welcome → Phone Verify → Role Select → ID Upload → [Driver Docs] → Explore

Returning user → Explore (home)

During active trip → Activity tab locks to live tracking view
                   → SOS button visible as floating overlay
```

---

## 5. The Community Board (Explore)

This is the heart of the app. Modeled after AllTrails' feed.

### Feed Card Types

**Route Card (Driver Offering)**
```
┌──────────────────────────────────────┐
│ [circle-dot green] Driver Offering   │
│ ┌──────────┐                         │
│ │ Map      │  Belize City > Belmopan │
│ │ Preview  │  Tomorrow · 6:30 AM     │
│ └──────────┘  $15 BZD/seat           │
│  [star] 4.8 · [clock] 91% · 3/5     │
│  Juan M.  ·  Toyota Hilux            │
└──────────────────────────────────────┘
```

**Route Card (Riders Looking)**
```
┌──────────────────────────────────────┐
│ [circle-dot blue] Riders Looking     │
│ ┌──────────┐                         │
│ │ Map      │  San Ignacio > Belize   │
│ │ Preview  │  Friday · 5:00 PM       │
│ └──────────┘  Offering $12 BZD/seat  │
│  3 riders  ·  Need a driver          │
│  Maria T. · [star] 4.5 · [clock] 78%│
└──────────────────────────────────────┘
```

**Errand Card**
```
┌──────────────────────────────────────┐
│ [package] Errand · Grocery Pickup    │
│  Brodies > Mile 3, Belize City      │
│  Need by 2:00 PM today              │
│  Errand fee: $10 BZD                │
│  Item cost: ~$45 BZD (separate)      │
│  Ana R.  ·  [star] 4.9              │
└──────────────────────────────────────┘
```

**Road Report Card**
```
┌──────────────────────────────────────┐
│ [alert-triangle] Road Report · 25m   │
│  Flooding on Western Highway         │
│  near Hattieville                    │
│  Reported by 3 users                │
└──────────────────────────────────────┘
```

### Filters

- **Type**: Routes · Errands · Jobs · Reports
- **Direction**: "From" / "To" district
- **When**: Today · Tomorrow · This week · Custom
- **Role**: Drivers Offering · Riders Looking
- **Sort**: Nearest · Soonest · Best rated · Cheapest

### Map View Toggle

Explore has a toggle between **List** (card feed) and **Map** (full Mapbox map with colored pins for each post type). Same data, two views. Like AllTrails.

### Offline Maps (Day One)

Belize has unreliable cellular coverage outside major towns. Downloadable Mapbox tiles are a core feature, not an afterthought.

**How it works:**
- Settings > "Download Map" opens region selector modal
- User draws/selects a rectangular region on the map (presets: Belize District, Cayo, Orange Walk, etc.)
- App downloads Mapbox vector tiles for that region via Mapbox Offline API
- Stored on device (estimated 50-150 MB for all of Belize at useful zoom levels)
- Feed data cached locally with timestamps -- stale data shown with "[clock] Last updated X min ago" indicator
- Posts created offline queue and sync when connection returns
- First-launch prompt: "Download Belize map for offline use?" with size estimate

**Tech:**
- `@rnmapbox/maps` offline pack API (`offlineManager.createPack()`)
- SQLite or MMKV for local feed cache
- Network status via `@react-native-community/netinfo`
- Background sync queue for offline-created posts/bookings

---

## 5.5. Input Validation Rules

All validation happens at the boundary -- forms and edge functions. Internal code trusts validated data.

| Field | Rule | Example |
|---|---|---|
| Phone | `+501` prefix + exactly 7 digits | `+5016001234` |
| Phone display | Strip prefix, show as `600-1234` | |
| Email | RFC 5322 format, optional field | `juan@gmail.com` |
| Email | Lowercase + trim before storage | |
| Name | 1-50 chars, letters + spaces + hyphens only | `Juan Carlos` |
| Price | Positive integer (cents), max 999900 ($9,999 BZD) | `1500` = $15.00 |
| Seats | 1-20 integer | |
| Description | 1-500 chars, sanitized (no HTML) | |
| Coordinates | Lat: 15.8-18.5, Lng: -89.3 to -87.4 (Belize bbox) | |
| Gov't ID photo | JPEG/PNG, max 5MB, min 640px width | |
| Vehicle plate | 1-10 alphanumeric chars | |

**Phone validation regex:** `^\+501[0-9]{7}$`

**Belize bounding box** (reject coordinates outside):
```
North: 18.497
South: 15.889
East:  -87.485
West:  -89.225
```

---

## 6. Database Schema (Supabase Postgres)

### Core Tables

```sql
-- Users & Auth
profiles
├── id                  uuid PK (= auth.users.id)
├── phone               text UNIQUE NOT NULL
├── first_name          text
├── last_name           text
├── role                enum('rider', 'driver', 'admin')
├── avatar_url          text
├── email               text  -- optional, validated format, for receipts
├── rating_avg          numeric(2,1) DEFAULT 0
├── punctuality_pct     integer DEFAULT 100
├── strikes_soft        integer DEFAULT 0
├── strikes_hard        integer DEFAULT 0
├── account_status      enum('pending', 'active', 'restricted', 'suspended', 'dormant')
├── emergency_contact   text  -- phone number for SOS
├── last_active_at      timestamptz
├── created_at          timestamptz DEFAULT now()
└── updated_at          timestamptz DEFAULT now()

-- Driver-specific
driver_details
├── id                  uuid PK (= profiles.id)
├── license_url         text  -- Supabase Storage path
├── insurance_url       text
├── id_document_url     text
├── vehicle_make        text
├── vehicle_model       text
├── vehicle_year        integer
├── vehicle_color       text
├── vehicle_plate       text
├── verified            boolean DEFAULT false
├── verified_at         timestamptz
├── verified_by         uuid FK -> profiles.id  -- admin who verified
├── rejection_reason    text  -- if rejected, why
└── review_status       enum('pending', 'approved', 'rejected') DEFAULT 'pending'

-- Rider ID verification
rider_documents
├── id                  uuid PK DEFAULT gen_random_uuid()
├── user_id             uuid FK → profiles.id
├── document_url        text  -- Supabase Storage path
├── verified            boolean DEFAULT false
├── review_status       enum('pending', 'approved', 'rejected') DEFAULT 'pending'
├── reviewed_by         uuid FK → profiles.id  -- admin
├── rejection_reason    text
└── uploaded_at         timestamptz DEFAULT now()

-- Flagged content (community moderation)
flags
├── id                  uuid PK DEFAULT gen_random_uuid()
├── reporter_id         uuid FK → profiles.id
├── target_type         enum('post', 'user', 'booking')
├── target_id           uuid  -- FK to the flagged entity
├── reason              enum('spam', 'scam', 'harassment', 'fake_account', 'safety', 'other')
├── description         text
├── status              enum('pending', 'reviewed', 'action_taken', 'dismissed')
├── reviewed_by         uuid FK → profiles.id  -- admin
├── reviewed_at         timestamptz
└── created_at          timestamptz DEFAULT now()

-- Admin action log (audit trail)
admin_actions
├── id                  uuid PK DEFAULT gen_random_uuid()
├── admin_id            uuid FK → profiles.id
├── action              enum('approve_driver', 'reject_driver', 'approve_rider_doc', 'reject_rider_doc', 'suspend_user', 'unsuspend_user', 'remove_post', 'dismiss_flag', 'issue_strike')
├── target_type         text  -- 'profile', 'post', 'flag', etc.
├── target_id           uuid
├── reason              text
├── metadata            jsonb
└── created_at          timestamptz DEFAULT now()

-- The community board posts
posts
├── id                  uuid PK DEFAULT gen_random_uuid()
├── author_id           uuid FK → profiles.id
├── type                enum('route_offer', 'route_request', 'errand', 'package', 'job')
├── status              enum('open', 'activated', 'in_progress', 'completed', 'cancelled', 'expired')
├── title               text
├── description         text
├── origin_address      text
├── origin_lat          numeric(10,7)
├── origin_lng          numeric(10,7)
├── dest_address        text
├── dest_lat            numeric(10,7)
├── dest_lng            numeric(10,7)
├── departure_at        timestamptz
├── price_cents         integer  -- in BZD cents
├── seats_total         integer  -- for routes
├── seats_filled        integer DEFAULT 0
├── min_riders          integer  -- minimum to activate route
├── pickup_style        enum('single', 'multi_stop')
├── errand_category     enum('grocery','bill','pharmacy','document','delivery','food','hardware','other')
├── errand_fee_cents    integer  -- runner earns this
├── item_cost_cents     integer  -- requester owes separately
├── route_geometry      jsonb  -- Mapbox route GeoJSON
├── expires_at          timestamptz
├── created_at          timestamptz DEFAULT now()
└── updated_at          timestamptz DEFAULT now()

-- Joining / accepting posts
bookings
├── id                  uuid PK DEFAULT gen_random_uuid()
├── post_id             uuid FK → posts.id
├── user_id             uuid FK → profiles.id  -- who's joining
├── role                enum('rider', 'driver')  -- in this booking
├── status              enum('pending', 'confirmed', 'cancelled', 'no_show', 'completed')
├── seats_booked        integer DEFAULT 1
├── payment_method      enum('cash', 'ekyash')
├── ekyash_invoice_id   text  -- E-Kyash invoice ID if applicable
├── cancelled_at        timestamptz
├── cancel_reason       text
├── created_at          timestamptz DEFAULT now()
└── updated_at          timestamptz DEFAULT now()

-- Contracts (source of truth)
contracts
├── id                  uuid PK DEFAULT gen_random_uuid()
├── post_id             uuid FK → posts.id
├── booking_id          uuid FK → bookings.id
├── parties             uuid[]  -- all user IDs involved
├── origin_address      text
├── origin_coords       point
├── dest_address        text
├── dest_coords         point
├── agreed_price_cents  integer
├── departure_at        timestamptz
├── terms               jsonb  -- any special conditions
├── status              enum('active', 'completed', 'disputed', 'cancelled')
├── created_at          timestamptz DEFAULT now()
└── completed_at        timestamptz

-- Ratings (bidirectional)
ratings
├── id                  uuid PK DEFAULT gen_random_uuid()
├── contract_id         uuid FK → contracts.id
├── rater_id            uuid FK → profiles.id
├── rated_id            uuid FK → profiles.id
├── stars               integer CHECK (1-5)
├── was_on_time         boolean  -- for punctuality tracking
├── comment             text
└── created_at          timestamptz DEFAULT now()

-- Strikes
strikes
├── id                  uuid PK DEFAULT gen_random_uuid()
├── user_id             uuid FK → profiles.id
├── contract_id         uuid FK → contracts.id (nullable)
├── type                enum('soft', 'hard')
├── reason              enum('late_cancel', 'no_show', 'early_leave', 'driver_no_show', 'report')
├── auto_generated      boolean DEFAULT true
└── created_at          timestamptz DEFAULT now()

-- Road & traffic reports
road_reports
├── id                  uuid PK DEFAULT gen_random_uuid()
├── reporter_id         uuid FK → profiles.id
├── type                enum('accident', 'checkpoint', 'traffic', 'flooding', 'construction', 'road_damage')
├── lat                 numeric(10,7)
├── lng                 numeric(10,7)
├── description         text
├── upvotes             integer DEFAULT 1
├── expires_at          timestamptz DEFAULT (now() + interval '2 hours')
└── created_at          timestamptz DEFAULT now()

-- Gas prices (crowdsourced)
gas_prices
├── id                  uuid PK DEFAULT gen_random_uuid()
├── reporter_id         uuid FK → profiles.id
├── station_name        text
├── station_lat         numeric(10,7)
├── station_lng         numeric(10,7)
├── regular_cents       integer  -- BZD cents per gallon
├── premium_cents       integer
├── diesel_cents        integer
├── verified_count      integer DEFAULT 1
└── reported_at         timestamptz DEFAULT now()

-- E-Kyash transactions (our record)
ekyash_transactions
├── id                  uuid PK DEFAULT gen_random_uuid()
├── contract_id         uuid FK → contracts.id
├── payer_id            uuid FK → profiles.id
├── payee_id            uuid FK → profiles.id
├── order_id            text UNIQUE  -- our generated order ID
├── invoice_id          text  -- E-Kyash invoice ID
├── transaction_id      text  -- E-Kyash transaction ID
├── amount_cents        integer
├── platform_fee_cents  integer  -- 2%
├── donation_cents      integer  -- 1%
├── currency            text DEFAULT 'BZD'
├── status              enum('pending', 'approved', 'cancelled', 'refunded')
├── callback_received   boolean DEFAULT false
├── callback_payload    jsonb
├── created_at          timestamptz DEFAULT now()
└── updated_at          timestamptz DEFAULT now()

-- Donation counter (materialized / cached)
donation_totals
├── id                  integer PK DEFAULT 1
├── total_cents         bigint DEFAULT 0
└── updated_at          timestamptz DEFAULT now()

-- Notifications (in-app)
notifications
├── id                  uuid PK DEFAULT gen_random_uuid()
├── user_id             uuid FK → profiles.id
├── type                text  -- 'booking_confirmed', 'route_activated', etc.
├── title               text
├── body                text
├── data                jsonb
├── read                boolean DEFAULT false
└── created_at          timestamptz DEFAULT now()

-- Waitlist for full routes
waitlist
├── id                  uuid PK DEFAULT gen_random_uuid()
├── post_id             uuid FK → posts.id
├── user_id             uuid FK → profiles.id
├── notified            boolean DEFAULT false
└── created_at          timestamptz DEFAULT now()
```

### Key RLS Policies

```
profiles:       SELECT public fields (name, rating, avatar) → anyone authenticated
                SELECT private fields (phone, emergency) → own row only
                UPDATE → own row only

driver_details: SELECT → owner + admin
                INSERT/UPDATE → owner only

posts:          SELECT → anyone authenticated
                INSERT → authenticated
                UPDATE → author only
                DELETE → author only (if status = 'open')

bookings:       SELECT → booking user + post author
                INSERT → authenticated
                UPDATE → booking user + post author

contracts:      SELECT → parties[] contains auth.uid()

ratings:        INSERT → rater must be in contract parties
                SELECT → anyone (public trust)

road_reports:   SELECT → anyone authenticated
                INSERT → authenticated

ekyash_*:       SELECT → payer or payee
                INSERT → service_role only (edge functions)

flags:          INSERT → authenticated (anyone can flag)
                SELECT → admin only
                UPDATE → admin only

admin_actions:  INSERT → admin only (service_role)
                SELECT → admin only
```

### Admin Access

Admin panel uses `service_role` key server-side (Next.js API routes). Never exposed to the client. Admin users identified by `profiles.role = 'admin'`. Admin auth flows through the same Supabase Phone OTP -- the admin panel checks role after login.

---

## 7. Supabase Edge Functions

```
supabase/functions/
├── ekyash-authorize/       — Start E-Kyash session
├── ekyash-create-invoice/  — Create payment invoice, return QR + deep link
├── ekyash-callback/        — Webhook receiver for payment status
├── ekyash-cancel-invoice/  — Cancel unpaid invoice
├── ekyash-refund/          — Full/partial refund
├── ekyash-invoice-info/    — Check invoice status
├── send-email-receipt/     — Send transaction receipt email via Resend
├── send-sms-sos/           — Send emergency SMS with GPS coords
├── check-route-activation/ — Cron: check if routes hit min riders
├── expire-posts/           — Cron: expire old posts
├── process-strikes/        — Auto-increment strikes on violations
└── update-rating-avg/      — Recalculate user rating after new review
```

### E-Kyash Integration Flow

```
User selects E-Kyash payment
        │
        ▼
App calls edge function: ekyash-create-invoice
        │
Edge fn: 1. Calls E-Kyash /authorization → gets session
         2. Calls E-Kyash /create-new-invoice → gets invoiceId, qrUrl, paymentLink
         3. Stores record in ekyash_transactions table
         4. Returns { qrUrl, paymentLink, invoiceId } to app
        │
        ▼
App shows either:
  • QR code image (for in-person scan)
  • "Pay with E-Kyash" button (deep link → opens E-Kyash app)
        │
        ▼
Customer approves in E-Kyash app
        │
        ▼
E-Kyash sends callback to: ekyash-callback edge function
        │
Edge fn: 1. Validates hash (HMAC-SHA256)
         2. Updates ekyash_transactions status
         3. Calculates 2% platform fee + 1% donation
         4. Updates donation_totals counter
         5. Updates booking/contract status
         6. Sends push notification to both parties
         7. Triggers send-email-receipt (if user has email on file)
```

### E-Kyash Amount Handling
- All amounts stored as **BZD cents** in our DB
- E-Kyash API expects amounts in cents too (1000 = $10 BZD)
- 3% fee on digital transactions: 1% donation + 2% platform
- Fee calculated server-side in edge function, never client

### Email Receipts (via Resend)

Digital payments (E-Kyash) and completed contracts trigger email receipts if the user has an email on file. Email is optional — phone is primary identity.

**When sent:**
- E-Kyash payment approved (callback confirms)
- Trip/errand/job contract marked completed
- Refund processed

**Receipt contains:**
- kanek branding (forest green header, SVG logo)
- Transaction ID, date, time
- Route: origin > destination (or errand description)
- Amount paid (BZD)
- Payment method (E-Kyash)
- Fee breakdown: 2% platform + 1% donation to MHAB
- Driver/runner name + rating
- Contract reference number
- "Thank you for moving Belize forward" footer

**Implementation:**
- Edge function `send-email-receipt` calls Resend API
- HTML email template stored in `supabase/functions/send-email-receipt/template.html`
- Resend free tier: 3,000 emails/month (sufficient for early stage)
- Email stored in `profiles.email` (nullable, optional field)

**DB addition to profiles table:**

`email` field already in profiles table (see Section 6). Validated format, optional.

**Env variable (set via supabase secrets set):**
```env
RESEND_API_KEY=<your-resend-api-key>
RESEND_FROM_EMAIL=receipts@kanek.bz
```

**DB table for receipt audit trail:**
```sql
email_receipts
├── id                  uuid PK DEFAULT gen_random_uuid()
├── user_id             uuid FK → profiles.id
├── contract_id         uuid FK → contracts.id (nullable)
├── ekyash_txn_id       uuid FK → ekyash_transactions.id (nullable)
├── email_to            text
├── type                enum('payment', 'completion', 'refund')
├── resend_id           text  -- Resend API message ID
├── status              enum('sent', 'delivered', 'failed')
├── sent_at             timestamptz DEFAULT now()
└── error               text  -- if failed
```

---

## 8. Realtime Channels (Supabase Realtime)

```
channel: post:{postId}
  → seat count updates (someone joins/leaves)
  → status changes (activated, completed, cancelled)

channel: tracking:{contractId}
  → driver location updates (every 3 sec during active trip)
  → trip status changes

channel: user:{userId}
  → new notifications
  → booking status changes

channel: road-reports
  → new reports near user's location
```

---

## 9. File Structure

```
kanek/
├── app/                          # Expo Router pages
│   ├── _layout.tsx               # Root layout
│   ├── (auth)/                   # Auth group
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx
│   │   ├── phone-verify.tsx
│   │   ├── role-select.tsx
│   │   ├── id-upload.tsx
│   │   └── driver-docs.tsx
│   ├── (tabs)/                   # Main tab group
│   │   ├── _layout.tsx           # Tab bar config
│   │   ├── explore/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # Community board feed
│   │   │   ├── map.tsx           # Full map view
│   │   │   ├── search.tsx
│   │   │   └── [postId].tsx      # Post detail
│   │   ├── post/
│   │   │   ├── index.tsx         # Choose post type
│   │   │   ├── route.tsx
│   │   │   ├── errand.tsx
│   │   │   ├── package.tsx
│   │   │   └── job.tsx
│   │   ├── activity/
│   │   │   ├── index.tsx         # Active bookings
│   │   │   ├── history.tsx
│   │   │   └── [contractId].tsx  # Live tracking / contract detail
│   │   └── profile/
│   │       ├── index.tsx
│   │       ├── settings.tsx
│   │       ├── documents.tsx
│   │       ├── wallet.tsx
│   │       └── reports.tsx
│   └── modals/
│       ├── sos.tsx
│       ├── report-road.tsx
│       ├── report-gas.tsx
│       ├── rate.tsx
│       ├── payment-select.tsx
│       └── ekyash-pay.tsx
│
├── src/
│   ├── components/               # Shared UI components
│   │   ├── ui/                   # Base components (Button, Card, Input, etc.)
│   │   ├── cards/                # Feed card components
│   │   │   ├── RouteOfferCard.tsx
│   │   │   ├── RouteRequestCard.tsx
│   │   │   ├── ErrandCard.tsx
│   │   │   ├── JobCard.tsx
│   │   │   └── RoadReportCard.tsx
│   │   ├── map/                  # Map-related components
│   │   │   ├── KanekMap.tsx
│   │   │   ├── MapControls.tsx
│   │   │   ├── PostPin.tsx
│   │   │   └── RouteOverlay.tsx
│   │   ├── icons/                # SVG icon components (react-native-svg)
│   │   │   ├── index.ts          # Icon registry + <Icon name="..." /> wrapper
│   │   │   ├── Compass.tsx
│   │   │   ├── PlusCircle.tsx
│   │   │   ├── ClipboardList.tsx
│   │   │   ├── User.tsx
│   │   │   ├── Star.tsx
│   │   │   ├── Clock.tsx
│   │   │   ├── MapPin.tsx
│   │   │   ├── Package.tsx
│   │   │   ├── AlertTriangle.tsx
│   │   │   ├── ShieldAlert.tsx
│   │   │   ├── Receipt.tsx
│   │   │   ├── QrCode.tsx
│   │   │   ├── Fuel.tsx
│   │   │   ├── Construction.tsx
│   │   │   ├── CircleDot.tsx
│   │   │   ├── Navigation.tsx
│   │   │   ├── Search.tsx
│   │   │   ├── Filter.tsx
│   │   │   └── Phone.tsx
│   │   ├── forms/                # Post creation forms
│   │   ├── profile/              # Profile-related components
│   │   └── payment/              # E-Kyash / payment components
│   │
│   ├── store/                    # Redux Toolkit
│   │   ├── index.ts              # Store config
│   │   ├── slices/
│   │   │   ├── authSlice.ts
│   │   │   ├── postsSlice.ts
│   │   │   ├── bookingsSlice.ts
│   │   │   ├── locationSlice.ts
│   │   │   ├── notificationsSlice.ts
│   │   │   └── reportsSlice.ts
│   │   └── api/                  # RTK Query API slices
│   │       ├── postsApi.ts
│   │       ├── bookingsApi.ts
│   │       ├── profileApi.ts
│   │       ├── reportsApi.ts
│   │       └── ekyashApi.ts
│   │
│   ├── lib/                      # Core utilities
│   │   ├── supabase.ts           # Supabase client init
│   │   ├── mapbox.ts             # Mapbox config
│   │   ├── constants.ts          # App constants
│   │   └── helpers.ts            # Pure utility functions
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useLocation.ts
│   │   ├── useRealtime.ts
│   │   └── useSOS.ts
│   │
│   ├── theme/                    # Design tokens
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   └── index.ts
│   │
│   └── types/                    # TypeScript types
│       ├── database.ts           # Generated from Supabase
│       ├── navigation.ts
│       └── ekyash.ts
│
├── supabase/
│   ├── config.toml               # Supabase project config
│   ├── migrations/               # SQL migrations (ordered)
│   │   ├── 00001_profiles.sql
│   │   ├── 00002_posts.sql
│   │   ├── 00003_bookings_contracts.sql
│   │   ├── 00004_ratings_strikes.sql
│   │   ├── 00005_reports.sql
│   │   ├── 00006_ekyash.sql
│   │   ├── 00007_notifications.sql
│   │   ├── 00008_email_receipts.sql
│   │   └── 00009_rls_policies.sql
│   ├── functions/                # Edge Functions (Deno)
│   │   ├── ekyash-authorize/
│   │   ├── ekyash-create-invoice/
│   │   ├── ekyash-callback/
│   │   ├── ekyash-cancel-invoice/
│   │   ├── ekyash-refund/
│   │   ├── ekyash-invoice-info/
│   │   ├── send-email-receipt/
│   │   │   ├── index.ts
│   │   │   └── template.html    # Receipt email HTML template
│   │   ├── send-sms-sos/
│   │   ├── check-route-activation/
│   │   ├── expire-posts/
│   │   ├── process-strikes/
│   │   └── update-rating-avg/
│   └── seed.sql                  # Test data
│
├── assets/                       # Fonts, images, icons
│   ├── fonts/
│   │   ├── WorkSans-Bold.ttf
│   │   ├── WorkSans-Medium.ttf
│   │   ├── Manrope-Regular.ttf
│   │   └── Manrope-Bold.ttf
│   └── images/
│
├── admin/                            # Admin panel (Next.js, deploys to kanek.bz)
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Dashboard — pending reviews, flags, stats
│   │   ├── drivers/
│   │   │   ├── page.tsx              # Driver verification queue
│   │   │   └── [id]/page.tsx         # Review driver docs (approve/reject)
│   │   ├── riders/
│   │   │   ├── page.tsx              # Rider ID verification queue
│   │   │   └── [id]/page.tsx         # Review rider doc
│   │   ├── users/
│   │   │   ├── page.tsx              # All users list + search
│   │   │   └── [id]/page.tsx         # User detail (strikes, ratings, suspend)
│   │   ├── posts/
│   │   │   └── page.tsx              # All posts + flagged posts
│   │   ├── flags/
│   │   │   ├── page.tsx              # Flag queue (pending reports)
│   │   │   └── [id]/page.tsx         # Review flag + take action
│   │   ├── transactions/
│   │   │   └── page.tsx              # E-Kyash transaction log
│   │   └── settings/
│   │       └── page.tsx              # Admin settings
│   ├── components/
│   ├── lib/
│   │   └── supabase.ts              # Supabase client (service_role key)
│   └── .env.local                    # Admin-specific env vars
│
├── kanek.md                      # Original vision doc (reference)
├── PLAN.md                       # This file
├── ekyash                        # E-Kyash API reference
├── app.json                      # Expo config
├── tsconfig.json
├── package.json
├── .env.local                    # Local env vars (gitignored)
└── .gitignore
```

---

## 10. Environment Variables

```env
# .env.local (gitignored)
EXPO_PUBLIC_SUPABASE_URL=https://tlggdherqjvybpddsqjj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_mYwOKcMxHDBG0p19j-8YpQ_-KvipSDe
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoid2lja2VkYXdlc29uZSIsImEiOiJjbW44NXRybjQwODgwMnFwempmd2JucjFsIn0.LI4AfDvnVT66zhieVed_eQ

# Supabase Edge Function secrets (set via supabase secrets set)
EKYASH_API_URL=<provided-by-bank>
EKYASH_SID=<provided-by-bank>
EKYASH_PIN_HASH=<provided-by-bank>
EKYASH_API_KEY=<provided-by-bank>
EKYASH_CALLBACK_URL=<your-edge-function-url>/ekyash-callback

# Email receipts (Resend)
RESEND_API_KEY=<your-resend-api-key>
RESEND_FROM_EMAIL=receipts@kanek.bz
```

---

## 11. Build Order

| Phase | What | Depends On |
|---|---|---|
| **0** | Project scaffold, Supabase schema, design system, auth flow, offline map downloads | Nothing |
| **1** | Explore feed + Post creation (routes) + input validation (+501, email) | Phase 0 |
| **2** | Post detail + Booking flow + Contracts | Phase 1 |
| **3** | Realtime tracking (driver location during active trip) | Phase 2 |
| **4** | Ratings + Strikes + Trust profiles | Phase 3 |
| **5** | Admin panel (kanek.bz) -- doc review, moderation, flags, user management | Phase 0 |
| **6** | Road reports + Gas prices | Phase 1 |
| **7** | Errands + Packages (post types) | Phase 2 |
| **8** | Job postings | Phase 2 |
| **9** | E-Kyash payment integration + silent 1% donation | Phase 2 + sandbox credentials |
| **10** | SOS system | Phase 3 |
| **11** | Push notifications | Phase 2 |
| **12** | Email receipts | Phase 9 |
| **13** | Driver selfie check-in | Phase 3 |

Phase 0-5 = MVP. Community board + admin panel for you to manage everything.

Phases 6-13 = Progressive enhancement after real users are testing.

---

## 12. Admin Panel (kanek.bz)

Next.js web app deployed to kanek.bz. You are the sole admin for now. This is where you review driver docs, handle flags, and manage users.

**Stack:** Next.js 14+ (App Router) + Tailwind CSS + Supabase (service_role key, server-side only)

**Auth:** Same Supabase Phone OTP. After login, checks `profiles.role = 'admin'`. Non-admins get rejected.

### Dashboard (`/`)
- Pending driver verifications count
- Pending rider ID verifications count
- Open flags count
- Active posts / Active users (today)
- Recent admin actions log

### Driver Verification (`/drivers`)
- Queue of `driver_details` where `review_status = 'pending'`
- Click into a driver: see license photo, insurance photo, ID photo, vehicle info
- Approve or reject with reason
- Approval sets `verified = true`, `review_status = 'approved'`, `verified_by = admin.id`
- Rejection notifies user via push + in-app notification with reason

### Rider ID Review (`/riders`)
- Queue of `rider_documents` where `review_status = 'pending'`
- View uploaded ID photo, approve or reject

### User Management (`/users`)
- Searchable list of all profiles
- View user detail: rating, punctuality, strikes, bookings, posts
- Actions: issue strike (soft/hard), suspend, unsuspend, upgrade to driver role

### Flag Queue (`/flags`)
- All flags where `status = 'pending'`
- View flagged entity (post or user)
- Actions: dismiss flag, remove post, issue strike, suspend user
- Every action logged to `admin_actions` table

### Transaction Log (`/transactions`)
- Read-only view of `ekyash_transactions`
- Filter by status, date, user
- Total donation amount running counter

### Admin Env Vars
```env
# admin/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://tlggdherqjvybpddsqjj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

The `SUPABASE_SERVICE_ROLE_KEY` is NEVER exposed to the browser. Used only in Next.js API routes and server components.

---

## 13. Key Principles

1. **The feed is the app.** If the community board is dead, the app is dead. Every feature should make the feed more alive.
2. **Cash is always the answer.** E-Kyash is optional. No payment system failure should ever block a trip.
3. **Phone number IS identity.** It's the auth key AND the E-Kyash wallet ID. One number, one person.
4. **Contracts over trust.** Every agreed transaction creates a timestamped record. Disputes resolve against the contract.
5. **Degrade gracefully.** Bad internet? Show stale data with a timestamp. No drivers? Suggest alternatives. Payment fails? Fall back to cash.
6. **The 1% is silent.** Every digital payment quietly donates 1% to the Mental Health Association of Belize. No marketing, no badge, no fanfare. Just do it.
7. **Offline is not a luxury.** Belize has spotty coverage outside towns. Downloadable maps and local caching are day-one features, not Phase 11 afterthoughts.
8. **Validate everything at the edge.** Phone must be +501 + 7 digits. Email must be valid if provided. No garbage in, no garbage out.

---

## 14. Design Reference

All UI/UX decisions align with the AllTrails Trailblazer design system, adapted for kanek.

**Figma Source:**
- AllTrails Trailblazer Design System: https://www.figma.com/community/file/1138263498498980090
- Pages referenced: Color, Typography, Button, Card, Navigation, Map Controls

**How to use:**
- Open the Figma file as a reference when building any component
- Match card layout proportions, map control placement, search bar style
- Adapt color tokens (AllTrails greens mapped to kanek forest-* tokens above)
- Match typography scale (Work Sans headings, Manrope body — same as AllTrails)
- Navigation pattern: bottom tab bar with outlined SVG icons, same spacing
- Cards: image/map preview + metadata rows, same hierarchy

**kanek-specific deviations from AllTrails:**
- Trail difficulty badges replaced with post type badges (route/errand/job/report)
- Trail stats (elevation, distance) replaced with ride stats (seats, price, punctuality)
- "Recorded" concept replaced with contracts + ratings
- AllTrails' trail detail map replaced with Mapbox route overlay
- Payment UI (E-Kyash QR, cash toggle) has no AllTrails equivalent — custom design

---

*kanek -- Built for Belize -- Cash-First -- Community-First -- Belize-First*
