<p align="center">
  <img src="https://img.shields.io/badge/kanek-Community%20Mobility%20Board-142800?style=for-the-badge&labelColor=142800" alt="kanek" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Web-51c152?style=flat-square&logo=expo&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/Expo-SDK%2055-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo SDK 55" />
  <img src="https://img.shields.io/badge/React%20Native-0.83.4-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React Native" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-backend-3FCF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Mapbox-maps-4264FB?style=flat-square&logo=mapbox&logoColor=white" alt="Mapbox" />
  <img src="https://img.shields.io/badge/license-private-8b9182?style=flat-square" alt="License" />
</p>

---

A community mobility board for Belize. People post rides, routes, errands, package deliveries, and jobs. Others browse, respond, and connect. Think AllTrails for community transport -- a living feed of people helping people move.

kanek is not a dispatch system. It is not Uber. It is a board where Belizeans organise shared mobility the way they already do, backed by trust profiles, contracts, and local payment rails.

---

## Stack

| Layer | Technology | Version |
|---|---|---|
| Mobile | React Native + Expo | SDK 55 / RN 0.83.4 / React 19.2.0 |
| Navigation | Expo Router (file-based) | ~55.0.8 |
| Language | TypeScript (strict) | ~5.9.2 |
| State | Redux Toolkit + RTK Query | ^2.6.1 |
| Backend | Supabase (Auth, Postgres 17, Storage, Realtime, Edge Functions) | ^2.49.4 |
| Auth | Supabase Phone OTP + hCaptcha | |
| Maps | Mapbox GL (@rnmapbox/maps + mapbox-gl web) | ^10.3.0 / ^3.20.0 |
| Payments | Cash (default) + E-Kyash (digital, BZD) | |
| Push | Expo Notifications + FCM/APNs | |
| Email | Supabase Edge Functions + Resend | |
| Admin | Next.js (App Router, Tailwind CSS 4, Supabase SSR) | 15.2.4 |
| Edge Functions | Deno (Supabase) | |
| Node | v22 LTS | |

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
│   ├── hooks/                    # useAuth, useRealtime, useSOS, useDriverTracking
│   ├── lib/                      # Supabase client, Mapbox config, helpers, constants
│   ├── store/                    # Redux store
│   │   ├── api/                  # RTK Query API slices (11 slices)
│   │   └── slices/               # Redux slices (auth, location, notifications, toast)
│   ├── theme/                    # Design tokens (colors, typography, spacing)
│   └── types/                    # TypeScript types (database.ts, ekyash.ts)
├── supabase/
│   ├── migrations/               # 50 SQL migration files
│   ├── functions/                # 14 Deno edge functions
│   └── templates/                # Email templates
├── docs/                         # Project documentation
└── assets/                       # Fonts (Work Sans, Manrope), icons, splash
```

## Features

- **Route offers and requests** -- drivers post available routes, riders post where they need to go
- **Package delivery** -- send parcels between towns with community carriers
- **Errand board** -- request someone to run errands (groceries, pharmacy, bills)
- **Job posts** -- skilled trades, cleaning, tutoring, handyman work
- **Community road reports** -- accidents, checkpoints, flooding, construction
- **Gas price tracking** -- crowd-sourced fuel prices by station
- **Trust profiles** -- ratings, punctuality scores, verified ID, strike system
- **Contracts and bookings** -- structured agreements between parties
- **E-Kyash payments** -- digital payment integration for Belize (3% platform fee)
- **Real-time map** -- Mapbox-powered view of active routes and reports
- **Live tracking** -- driver location broadcast during active trips
- **In-app messaging** -- real-time chat between contract parties
- **Phone OTP auth** -- no passwords, phone number is the identity
- **Push notifications** -- booking updates, SOS alerts, reminders
- **SOS system** -- emergency SMS with GPS to saved contact
- **Driver check-in** -- selfie verification before trip start

## Post Types

| Type | Description |
|---|---|
| `route_offer` | Driver offering a route with available seats |
| `route_request` | Rider looking for a ride along a route |
| `package` | Package that needs delivery between locations |
| `errand` | Task that needs someone to run it (grocery, pharmacy, bills, etc.) |
| `job` | Short-term work opportunity (skilled trade, cleaning, tutoring, etc.) |

## Design System

Adapted from the AllTrails Trailblazer design system. Forest greens reflect Belize (jungle, nature, community).

| Token | Value | Usage |
|---|---|---|
| `forest-900` | `#142800` | Primary text, headers |
| `forest-600` | `#274312` | Buttons, active states |
| `forest-400` | `#656e5e` | Icons inactive, subtle text |
| `accent-green` | `#51c152` | Success, CTA, active tab |
| `neon-green` | `#65f67b` | Highlights, badges |
| `accent-blue` | `#4967f6` | Links, info |
| `neutral-50` | `#f6f6f4` | Backgrounds |
| `neutral-100` | `#efefec` | Card backgrounds |
| `neutral-200` | `#dbdad2` | Borders, dividers |
| `error` | `#d32f2f` | Errors, strikes, SOS |

Typography: **Work Sans** (headings, bold 700), **Manrope** (body, regular 400 / bold 700). All icons are custom SVG components via `react-native-svg` -- no emoji.

## Getting Started

### Prerequisites

- Node.js 22 LTS
- Expo CLI (`npm install -g expo-cli`)
- Supabase CLI (`npm install -g supabase`)
- Mapbox access token
- Supabase project credentials

### Setup

