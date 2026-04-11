# Navigation

Expo Router with file-based routing. Four bottom tabs plus auth flow and modals.

---

## Complete Screen Tree

```
Root (Stack) — app/_layout.tsx
│  Redux Provider wraps all screens
│
├── (auth) — Auth Layout (Stack)
│   ├── welcome.tsx              Splash screen
│   ├── phone-verify.tsx         Phone OTP entry + hCaptcha
│   ├── role-select.tsx          Choose rider/driver
│   ├── id-upload.tsx            Government ID photo upload
│   └── driver-docs.tsx          License, insurance, vehicle (drivers only)
│
├── (tabs) — Tab Layout (Bottom Tab Navigator)
│   │
│   ├── explore/ (Tab 1: Compass icon)
│   │   ├── _layout.tsx          Stack navigator
│   │   ├── index.tsx            Feed of posts + search + filters
│   │   ├── map.tsx              Full Mapbox map view
│   │   └── [postId].tsx         Post detail (thin wrapper → PostDetailScreen)
│   │
│   ├── post/ (Tab 2: PlusCircle icon)
│   │   ├── _layout.tsx          Stack navigator
│   │   ├── index.tsx            Choose post type
│   │   ├── route.tsx            Create route offer/request
│   │   ├── errand.tsx           Create errand
│   │   ├── package.tsx          Create package delivery
│   │   └── job.tsx              Create job posting
│   │
│   ├── activity/ (Tab 3: ClipboardList icon)
│   │   ├── _layout.tsx          Stack navigator
│   │   ├── index.tsx            My Posts + Active + History (segmented tabs)
│   │   ├── [contractId].tsx     Contract detail + live tracking
│   │   ├── notifications.tsx    Booking notifications
│   │   ├── messages/
│   │   │   └── [contractId].tsx Contract messaging thread
│   │   └── post/
│   │       └── [postId].tsx     Post detail (thin wrapper → PostDetailScreen)
│   │
│   └── profile/ (Tab 4: User icon)
│       ├── _layout.tsx          Stack navigator
│       ├── index.tsx            My profile view
│       ├── settings.tsx         Account settings
│       ├── documents.tsx        Manage verification documents
│       ├── wallet.tsx           E-Kyash wallet
│       ├── reports.tsx          My road reports
│       ├── notifications.tsx    Notification settings
│       ├── privacy.tsx          Privacy policy
│       └── terms.tsx            Terms of service
│
└── modals/ (Modal Presentation)
    ├── _layout.tsx              Modal group
    ├── sos.tsx                  SOS trigger
    ├── report-road.tsx          Road/traffic report
    ├── report-gas.tsx           Gas price report
    ├── rate.tsx                 Post-trip rating
    ├── payment-select.tsx       Cash vs E-Kyash choice
    ├── ekyash-pay.tsx           QR code + payment
    ├── flag-content.tsx         Report post/user
    ├── download-map.tsx         Offline map download
    ├── selfie-checkin.tsx       Driver selfie check-in
    ├── user-profile.tsx         View another user's profile
    └── report-detail.tsx        Road report detail
```

---

## Tab Bar Configuration

```
┌─────────┬──────────┬──────────┬─────────┐
│ Explore │   Post   │ Activity │ Profile │
│ Compass │PlusCircle│Clipboard │  User   │
└─────────┴──────────┴──────────┴─────────┘

Active color:   #51c152 (accent-green)
Inactive color: #656e5e (forest-400)
Height:         60px
Font:           Manrope-Regular, 11px
Background:     #ffffff
Border top:     #dbdad2
```

---

## Navigation Flow

```
First launch → Welcome → Phone Verify → Role Select → ID Upload → [Driver Docs] → Explore

Returning user → Explore (home)

During active trip → Activity tab shows live tracking
                   → SOS button visible as floating overlay
```

---

## Tab Isolation Rule

**This is the most important navigation rule in the app.**

Expo Router resolves routes to the tab that **owns** them. If you navigate to `/(tabs)/explore/[postId]` from the Activity tab, Expo Router will **switch to the Explore tab** — breaking back navigation.

### Solution: Shared Component Pattern

For screens that need to appear in multiple tabs:

1. Extract the screen logic into a shared component in `src/components/`
2. Create a thin wrapper file in each tab's directory
3. Pass a `backFallback` prop for proper back navigation

**Example:**

```
src/components/PostDetailScreen.tsx     ← Full screen logic (shared)
app/(tabs)/explore/[postId].tsx         ← <PostDetailScreen backFallback="/(tabs)/explore/" />
app/(tabs)/activity/post/[postId].tsx   ← <PostDetailScreen backFallback="/(tabs)/activity/" />
```

### Navigating to Post Detail

```typescript
// From Explore tab — navigates within Explore's stack
router.push(`/(tabs)/explore/${postId}`);

// From Activity tab — navigates within Activity's stack
router.push(`/(tabs)/activity/post/${postId}`);
```

### Back Navigation

Use `safeGoBack(fallback)` from `src/lib/helpers.ts`:

```typescript
import { safeGoBack } from '@/lib/helpers';

// Uses router.back() if history exists, otherwise navigates to fallback
safeGoBack('/(tabs)/activity/');
```

---

## Modal Navigation

Modals are presented over the current screen and don't affect tab state:

```typescript
router.push('/modals/sos');
router.push('/modals/rate');
router.push('/modals/ekyash-pay');
router.push('/modals/flag-content');
```

Modals dismiss by going back or calling `router.back()`.
