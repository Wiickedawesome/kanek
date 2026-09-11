# Environment Setup

---

## Prerequisites

- **Node.js** v24 LTS
- **npm** (bundled with Node)
- **JDK** 17 or newer with `JAVA_HOME` set for local Android builds
- **Android Studio / Android SDK** with `adb` on `PATH` and `ANDROID_HOME` or `ANDROID_SDK_ROOT` set for local Android builds
- **macOS + Xcode** for local iOS builds (`npm run ios` cannot run from Linux)
- **Supabase CLI**: use `npx supabase ...` or install it locally with `npm i -D supabase`
- **Mapbox account** with access token
- **Supabase project** (existing: `tlggdherqjvybpddsqjj`)

Use the package-local Expo CLI via `npm start`, `npm run web`, or `npx expo ...`; a global `expo-cli` install is not required.
Global `npm install -g supabase` is no longer supported by the Supabase CLI.

---

## Quick Start

```bash
# Clone
git clone https://github.com/Wiickedawesome/kanek.git
cd kanek

# Install mobile app dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your credentials

# Link Supabase project
npx supabase link --project-ref tlggdherqjvybpddsqjj

# Push database migrations
npx supabase db push

# Deploy edge functions
npx supabase functions deploy

# Start development server
npm start
```

---

## Environment Variables

### Mobile App (`.env.local`)

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://tlggdherqjvybpddsqjj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_ENABLE_EMAIL_AUTH=true
EXPO_PUBLIC_ENABLE_GOOGLE_AUTH=false
EXPO_PUBLIC_ENABLE_APPLE_AUTH=false
ANDROID_FIRST_SUBMISSION_COMPLETE=false

# Mapbox
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-token

# hCaptcha (from Supabase dashboard > Auth > Bot Protection)
EXPO_PUBLIC_HCAPTCHA_SITE_KEY=your-hcaptcha-site-key

# Sentry (optional, from sentry.io > Project Settings > Client Keys)
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn

# Mapbox download token (required for EAS/native builds)
MAPBOX_DOWNLOAD_TOKEN=your-mapbox-download-token
```

**Important:** Each variable must be on its own line with no trailing spaces. Missing newlines between variables will cause silent failures (learned the hard way).

### Edge Function Secrets

Set in Supabase dashboard → Settings → Edge Functions → Secrets:

| Secret | Purpose |
|--------|---------|
| `EKYASH_SID` | E-Kyash merchant SID |
| `EKYASH_PIN_HASH` | E-Kyash hashed PIN |
| `EKYASH_API_KEY` | E-Kyash API key |
| `EKYASH_API_URL` | Optional E-Kyash API base URL override |
| `RESEND_API_KEY` | Required for account emails, SOS emails, and any receipt delivery |
| `RESEND_FROM_EMAIL` | Sender address, set to `support@belizechain.org` |
| `CRON_SECRET` | Bearer secret for automated `expire-posts` cron webhook trigger |

Hosted Supabase Edge Functions already provide `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; you do not need to add those manually in the dashboard.

### Social Auth Setup

Kanek now uses Supabase OAuth for Google and Apple sign-in. The buttons stay hidden until the matching public flag is set to `true`.

- Set `EXPO_PUBLIC_ENABLE_EMAIL_AUTH=false` when you need store builds to hide the email OTP flow and force testers onto social login only.

1. Add `kanek://auth/callback` to Supabase dashboard → Authentication → URL Configuration → Redirect URLs.
2. Google sign-in:
	- Enable Google in Supabase dashboard → Authentication → Providers.
	- Create a Google OAuth client in Google Cloud Console and paste the client ID / secret into the Supabase provider settings.
	- After the provider is configured, set `EXPO_PUBLIC_ENABLE_GOOGLE_AUTH=true` locally and in the EAS production environment.
3. Apple sign-in:
	- Enable Apple in Supabase dashboard → Authentication → Providers.
	- Create the Apple Service ID / secret in Apple Developer and paste them into the Supabase provider settings.
	- After the provider is configured, set `EXPO_PUBLIC_ENABLE_APPLE_AUTH=true` locally and in the EAS production environment.

If you skip these flags, the login screen falls back to email-only sign-in.

---

## Development Commands

### Mobile App

