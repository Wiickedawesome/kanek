# Environment Setup

---

## Prerequisites

- **Node.js** v22 LTS
- **npm** (bundled with Node)
- **Expo CLI**: `npm install -g expo-cli`
- **Supabase CLI**: `npm install -g supabase`
- **Mapbox account** with access token
- **Supabase project** (existing: `tlggdherqjvybpddsqjj`)

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
supabase link --project-ref tlggdherqjvybpddsqjj

# Push database migrations
supabase db push

# Deploy edge functions
supabase functions deploy

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

# Mapbox
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-token

# hCaptcha (from Supabase dashboard > Auth > Bot Protection)
EXPO_PUBLIC_HCAPTCHA_SITE_KEY=your-hcaptcha-site-key
```

**Important:** Each variable must be on its own line with no trailing spaces. Missing newlines between variables will cause silent failures (learned the hard way).

### Admin Panel (`admin/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://tlggdherqjvybpddsqjj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Edge Function Secrets

Set in Supabase dashboard → Settings → Edge Functions → Secrets:

| Secret | Purpose |
|--------|---------|
| `EKYASH_SID` | E-Kyash merchant SID |
| `EKYASH_PIN_HASH` | E-Kyash hashed PIN |
| `EKYASH_API_KEY` | E-Kyash API key |
| `RESEND_API_KEY` | Resend email delivery API key |

---

## Development Commands

### Mobile App

```bash
npm start              # Expo dev server (press 'w' for web)
npm run web            # Web directly (localhost:8081)
npm run ios            # iOS simulator
npm run android        # Android emulator
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint
```

### Admin Panel

```bash
cd admin
npm install
npm run dev            # Next.js dev server (localhost:3001)
npm run build          # Production build
npm run typecheck      # tsc --noEmit
```

### Supabase

```bash
# Link project (one-time)
supabase link --project-ref tlggdherqjvybpddsqjj

# Apply migrations
supabase db push

# Deploy all edge functions
supabase functions deploy

# Deploy single function
supabase functions deploy ekyash-create-invoice

# Generate TypeScript types from DB
supabase gen types typescript --project-id tlggdherqjvybpddsqjj > src/types/database.ts

# Local development (optional)
supabase start         # Start local Supabase (Docker required)
supabase functions serve ekyash-create-invoice --env-file supabase/.env
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
- Phone OTP requires Supabase Auth > Phone Provider enabled

### TypeScript errors after migration changes
- Regenerate types: `supabase gen types typescript --project-id tlggdherqjvybpddsqjj > src/types/database.ts`
- Run `npm run typecheck` to verify
