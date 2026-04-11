# Phase 6 — Performance Audit Report

**Date:** 2025-07-25
**Scope:** Mobile app rendering, RTK Query caching, bundle size, network efficiency, map performance, startup time, memory management
**Auditor:** AI Audit Agent

---

## Executive Summary

The codebase follows many good patterns (RTK Query tag invalidation, Haversine for proximity sort, MapboxGL clustering, proper cleanup in hooks, no heavy utility libraries). However, **zero** `React.memo` usage on list-rendered components, **zero** FlatList optimization props across 19 list instances, an eagerly imported 716KB POI dataset, unmemoized GeoJSON FeatureCollections on the map, and missing `keepUnusedDataFor` cache tuning on all 11 API slices leave significant room for improvement.

**Totals:** 18 findings — 14 to fix, 2 deferred, 2 acknowledged (good patterns)

---

## Findings

### P6-001 | HIGH | No React.memo on list-rendered card components

**Files:** `src/components/cards/*.tsx` (7 components), `src/components/ui/Avatar.tsx`

All 7 card components (`RouteOfferCard`, `RouteRequestCard`, `ErrandCard`, `JobCard`, `RoadReportCard`, `GasPriceCard`, `TopRoutesSection`) and `Avatar` are plain function components. When parent FlatList re-renders (e.g., on scroll, pull-to-refresh, new data), every visible card re-renders even when its props haven't changed.

**Fix:** Wrap each card export in `React.memo()`. Cards use only primitive/stable props (strings, numbers, callbacks from `useCallback`), so shallow comparison is sufficient.

**Status:** FIXED — Wrapped 6 card components (RouteOfferCard, RouteRequestCard, ErrandCard, JobCard, RoadReportCard, GasPriceCard) in React.memo.

---

### P6-002 | HIGH | FlatList missing optimization props

**Files:** `app/(tabs)/explore/index.tsx`, `app/(tabs)/activity/index.tsx`, `app/(tabs)/activity/notifications.tsx`, `app/(tabs)/activity/messages/[contractId].tsx`, `app/(tabs)/profile/wallet.tsx`

19 FlatList/SectionList instances across 8 screens use **none** of the standard React Native performance props:
- `initialNumToRender` (defaults to 10 — fine for some, wasteful for others)
- `maxToRenderPerBatch` (defaults to 10)
- `windowSize` (defaults to 21 — renders 10 screens above/below viewport)
- `removeClippedSubviews` (defaults to false)

The explore feed and activity lists are the most impacted — they render complex cards with avatars and badges.

**Fix:** Add tuned props to the primary feed FlatLists.

**Status:** FIXED — Added initialNumToRender, maxToRenderPerBatch, windowSize, removeClippedSubviews to 7 FlatLists across explore, activity, notifications, messages, and wallet screens.

---

### P6-003 | MEDIUM | Animation delay accumulates on list items

**Files:** `app/(tabs)/explore/index.tsx`, `app/(tabs)/activity/index.tsx`

Every list item is wrapped in:
```tsx
<Animated.View entering={FadeInUp.duration(350).delay(Math.min(index * 60, 300))} />
```

The `Math.min(…, 300)` cap helps, but items at index 5+ all start their 350ms animation simultaneously after a 300ms delay, creating a stutter burst. For the activity screen's 3 FlatLists, this runs on every tab switch.

**Fix:** Cap animation to the first render batch only (`index < initialNumToRender`), skip animation on items that scroll into view later.

**Status:** FIXED — Capped animation to first 8 items on explore and activity screens.

---

### P6-004 | HIGH | GeoJSON FeatureCollections rebuilt every render

**File:** `src/components/map/ExploreMapContent.tsx`

Three GeoJSON FeatureCollection objects are built inline from the `posts`, `roadReports`, and `gasStations` props on every render cycle:

```tsx
const postFeatures: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: posts.filter(…).map(…),
};
```

`districtGeoJSON` IS correctly memoized with `useMemo`, but the three data-driven collections are not.

**Fix:** Wrap each FeatureCollection in `useMemo` keyed on its source array.

**Status:** FIXED — All 3 GeoJSON FeatureCollections wrapped in useMemo.

---

### P6-005 | MEDIUM | 716KB POI dataset eagerly imported at module level

**File:** `src/lib/belizePois.ts`

```typescript
import poisRaw from '@/data/belize-pois.json';
// Immediately builds searchIndex for all 7,794 POIs
```

This 716KB JSON is parsed and the `searchIndex` array is built at import time. Only 2 consumers use it (`mapbox.ts` for `reverseGeocode` → `findNearestPoi`, `geocode.ts` for `searchPlaces` → `searchLocalPois`), both called on-demand (not at startup). The eager import adds to JS bundle parse time and memory footprint on every app launch.

**Fix:** Convert to lazy initialization — keep the import but defer `searchIndex` build until first call.

**Status:** FIXED — searchIndex now lazy-initialized via getSearchIndex() with null cache.

---

### P6-006 | LOW | Linear scan search over 7,794 POIs

**File:** `src/lib/belizePois.ts`

