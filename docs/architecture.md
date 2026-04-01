# Architecture

Kanek is a community mobility board for Belize. The system is split into three layers:

1. **Mobile App** (React Native + Expo) — user-facing feed, posting, booking, payments, tracking
2. **Backend** (Supabase) — PostgreSQL, Auth, Edge Functions, Realtime, Storage
3. **Admin Panel** (Next.js) — driver/rider verification, moderation, transaction review

---

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   Mobile App (Expo)                      │
│  React Native 0.83.2 · Expo SDK 55 · TypeScript 5.9     │
│  Redux Toolkit · RTK Query · Mapbox GL · Expo Router     │
└──────────────────┬──────────────────────────────────────┘
                   │ Supabase JS Client (fakeBaseQuery)
                   ▼
┌─────────────────────────────────────────────────────────┐
│                  Supabase Backend                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Postgres │ │   Auth   │ │ Storage  │ │ Realtime │   │
│  │ 17 + RLS │ │ Phone OTP│ │ Buckets  │ │ Channels │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │           13 Deno Edge Functions                  │   │
│  │  E-Kyash (6) · Push · Email · SMS · Cron (2)     │   │
│  │  Route Activation · Rating Trigger                │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────┐    ┌─────────────────┐
│   E-Kyash    │    │  Admin Panel    │
│   Payment    │    │  Next.js 15.2   │
│   Gateway    │    │  Tailwind CSS 4 │
└──────────────┘    └─────────────────┘
```

---

## Tech Stack Details

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Mobile | React Native | 0.83.2 | Cross-platform UI |
| Mobile | Expo | SDK 55 (~55.0.9) | Build toolchain, native modules |
| Navigation | Expo Router | ~55.0.8 | File-based routing |
| Language | TypeScript | ~5.9.2 | Type safety (strict mode) |
| State | Redux Toolkit | ^2.6.1 | Global state + API caching |
| State | RTK Query | (bundled with RTK) | Data fetching via fakeBaseQuery |
| Backend | Supabase JS | ^2.49.4 | Client SDK |
| Auth | Supabase Phone OTP | — | Phone number identity |
| Auth | hCaptcha | ^2.0.2 | Bot protection on OTP |
| Maps | @rnmapbox/maps | ^10.3.0 | Native map (iOS/Android) |
| Maps | mapbox-gl | ^3.20.0 | Web map |
| Payments | E-Kyash | — | Belizean digital payments (BZD) |
| Push | Expo Notifications | ~55.0.14 | FCM/APNs push |
| Email | Resend | — | Transaction receipts |
| Admin | Next.js | 15.2.4 | Admin dashboard |
| Admin | Tailwind CSS | 4.1.3 | Styling |
| Admin | Supabase SSR | 0.5.2 | Server-side auth |
| Edge Functions | Deno | — | Serverless functions |
| Node | Node.js | v22 LTS | Runtime |

---

## Key Dependencies (Mobile)

| Package | Version | Purpose |
|---------|---------|---------|
| `expo-location` | ~55.1.4 | GPS positioning |
| `expo-image-picker` | ~55.0.14 | Camera / photo library |
| `expo-secure-store` | ~55.0.9 | Encrypted key-value storage |
| `expo-file-system` | ~55.0.12 | File operations |
| `expo-font` | ~55.0.4 | Custom font loading |
| `expo-splash-screen` | ~55.0.13 | Splash screen control |
| `react-native-svg` | ^15.15.3 | SVG icon rendering |
| `react-native-reanimated` | ^4.2.1 | Animations |
| `react-native-gesture-handler` | ~2.30.0 | Gesture recognition |
| `react-native-screens` | ~4.23.0 | Native screen containers |
| `@react-native-async-storage/async-storage` | 2.2.0 | Persistent key-value |
| `@react-native-community/netinfo` | 11.5.2 | Network status detection |

---

## Data Flow

### Read Path
```
Screen Component
  → RTK Query hook (e.g. useGetPostsQuery)
    → queryFn calls supabase.from('posts').select(...)
      → Supabase Postgres (RLS applied)
        → Data returned, cached by RTK Query
```

### Write Path
```
Form submission
  → Validate at boundary (form-level)
    → RTK Query mutation (e.g. useCreatePostMutation)
      → mutationFn calls supabase.from('posts').insert(...)
        → Supabase Postgres (RLS applied)
          → Cache invalidated via tag system
```

### Payment Path
```
User selects E-Kyash
  → App calls ekyash-authorize Edge Function → session token
  → App calls ekyash-create-invoice → QR URL + payment link
  → User scans QR in E-Kyash app
  → E-Kyash calls ekyash-callback webhook → status updated in DB
  → App polls ekyash-invoice-info → confirmation
```

### Realtime Path
```
Supabase Realtime channel subscription
  → contract_messages table changes → messagesApi cache update
  → driver location broadcasts → locationSlice update → LiveTrackingMap re-render
```

---

## Storage Buckets

| Bucket | Purpose | Access |
|--------|---------|--------|
| `id-documents` | Government ID photos | Private (user + admin) |
| `driver-documents` | License, insurance photos | Private (user + admin) |
| `rider-documents` | Rider verification docs | Private (user + admin) |
| `checkin-selfies` | Driver check-in selfies | Private (contract parties) |

---

## External Services

| Service | Purpose | Credentials |
|---------|---------|-------------|
| Supabase | Backend-as-a-Service | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Mapbox | Maps, geocoding, directions | `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` |
| hCaptcha | Bot protection | `EXPO_PUBLIC_HCAPTCHA_SITE_KEY` |
| E-Kyash | Digital payments (BZD) | `EKYASH_SID`, `EKYASH_PIN_HASH`, `EKYASH_API_KEY` |
| Resend | Email delivery | `RESEND_API_KEY` |
| Expo Push | Push notifications | Managed by Expo (no separate key) |