```bash
npm run mobile:check   # local Android/iOS preflight
npm start              # Expo dev server (press 'w' for web)
npm run web            # Web directly (localhost:8081)
npm run ios            # iOS simulator
npm run android        # Android emulator
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint
```

### Supabase

```bash
# Link project (one-time)
npx supabase link --project-ref tlggdherqjvybpddsqjj

# Apply migrations
npx supabase db push

# Deploy all edge functions
npx supabase functions deploy

# Deploy single function
npx supabase functions deploy ekyash-create-invoice

# Generate TypeScript types from DB
npx supabase gen types typescript --project-id tlggdherqjvybpddsqjj > src/types/database.ts

# Local development (optional)
npx supabase start         # Start local Supabase (Docker required)
npx supabase functions serve ekyash-create-invoice --env-file supabase/.env
```

---

## App Configuration (`app.json`)

| Setting | Value |
|---------|-------|
| Bundle ID | `bz.kanek.app` (iOS + Android) |
| URL scheme | `kanek://` |
| Orientation | Portrait only |
| Splash background | `#142800` (forest-900) |

### Native Permissions

**iOS (Info.plist):**
- `NSLocationWhenInUseUsageDescription` — location for routes/posts
- `NSLocationAlwaysAndWhenInUseUsageDescription` — location during active trips
- `NSCameraUsageDescription` — ID verification photos
- `NSPhotoLibraryUsageDescription` — ID verification uploads

**Android:**
- `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`
- `CAMERA`

### Expo Plugins

- `expo-router` — file-based routing
- `expo-font` — custom fonts
- `expo-secure-store` — encrypted storage
- `expo-location` — GPS with background permission
- `expo-image-picker` — camera/photo access
- `@rnmapbox/maps` — Mapbox native maps

---

## Validation Constants (`src/lib/constants.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `PHONE_REGEX` | `/^\+501[0-9]{7}$/` | Belize phone format |
| `BELIZE_BBOX` | lat 15.889–18.497, lng -89.225 to -87.485 | Coordinate validation |
| `MAX_UPLOAD_SIZE` | 5 MB | ID photo size limit |
| `MIN_IMAGE_WIDTH` | 640px | Minimum photo width |
| `MAX_SEATS` | 20 | Seat limit per post |
| `MAX_PRICE_CENTS` | 999,900 ($9,999 BZD) | Price limit |
| `MAX_DESCRIPTION_LENGTH` | 500 chars | Description limit |
| `MAX_NAME_LENGTH` | 50 chars | Name limit |
| `TOP_ROUTES_LIMIT` | 10 | Feed widget limit |
| `GAS_PRICES_LIMIT` | 5 | Gas feed limit |

---

## Troubleshooting

### Environment variables not loading
- Verify each variable is on its own line in `.env.local`
- Restart Expo dev server after changing `.env.local`
- Only `EXPO_PUBLIC_*` variables are available in client code

### Mapbox not rendering
- Verify `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` is set and valid
- Web uses `mapbox-gl`, native uses `@rnmapbox/maps` — different packages
- Check browser console for Mapbox errors

### Supabase auth failing
- Verify `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are correct
- Check hCaptcha site key matches Supabase dashboard setting
- Email OTP requires Resend credentials and `support@belizechain.org` configured; OAuth requires Google/Apple providers enabled in Supabase dashboard

### TypeScript errors after migration changes
- Regenerate types: `npx supabase gen types typescript --project-id tlggdherqjvybpddsqjj > src/types/database.ts`
- Run `npm run typecheck` to verify

### Android local build fails immediately
- Run `npm run mobile:check` first
- Install JDK 17+ and set `JAVA_HOME`
- Install Android Studio or command-line tools, then ensure `adb` is available and `ANDROID_HOME` or `ANDROID_SDK_ROOT` is set

### iOS command fails on Linux
- `npm run ios` only works on macOS with Xcode installed
- From Linux, use EAS Build for iOS artifacts and TestFlight/App Store delivery instead of local simulator builds

### Android EAS submit says the app has not been submitted yet
- Google Play requires the first `bz.kanek.app` release to be created manually in Play Console
- After that first manual release is accepted, set `ANDROID_FIRST_SUBMISSION_COMPLETE=true` locally so `npm run store:check` stops treating it as a blocker