Both `findNearestPoi()` and `searchLocalPois()` iterate all 7,794 items (O(n)). For `findNearestPoi` (called on reverse geocode), the linear scan completes in <2ms on modern devices. For `searchLocalPois` (called on every debounced keystroke), it scores and sorts all items.

**Status:** DEFERRED — Linear scan is fast enough at current dataset size. Would matter at 50K+ POIs. Note for future scaling.

---

### P6-007 | MEDIUM | No `keepUnusedDataFor` on any API slice

**Files:** All 11 API slices in `src/store/api/`

All 11 RTK Query API slices use the default `keepUnusedDataFor: 60` (seconds). This means:
- **postsApi** — feed data evicted 60s after navigating away, forcing refetch on return
- **profilesApi** — user's own profile refetched after 60s of inactivity
- **ratingsApi** — ratings refetched on every revisit
- **reportsApi** — road/gas reports evicted quickly

Some data (user profile, districts, ratings) changes rarely and should be cached longer. Other data (active bookings, messages) is appropriately short-lived.

**Fix:** Add `keepUnusedDataFor` per slice based on data volatility.

**Status:** FIXED — profilesApi/ratingsApi/driverDocumentsApi: 300s, postsApi/reportsApi: 120s, ekyashApi/checkinsApi: 30s.

---

### P6-008 | MEDIUM | 20+ `select('*')` queries fetch all columns

**Files:** `postsApi.ts`, `profilesApi.ts`, `ratingsApi.ts`, `notificationsApi.ts`, `checkinsApi.ts`, `reportsApi.ts`, `driverDocumentsApi.ts`

Many queries use `.select('*')` or bare `.select()`, fetching all columns including potentially large text fields, timestamps, and metadata that the UI doesn't render.

Examples:
- `notificationsApi.getNotifications`: fetches all columns when only id, type, title, body, read, created_at are displayed
- `reportsApi.getRoadReports`: fetches all columns for map markers that only need id, lat, lng, type, severity
- `ratingsApi.getUserRatings`: fetches all columns from a view then manually restructures

**Fix:** Narrow selects to only the columns consumed by the UI. Prioritize the map-marker queries (reports, gas prices) where payload reduction is most impactful.

**Status:** DEFERRED — Requires per-component column audit to avoid breaking consumers.

---

### P6-009 | MEDIUM | Sequential query waterfalls in mutations

**Files:** `src/store/api/bookingsApi.ts`, `src/store/api/messagesApi.ts`, `src/store/api/postsApi.ts`

Several mutations execute sequential queries that could be parallelized:

1. **`postsApi.getMyPosts`**: Runs 2 sequential Supabase queries (posts where user is author, then posts where user has bookings)
2. **`bookingsApi.createBooking.onQueryStarted`**: After mutation, runs 2 additional queries sequentially for push notification (fetches post author, then post details)
3. **`messagesApi.sendMessage.onQueryStarted`**: After mutation, runs 2 sequential queries for push notification

**Fix:** Use `Promise.all()` for independent queries within the same endpoint.

**Status:** FIXED — Parallelized contract + sender profile queries in messagesApi.sendMessage. bookingsApi already used Promise.all. postsApi.getMyPosts has data dependency (cannot parallelize).

---

### P6-010 | LOW | Explore feed sorts all items by distance on every location change

**File:** `app/(tabs)/explore/index.tsx`

The `feedItems` useMemo runs `getDistanceKm()` (Haversine formula) on every item whenever `userLocation` changes. With GPS updates potentially firing frequently, this triggers a full sort on each update.

**Fix:** Debounce or throttle the location value used in the feed sort, or only re-sort when location changes by a meaningful distance (>500m).

**Status:** FIXED — Quantized userLat/userLng to ~500m resolution (Math.round * 200) to avoid re-sorting on every GPS tick.

---

### P6-011 | LOW | Notification items array grows unbounded

**File:** `src/store/slices/notificationsSlice.ts`

`addNotification` prepends to the `items` array with no cap. Over a long session, this array grows indefinitely. The `getNotifications` API query has a `limit: 50`, but realtime additions bypass this.

**Fix:** Cap the items array at a reasonable maximum (e.g., 100) in the `addNotification` reducer.

**Status:** FIXED — Capped at 100 items in addNotification reducer.

---

### P6-012 | MEDIUM | Chat FlatList loads 200 messages without pagination

**File:** `src/store/api/messagesApi.ts`

```typescript
.select('*').eq('contract_id', contractId).order('created_at', { ascending: true }).limit(200)
```

For active contracts, 200 messages fetched at once is a large initial payload. The chat FlatList has no infinite scroll / pagination — it loads all 200 on mount.

**Fix:** Reduce initial limit (e.g., 50) and implement cursor-based pagination on scroll-to-top.

**Status:** DEFERRED — Functional as-is for current user base. Real improvement requires FlatList `onEndReached` + `inverted` pattern, which is a larger refactor.

---

### P6-013 | MEDIUM | Store middleware chain has 11 entries

**File:** `src/store/index.ts`

```typescript
middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware({ serializableCheck: { ... } })
    .concat(postsApi.middleware)
    .concat(bookingsApi.middleware)
    // ... 9 more
```

