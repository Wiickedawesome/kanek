# State Management

Redux Toolkit with RTK Query. Store configured in `src/store/index.ts`.

---

## Store Structure

```typescript
{
  // Sync state slices
  auth,              // Session, user, loading, onboarding status
  location,          // GPS position, driver tracking, active contract
  notifications,     // Notification items, unread count
  toast,             // Toast message display state

  // RTK Query API caches (9 slices)
  postsApi,
  bookingsApi,
  profilesApi,
  ratingsApi,
  ekyashApi,
  reportsApi,
  notificationsApi,
  checkinsApi,
  messagesApi,
}
```

---

## RTK Query Pattern

All API slices use `fakeBaseQuery()` — Supabase client calls, not HTTP endpoints.

```typescript
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { supabase } from '@/lib/supabase';

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
    createData: builder.mutation({
      queryFn: async (newItem) => {
        const { data, error } = await supabase.from('table').insert(newItem).select().single();
        if (error) return { error: { status: 'CUSTOM_ERROR', data: error.message } };
        return { data };
      },
      invalidatesTags: ['Tag'],
    }),
  }),
});
```

---

## State Slices

### authSlice (`src/store/slices/authSlice.ts`)

| Field | Type | Purpose |
|-------|------|---------|
| `session` | `Session \| null` | Supabase session |
| `user` | `User \| null` | Supabase user object |
| `isLoading` | `boolean` | Bootstrap flag |
| `onboardingComplete` | `boolean` | Onboarding status |

**Actions:** `setSession`, `setOnboardingComplete`, `setLoading`

### locationSlice (`src/store/slices/locationSlice.ts`)

| Field | Type | Purpose |
|-------|------|---------|
| `latitude` | `number \| null` | Current position |
| `longitude` | `number \| null` | |
| `isTracking` | `boolean` | Driver broadcasting location? |
| `activeContractId` | `string \| null` | Current active trip |
| `driverLocation` | `object \| null` | Latest driver broadcast (from realtime) |

**Actions:** `setLocation`, `setTracking`, `setActiveContractId`, `setDriverLocation`

### notificationsSlice (`src/store/slices/notificationsSlice.ts`)

| Field | Type | Purpose |
|-------|------|---------|
| `items` | `NotificationRow[]` | All notifications |
| `unreadCount` | `number` | Badge count |

**Actions:** `setNotifications`, `addNotification`, `markRead`, `markAllRead`, `clearNotifications`

### toastSlice (`src/store/slices/toastSlice.ts`)

| Field | Type | Purpose |
|-------|------|---------|
| `message` | `string \| null` | Toast text |
| `type` | `success \| error \| info \| warning` | Toast variant |
| `duration` | `number` | Display time (ms) |
| `visible` | `boolean` | Show/hide |

**Actions:** `showToast`, `hideToast`

---

## API Slices

### postsApi (`src/store/api/postsApi.ts`)

**Queries:**
- `getPosts({ type?, status?, limit?, offset?, search? })` → `PostWithAuthor[]`
- `getPostById(postId)` → `PostWithAuthor`

**Mutations:**
- `createPost(post)` — inserts new post
- `updatePost({ postId, updates })` — updates existing post
- `deletePost(postId)` — deletes post

**Tags:** `'Post'`

### bookingsApi (`src/store/api/bookingsApi.ts`)

**Queries:**
- `getBookings(userId, status?, limit?, offset?)` → `BookingWithUser[]`
- `getContracts(userId, status?, limit?, offset?)` → `ContractWithDetails[]`

**Mutations:**
- `createBooking(postId, userId, role, seatsBooked?, paymentMethod?)` — creates booking
- `cancelBooking(bookingId, reason?)` — cancels booking
- `markContractCompleted(contractId)` — marks contract done

**Tags:** `'Booking'`, `'Contract'`

### profilesApi (`src/store/api/profilesApi.ts`)

**Queries:**
- `getMyProfile(userId)` — current user's full profile
- `getPublicProfile(userId)` — other user's public profile
- `getDriverDetails(userId)` — driver documents + vehicle info

**Mutations:**
- `updateProfile(userId, updates)` — update profile fields
- `uploadDriverDocuments(userId, { license, insurance, idDoc, vehicleInfo })` — driver onboarding
- `uploadRiderDocument(userId, document)` — rider document upload

**Tags:** `'Profile'`, `'DriverDetails'`

### ratingsApi (`src/store/api/ratingsApi.ts`)

**Queries:**
- `getContractRatings(contractId)` — ratings for a contract

**Mutations:**
- `submitRating(contractId, { ratedId, stars, wasOnTime, comment })` — submit review

**Tags:** `'Rating'`

### ekyashApi (`src/store/api/ekyashApi.ts`)

**Mutations only:**
- `authorize()` — get E-Kyash session
- `createPayment(contractId, payerId, payeeId, amountCents, description, payerPhone)` — create invoice
- `checkPaymentStatus(orderId)` — poll status
- `cancelPayment(invoiceId)` — cancel invoice
- `refundPayment(transactionId, amount, pinHash, reason)` — refund

**Tags:** `'Payment'`

### reportsApi (`src/store/api/reportsApi.ts`)

**Queries:**
- `getRoadReports(lat, lng, radiusKm)` — nearby road reports
- `getGasPrices(lat, lng, radiusKm)` — nearby gas prices

**Mutations:**
- `createRoadReport(type, lat, lng, description)` — submit road report
- `createGasPrice(stationName, stationLat, stationLng, regular, premium, diesel)` — submit gas price
- `upvoteRoadReport(reportId)` — confirm report
- `markReportGone(reportId)` — mark report as cleared

**Tags:** `'Report'`, `'GasPrice'`

### notificationsApi (`src/store/api/notificationsApi.ts`)

**Queries:**
- `getNotifications(userId, limit, offset)` — paginated notifications

**Mutations:**
- `markNotificationRead(notificationId)` — mark single read
- `markAllNotificationsRead(userId)` — mark all read

**Tags:** `'Notification'`

### checkinsApi (`src/store/api/checkinsApi.ts`)

**Queries:**
- `getCheckinsForContract(contractId)` — checkins for a contract

**Mutations:**
- `submitDriverCheckin(contractId, driverId, selfieUrl, lat, lng)` — submit selfie checkin

**Tags:** `'Checkin'`

### messagesApi (`src/store/api/messagesApi.ts`)

**Queries:**
- `getContractMessages(contractId, limit, offset)` — paginated messages

**Mutations:**
- `sendContractMessage(contractId, senderId, body)` — send message

**Realtime:** Subscribed to `contract_messages` table for live updates.

**Tags:** `'Message'`

---

## Custom Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useAuth` | `src/hooks/useAuth.ts` | `signInWithPhone()`, `verifyOtp()`, sign out |
| `useLocation` | `src/hooks/useLocation.ts` | Get current position, start/stop tracking |
| `useNotifications` | `src/hooks/useNotifications.ts` | Listen for push notifications, register token |
| `useRealtime` | `src/hooks/useRealtime.ts` | Subscribe to Supabase realtime channels |
| `useSOS` | `src/hooks/useSOS.ts` | Trigger SOS, send GPS to emergency contact |
| `useDriverTracking` | `src/hooks/useDriverTracking.ts` | Broadcast driver location during active trip |
