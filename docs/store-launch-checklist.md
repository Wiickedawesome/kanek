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
- [x] Separate direct device installs from TestFlight / Play Internal builds in `eas.json`
- [x] Create Privacy Policy screen (`app/(tabs)/profile/privacy.tsx`)
- [x] Create Terms of Service screen (`app/(tabs)/profile/terms.tsx`)
- [x] Create shared `LegalScreen` component (`src/components/LegalScreen.tsx`)
- [x] Create legal content (`src/lib/legalContent.ts`)
- [x] Add Privacy Policy and Terms links to Profile menu
- [x] Make version string dynamic in Profile screen using `expo-constants`
- [x] Add `google-services.json` and `play-store-service-account.json` to `.gitignore`
- [x] Web platform guard for push notifications (`useNotifications.ts`)
- [x] Register Android Firebase app `bz.kanek.app` in project `kanek-bz`
- [x] Download `google-services.json` into the project root for Android push/FCM
- [x] Add `android.googleServicesFile` to `app.json`
- [x] Add `.easignore` so remote EAS builds include `google-services.json` but still exclude `play-store-service-account.json`
- [x] Validate the Android EAS archive contains `google-services.json`
- [x] Finish Android production build after Firebase wiring (`96258325-53a0-429c-8146-a8870cefe455`)
- [x] Verify all 16 production Edge Functions are active in Supabase project `tlggdherqjvybpddsqjj`
- [x] Add `npm run launch:check` to surface non-Google launch blockers from the repo

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

- [x] **Google Play Console** — Developer account exists
- [ ] **Google Play approval** — Account is still pending approval before the first app deployment can complete
- [ ] **Create App** in Google Play Console:
  - App name: Kanek
  - Default language: English
  - App type: App
  - Category: Maps & Navigation
- [x] **Firebase project** — `kanek-bz` is in place and `bz.kanek.app` is registered
- [x] **Play Store service account** — Local JSON key is available and now matches `./play-store-service-account.json`
- [ ] **Android Publisher API** — Enable `androidpublisher.googleapis.com` for Google Cloud project `193141846291` after Play approval is complete
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

- [x] **Set `MAPBOX_DOWNLOAD_TOKEN`** in EAS production
- [x] **Host Privacy Policy** — `https://kanek.bz/privacy`
- [x] **Host Terms of Service** — `https://kanek.bz/terms`
- [ ] **Run `npm run launch:check`** until it reports no blocker-level items
- [x] **Verify current migrations** — remote database already matches local migrations `00001` through `00021`
- [ ] **Apply future migrations** — `supabase db push` still requires the remote Postgres password from CLI
- [ ] **Set production secrets** in Supabase dashboard:
  - Launch blocker now narrowed to runtime observability and email delivery, not deferred payments
  - Required for email auth and SOS delivery: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
  - Deferred for later E-Kyash rollout: `EKYASH_SID`, `EKYASH_PIN_HASH`, `EKYASH_API_KEY`, `EKYASH_API_URL`
  - Already present: `RESEND_FROM_EMAIL=support@belizechain.org`
- [ ] **Set `EXPO_PUBLIC_SENTRY_DSN`** in EAS production if runtime Sentry reporting should be enabled (the current `SENTRY_AUTH_TOKEN` received `403` from the Sentry keys API, so fetch the DSN from Sentry UI or a broader-scope token)
- [ ] **Enable hCaptcha** in Supabase Auth settings for production if bot protection is required at launch
- [ ] **Verify RLS policies** are active on all tables
- [ ] **Create a dedicated public-store EAS profile before launch** — the current `eas.json` intentionally keeps only `deviceTest` and `storeTest` so test builds cannot be confused with a real store release
- [ ] **Test on real devices**:
  - Push notifications
  - Location permissions & map rendering
  - Camera / photo picker (ID upload)
  - Deep links (`kanek://`)
  - SOS feature
  - E-Kyash flow later, when `ENABLE_EKYASH` is turned back on
- [ ] **Android Play submission automation** — Add a dedicated public-store profile if you want `eas submit` automation for a real production rollout
- [ ] **Retry Android submit** — Last attempt reached EAS submission `252dcd31-4164-450f-9596-df92812d0030` and failed because the Android Publisher API is disabled / inaccessible while Google approval is still pending
- [ ] **Submit the real launch build** — after adding the dedicated public-store profile, submit that profile explicitly instead of reusing `storeTest`

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
• Track and report local gas prices
• Find and post local transport jobs
• Emergency SOS with GPS location sharing

**Key Features:**
• Live feed of rides, routes, errands, and jobs across Belize
• Real-time map with Mapbox navigation
• Cash and E-Kyash digital payments
• Community trust system with ratings and verification
• Fuel price tracking across Belize districts
• Offline map support for rural areas
• SOS emergency feature

**Built for Belize. Powered by community.**

Kanek operates in Belizean Dollars (BZD) and is designed for the unique transportation needs of Belize — from the Corozal border to Punta Gorda, from San Ignacio to Belize City.