```bash
# Clone
git clone https://github.com/Wiickedawesome/kanek.git
cd kanek

# Install dependencies
npm install --legacy-peer-deps

# Environment variables
cp .env.local.example .env.local
# Fill in:
#   EXPO_PUBLIC_SUPABASE_URL
#   EXPO_PUBLIC_SUPABASE_ANON_KEY
#   EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
#   EXPO_PUBLIC_HCAPTCHA_SITE_KEY

# Link and push database
supabase link --project-ref tlggdherqjvybpddsqjj
supabase db push

# Deploy edge functions
supabase functions deploy

# Start development server
npm start
```

### Running

```bash
npm start            # Expo dev server (press 'w' for web)
npm run web          # Web directly (localhost:8081)
npm run ios          # iOS simulator
npm run android      # Android emulator
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
```

## Database

33 migration files define the schema across 20+ tables with Row Level Security.

### Core Tables

| Table | Purpose |
|---|---|
| `profiles` | Users (phone, name, role, rating, strikes, emergency contact) |
| `posts` | All post types (routes, errands, packages, jobs) |
| `bookings` | User bookings on posts |
| `contracts` | Agreements between driver + rider |
| `ratings` | Post-trip reviews (1-5 stars + punctuality) |
| `strikes` | Soft (late cancel) and hard (no-show) penalties |

### Community Tables

| Table | Purpose |
|---|---|
| `road_reports` | Accidents, checkpoints, flooding, construction |
| `gas_prices` | Crowd-sourced fuel prices by station |
| `flags` | Community moderation flags on posts/users |
| `admin_actions` | Immutable admin audit trail |

### Payment & Communication Tables

| Table | Purpose |
|---|---|
| `ekyash_transactions` | E-Kyash payment records |
| `donation_totals` | Running community donation total |
| `notifications` | Push notification records |
| `push_tokens` | Expo push tokens |
| `contract_messages` | Real-time chat between contract parties |
| `email_receipts` | Email receipt log |

### Verification Tables

| Table | Purpose |
|---|---|
| `driver_details` | License, insurance, vehicle info (admin-reviewed) |
| `rider_documents` | Government ID uploads (admin-reviewed) |
| `driver_checkins` | Selfie check-ins with GPS |
| `waitlist` | Post waitlist entries |

See [docs/database-schema.md](docs/database-schema.md) for complete column definitions, types, and constraints.

## Edge Functions

13 Deno edge functions in `supabase/functions/`:

| Function | Purpose |
|---|---|
| `ekyash-authorize` | Get E-Kyash session token |
| `ekyash-create-invoice` | Create payment invoice (3% fee + optional donation) |
| `ekyash-invoice-info` | Query invoice status |
| `ekyash-callback` | Webhook: receive payment status from E-Kyash |
| `ekyash-cancel-invoice` | Cancel pending invoice |
| `ekyash-refund` | Issue refund |
| `send-push` | Push notification via Expo Push API |
| `send-email-receipt` | Email receipt via Resend |
| `send-sms-sos` | SOS SMS with GPS location |
| `expire-posts` | Cron: expire old posts/reports |
| `process-strikes` | Cron: enforce strike penalties (3 soft = restricted, 2 hard = suspended) |
| `check-route-activation` | Check if route can activate |
| `update-rating-avg` | Trigger: recalculate rating after new review |

See [docs/edge-functions.md](docs/edge-functions.md) for detailed inputs, outputs, and logic.

## State Management

Redux Toolkit with 9 RTK Query API slices (all using `fakeBaseQuery` with Supabase client) and 4 sync state slices.

| API Slice | Manages |
|---|---|
| `postsApi` | Posts CRUD, search, filtering |
| `bookingsApi` | Bookings, contracts |
| `profilesApi` | User profiles, driver details |
| `ratingsApi` | Trip ratings |
| `ekyashApi` | Payment operations |
| `reportsApi` | Road reports, gas prices |
| `notificationsApi` | Notification list |
| `checkinsApi` | Driver selfie check-ins |
| `messagesApi` | Contract messaging (realtime) |

See [docs/state-management.md](docs/state-management.md) for complete API and slice details.

## Administration

Admin operations (driver verification, moderation, user management, transaction review) are performed via **Supabase Studio** using SQL views and functions. See [docs/admin-studio-workflow.md](docs/admin-studio-workflow.md) for the complete workflow.

## Documentation

Complete project documentation lives in the [`docs/`](docs/) folder:

| Document | Description |
|---|---|
| [Architecture](docs/architecture.md) | System diagram, tech stack, data flow |
| [Database Schema](docs/database-schema.md) | All tables, columns, enums, migrations |
| [Edge Functions](docs/edge-functions.md) | All 13 functions with inputs/outputs |
| [Navigation](docs/navigation.md) | Screen tree, tab isolation rules |
| [State Management](docs/state-management.md) | Redux store, API slices, hooks |
| [Design System](docs/design-system.md) | Colors, typography, icons, components |
| [Environment Setup](docs/environment-setup.md) | Env vars, dev setup, troubleshooting |
| [Admin Workflow](docs/admin-studio-workflow.md) | Supabase Studio admin operations |
| [Payments](docs/payments.md) | E-Kyash integration flow |

## App Configuration

| Setting | Value |
|---|---|
| Bundle ID | `bz.kanek.app` (iOS + Android) |
| URL scheme | `kanek://` |
| Orientation | Portrait only |
| Splash | `#142800` (forest-900) |
| Supabase project | `tlggdherqjvybpddsqjj` |

---

<p align="center">
  <sub>Built for Belize.</sub>
</p>