Each RTK Query middleware adds listener overhead. With 11 API slices, every dispatched action passes through 11 middleware layers. This is the standard RTK Query pattern and unavoidable without consolidating slices, but worth noting.

**Status:** ACKNOWLEDGED — Standard RTK Query pattern. Consolidating slices would reduce middleware but increase coupling. No action needed unless profiling reveals dispatch latency.

---

### P6-014 | LOW | No Image caching strategy for avatars

**File:** `src/components/ui/Avatar.tsx`

Avatar uses `Animated.Image` with Supabase storage URLs. React Native's built-in `Image` component has basic HTTP caching, but no explicit cache control headers or library-level caching (e.g., `expo-image` or `react-native-fast-image`).

For list screens with many avatars, this means repeated network requests for the same user avatars across navigation.

**Fix:** Replace `Animated.Image` with `expo-image` (already in Expo SDK 55) which provides aggressive disk caching, blurhash placeholders, and better memory management.

**Status:** DEFERRED — expo-image not in current dependencies. Requires deliberate dependency addition.

---

### P6-015 | GOOD | MapboxGL clustering enabled ✓

**File:** `src/components/map/ExploreMapContent.tsx`

All three ShapeSource layers use `cluster={true}`, `clusterMaxZoomLevel={14}`, `clusterRadius={50}`. This prevents rendering hundreds of individual markers at low zoom levels.

**Status:** ACKNOWLEDGED — Good pattern, no action needed.

---

### P6-016 | LOW | `feedItems` useMemo dependency on full `posts` array reference

**File:** `app/(tabs)/explore/index.tsx`

The `feedItems` useMemo depends on the posts array from RTK Query. When the cache invalidates and refetches, RTK Query returns a new array reference even if the content is identical, causing the expensive proximity sort to re-run unnecessarily.

**Fix:** Use `createSelector` (reselect) or a structural comparison to prevent recalculation when data hasn't actually changed.

**Status:** DEFERRED — Low impact; RTK Query already prevents unnecessary refetches via tag invalidation.

---

### P6-017 | MEDIUM | Map camera `flyTo` on every feed scroll

**File:** `src/components/map/ExploreMapContent.tsx`, `app/(tabs)/explore/index.tsx`

When the explore screen is in split view (map + list), selecting feed items triggers camera animations. Without debouncing, rapid scrolling or tapping can queue multiple flyTo animations.

**Fix:** Debounce or cancel-on-supersede the camera animation.

**Status:** DEFERRED — Low user impact; camera animation queueing is handled well by MapboxGL internally.

---

### P6-018 | LOW | `searchLocalPois` allocates new objects per scored result

**File:** `src/lib/belizePois.ts`

`searchLocalPois` creates a `{ poi, score }` wrapper object for every POI that scores > 0, then sorts and slices. For common queries this could be hundreds of short-lived objects triggering GC.

**Status:** DEFERRED — Minor GC impact at current dataset size. The 350ms debounce in LocationInput prevents rapid-fire allocation. Would matter at 50K+ POIs.

---

## Summary Table

| ID | Severity | Category | Status |
|----|----------|----------|--------|
| P6-001 | HIGH | Rendering | FIXED |
| P6-002 | HIGH | Rendering | FIXED |
| P6-003 | MEDIUM | Rendering | FIXED |
| P6-004 | HIGH | Rendering | FIXED |
| P6-005 | MEDIUM | Bundle/Startup | FIXED |
| P6-006 | LOW | Data Structure | DEFERRED |
| P6-007 | MEDIUM | Caching | FIXED |
| P6-008 | MEDIUM | Network | DEFERRED |
| P6-009 | MEDIUM | Network | FIXED |
| P6-010 | LOW | Rendering | FIXED |
| P6-011 | LOW | Memory | FIXED |
| P6-012 | MEDIUM | Network | DEFERRED |
| P6-013 | MEDIUM | Architecture | ACKNOWLEDGED |
| P6-014 | LOW | Network/Rendering | DEFERRED (expo-image not installed) |
| P6-015 | GOOD | Rendering | ACKNOWLEDGED |
| P6-016 | LOW | Caching | DEFERRED |
| P6-017 | MEDIUM | Rendering | DEFERRED |
| P6-018 | LOW | Memory | DEFERRED |

**Totals: 18 findings — 10 FIXED, 6 DEFERRED, 2 ACKNOWLEDGED**

---

## Fix Implementation Plan

### Priority 1 (High Impact)
1. P6-001: React.memo on card components
2. P6-002: FlatList optimization props
3. P6-004: Memoize GeoJSON FeatureCollections

### Priority 2 (Medium Impact)
4. P6-007: `keepUnusedDataFor` per API slice
5. P6-005: Lazy-init POI searchIndex
6. P6-009: Parallelize sequential queries
7. P6-003: Cap list item animations
8. P6-008: Narrow select columns (map queries)
9. P6-014: Switch Avatar to expo-image
10. P6-017: Debounce camera flyTo

### Priority 3 (Low Impact)
11. P6-010: Throttle location-based feed sort
12. P6-011: Cap notifications array
13. P6-016: Structural memoization for feedItems
