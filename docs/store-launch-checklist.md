# Kanek — Store Launch Checklist

> Track progress for Google Play Store and Apple App Store submission.

---

## Completed (Code Changes)

- [x] Bump version to `1.0.0` in `app.json` and `package.json`
- [x] Capitalize app name to "Kanek" in `app.json`
- [x] Capitalize all permission description strings ("Kanek needs…")
- [x] Add `expo-notifications` plugin to `app.json`
- [x] Remove unused `RECORD_AUDIO` permission from Android config
- [x] Replace hardcoded Mapbox `sk.placeholder` with env var `${MAPBOX_DOWNLOAD_TOKEN}`
- [x] Configure `eas.json` submit profiles for iOS (ASC) and Android (Play Store)
- [x] Add `preview` build profile with `ios.simulator: false` for TestFlight
- [x] Create Privacy Policy screen (`app/(tabs)/profile/privacy.tsx`)
- [x] Create Terms of Service screen (`app/(tabs)/profile/terms.tsx`)
- [x] Create shared `LegalScreen` component (`src/components/LegalScreen.tsx`)
- [x] Create legal content (`src/lib/legalContent.ts`)
- [x] Add Privacy Policy and Terms links to Profile menu
- [x] Make version string dynamic in Profile screen using `expo-constants`
- [x] Add `google-services.json` and `play-store-service-account.json` to `.gitignore`
- [x] Web platform guard for push notifications (`useNotifications.ts`)

---

## Remaining — Manual Steps

### Apple App Store (iOS)

- [ ] **Apple Developer Program** — Enroll at https://developer.apple.com/programs/ ($99/year) if not already
- [ ] **Create App Record** in App Store Connect:
  - App name: Kanek
  - Bundle ID: `bz.kanek.app`
  - Primary language: English
  - Category: Travel or Navigation
- [ ] **Update `eas.json`** — Replace `YOUR_APP_STORE_CONNECT_APP_ID` and `YOUR_APPLE_TEAM_ID` with real values
- [ ] **Run `eas credentials -p ios`** — Set up distribution certificate and provisioning profile
- [ ] **Upload APNs key** to EAS dashboard for push notifications
- [ ] **Screenshots** — Capture at least 3 screenshots for:
  - 6.7" display (iPhone 15 Pro Max / 16 Pro Max)
  - 6.1" display (iPhone 15 / 16)
- [ ] **App Store description** — Write short description and full description
- [ ] **Privacy Policy URL** — Host privacy policy at `https://kanek.bz/privacy`
- [ ] **Age Rating Questionnaire** — Complete in App Store Connect (note: SOS feature, payment processing)
- [ ] **Background Location justification** — Prepare explanation for App Review (driver live tracking during active trips)
- [ ] **Demo credentials** — Prepare a test phone number + OTP for App Review team

### Google Play Store (Android)

- [ ] **Google Play Console** — Create developer account ($25 one-time fee) if not already
- [ ] **Create App** in Google Play Console:
  - App name: Kanek
  - Default language: English
  - App type: App
  - Category: Maps & Navigation
- [ ] **Firebase project** — Create at https://console.firebase.google.com
  - Register `bz.kanek.app` as an Android app
  - Download `google-services.json` → place in project root
  - Add to `app.json`: `"android": { "googleServicesFile": "./google-services.json" }`
- [ ] **Play Store service account** — Create service account with Play Console access:
  - Download JSON key → save as `play-store-service-account.json` in project root
- [ ] **Data Safety form** — Complete in Play Console:
  - Location data: collected for routes/posts/live tracking
  - Personal info: name, phone, email
  - Photos: ID verification only
  - Financial info: E-Kyash transaction data
  - Data shared with: E-Kyash (payments), Mapbox (maps), Expo (push notifications)
- [ ] **Target audience** — Declare app is NOT for children under 13
- [ ] **Screenshots** — Capture at least 2 phone screenshots
- [ ] **Feature graphic** — Create 1024×500 PNG
- [ ] **Store listing** — Write short description (80 chars) and full description (4000 chars)
- [ ] **Privacy Policy URL** — Same hosted page as iOS

### Both Platforms

- [ ] **Set `MAPBOX_DOWNLOAD_TOKEN`** as EAS secret: `eas secret:create --name MAPBOX_DOWNLOAD_TOKEN --value <your-token>`
- [ ] **Host Privacy Policy** — Deploy privacy policy to `https://kanek.bz/privacy` (or similar public URL)
- [ ] **Host Terms of Service** — Deploy terms to `https://kanek.bz/terms`
- [ ] **Deploy edge functions** — `supabase functions deploy`
- [ ] **Apply all migrations** — `supabase db push`
- [ ] **Set production secrets** in Supabase dashboard:
  - `EKYASH_SID`, `EKYASH_PIN_HASH`, `EKYASH_API_KEY`, `EKYASH_API_URL`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL=support@belizechain.org`
- [ ] **Enable hCaptcha** in Supabase Auth settings for production
- [ ] **Verify RLS policies** are active on all tables
- [ ] **Build production binaries**:
  ```bash
  eas build --platform all --profile production
  ```
- [ ] **Test on real devices**:
  - Push notifications
  - Location permissions & map rendering
  - E-Kyash payment flow
  - Camera / photo picker (ID upload)
  - Deep links (`kanek://`)
  - SOS feature
- [ ] **Submit**:
  ```bash
  eas submit --platform all --profile production
  ```

---

## Store Listing Copy (Draft)

### Short Description (80 chars)
Community mobility board for Belize — rides, routes, errands, deliveries & jobs.

### Full Description (Draft)
Kanek is the community mobility board for Belize. Post and discover rides, routes, errands, package deliveries, and jobs — all in one living feed built by and for Belizeans.

**Not a dispatch app. Not Uber. Just your community, moving together.**

**For Riders:**
• Browse routes and rides offered by drivers across all six districts
• Book seats and track your driver in real-time
• Pay with cash or E-Kyash digital payments in BZD
• Rate drivers and build community trust

**For Drivers:**
• Post your route and fill empty seats
• Accept errand and delivery requests
• Set your own prices and schedule
• Build your reputation with ratings and on-time stats

**For Everyone:**
• Post errands and package deliveries for community help
• Report road conditions and gas prices
• Find and post local transport jobs
• Emergency SOS with GPS location sharing

**Key Features:**
• Live feed of rides, routes, errands, and jobs across Belize
• Real-time map with Mapbox navigation
• E-Kyash digital payments with 3% platform fee
• Community trust system with ratings and verification
• Road condition reports and gas price tracking
• Offline map support for rural areas
• SOS emergency feature

**Built for Belize. Powered by community.**

Kanek operates in Belizean Dollars (BZD) and is designed for the unique transportation needs of Belize — from the Corozal border to Punta Gorda, from San Ignacio to Belize City.

