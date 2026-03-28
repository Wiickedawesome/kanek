<p align="center">
  <img src="https://img.shields.io/badge/kanek-Community%20Mobility%20Board-142800?style=for-the-badge&labelColor=142800" alt="kanek" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Web-51c152?style=flat-square&logo=expo&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/Expo-SDK%2055-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo SDK 55" />
  <img src="https://img.shields.io/badge/React%20Native-0.83-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React Native" />
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

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo SDK 55 |
| Navigation | Expo Router (file-based) |
| Language | TypeScript (strict mode) |
| State | Redux Toolkit + RTK Query |
| Backend | Supabase (Auth, Postgres, Storage, Realtime, Edge Functions) |
| Auth | Supabase Phone OTP |
| Maps | Mapbox GL |
| Payments | Cash (default) + E-Kyash (digital) |
| Push | Expo Notifications + FCM/APNs |
| Email | Supabase Edge Functions + Resend |
| Admin | Next.js (separate app in `admin/`) |

## Project Structure

```
kanek/
  app/                    # Expo Router screens
    (auth)/               # Onboarding flow (welcome, phone verify, role, ID upload)
    (tabs)/               # Main tab navigator
      explore/            # Feed + map view
      post/               # Create post forms (route, package, errand, job)
      activity/           # Bookings and trip history
      profile/            # User profile, settings, ratings
    modals/               # Modal screens
  src/
    components/
      cards/              # Post cards, booking cards
      forms/              # DateInput, TimeInput, LocationInput, PriceInput
      icons/              # Custom SVG icon components
      map/                # Map display, markers, route lines
      payment/            # E-Kyash payment flow
      profile/            # Avatar, trust badges, rating display
      ui/                 # Button, TextInput, Badge, BottomSheet
    hooks/                # useAuth, useLocation
    lib/                  # Supabase client, Mapbox config, helpers, constants
    store/
      api/                # RTK Query API slices (posts, profiles, bookings)
      slices/             # Redux slices (auth, location)
    theme/                # Colors, typography, spacing, border radius
    types/                # Database types, enums
  supabase/
    migrations/           # 9 migration files (profiles, posts, bookings, etc.)
    functions/            # Edge Functions (E-Kyash, push, email, moderation)
  admin/                  # Next.js admin panel
  assets/                 # Fonts, icons, splash screen
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
- **E-Kyash payments** -- digital payment integration for Belize
- **Real-time map** -- Mapbox-powered view of active routes and reports
- **Phone OTP auth** -- no passwords, phone number is the identity
- **Push notifications** -- booking updates, SOS alerts, reminders

## Post Types

| Type | Description |
|---|---|
| `route_offer` | Driver offering a route with available seats |
| `route_request` | Rider looking for a ride along a route |
| `package` | Package that needs delivery between locations |
| `errand` | Task that needs someone to run it |
| `job` | Short-term work opportunity |

## Design System

Adapted from the AllTrails Trailblazer design system. Forest greens reflect Belize (jungle, nature, community).

| Token | Value | Usage |
|---|---|---|
| `forest-900` | `#142800` | Primary text, headers |
| `forest-600` | `#274312` | Buttons, active states |
| `accent-green` | `#51c152` | Success, CTA, active |
| `neutral-50` | `#f6f6f4` | Backgrounds |
| `neutral-200` | `#dbdad2` | Borders, dividers |
| `error` | `#d32f2f` | Errors, strikes, SOS |

Typography: **Work Sans** (headings), **Manrope** (body text). All icons are custom SVG components -- no emoji.

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
# Fill in EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN

# Push database migrations
supabase link --project-ref <your-project-ref>
supabase db push

# Deploy edge functions
supabase functions deploy

# Start development server
npm start
```

### Running

```bash
npm run web       # Web (localhost:8081)
npm run ios       # iOS simulator
npm run android   # Android emulator
npm run typecheck # TypeScript validation
```

## Database

9 migration files define the schema:

| Migration | Tables / Objects |
|---|---|
| `00001_profiles` | User profiles, roles, trust scores |
| `00002_posts` | Posts (routes, errands, packages, jobs) |
| `00003_bookings_contracts` | Bookings, contracts between users |
| `00004_ratings_strikes` | Rating system, soft/hard strikes |
| `00005_reports` | Road reports, gas prices |
| `00006_ekyash` | E-Kyash payment transactions |
| `00007_notifications` | Push notification records |
| `00008_email_receipts` | Email receipt logs |
| `00009_rls_policies` | Row Level Security policies, driver/rider docs |

## Edge Functions

| Function | Purpose |
|---|---|
| `ekyash-create-invoice` | Create E-Kyash payment invoice |
| `ekyash-authorize` | Authorize E-Kyash payment |
| `ekyash-callback` | Handle E-Kyash payment callback |
| `ekyash-refund` | Process E-Kyash refund |
| `ekyash-cancel-invoice` | Cancel pending E-Kyash invoice |
| `ekyash-invoice-info` | Query E-Kyash invoice status |
| `check-route-activation` | Activate routes when min riders met |
| `expire-posts` | Expire old open posts |
| `process-strikes` | Enforce strike penalties |
| `send-push` | Send push notifications |
| `send-email-receipt` | Send transaction email receipts |
| `send-sms-sos` | Send SOS SMS alerts |
| `update-rating-avg` | Recalculate user rating averages |

## Admin Panel

The `admin/` directory contains a separate Next.js application for moderation and management:

- Driver verification (license, insurance, ID review)
- Post moderation and flagged content
- User management and strike administration
- Analytics dashboard

---

<p align="center">
  <sub>Built for Belize.</sub>
</p>
