import { createSelector } from '@reduxjs/toolkit';
import type { PostWithAuthor } from '@/store/api/postsApi';
import type { Database, BelizeDistrict, PostType } from '@/types/database';
import { getDistanceKm } from '@/lib/helpers';
import { GAS_PRICES_LIMIT, TOP_ROUTES_LIMIT } from '@/lib/constants';

type RoadReportRow = Database['public']['Tables']['road_reports']['Row'];
type GasPriceRow = Database['public']['Tables']['gas_prices']['Row'];

export type FeedFilter = PostType | 'reports' | null;

export type FeedItem =
  | { kind: 'post'; data: PostWithAuthor }
  | { kind: 'road_report'; data: RoadReportRow }
  | { kind: 'gas_price'; data: GasPriceRow };

/** Map enum values to keywords that may appear in origin_address */
const DISTRICT_KEYWORDS: Record<BelizeDistrict, string[]> = {
  belize: ['belize city', 'belize district', 'ladyville', 'hattieville', 'sandhill'],
  cayo: ['cayo', 'san ignacio', 'santa elena', 'belmopan', 'benque', 'spanish lookout'],
  corozal: ['corozal'],
  orange_walk: ['orange walk'],
  stann_creek: ['stann creek', 'dangriga', 'hopkins', 'placencia', 'independence'],
  toledo: ['toledo', 'punta gorda', 'big falls'],
};

function postMatchesDistrict(post: PostWithAuthor, district: BelizeDistrict): boolean {
  const addr = (post.origin_address ?? '').toLowerCase();
  const dest = (post.dest_address ?? '').toLowerCase();
  return DISTRICT_KEYWORDS[district].some((kw) => addr.includes(kw) || dest.includes(kw));
}

/** Extract lat/lng from any feed item for distance comparison */
function getPostCoord(item: FeedItem): { lat: number; lng: number } | null {
  if (item.kind === 'post') {
    if (item.data.origin_lat != null && item.data.origin_lng != null) {
      return { lat: item.data.origin_lat, lng: item.data.origin_lng };
    }
    return null;
  }
  if (item.kind === 'road_report') {
    return { lat: item.data.lat, lng: item.data.lng };
  }
  if (item.kind === 'gas_price') {
    return { lat: item.data.station_lat, lng: item.data.station_lng };
  }
  return null;
}

// ─── Feed Items Selector ──────────────────────────────────────────────

interface FeedSelectorInput {
  posts: PostWithAuthor[] | undefined;
  roadReports: RoadReportRow[] | undefined;
  gasPrices: GasPriceRow[] | undefined;
  typeFilter: FeedFilter;
  distanceFilter: number | null;
  userLat: number | null;
  userLng: number | null;
  userDistrict: BelizeDistrict | null;
}

export const selectFeedItems = createSelector(
  [
    (input: FeedSelectorInput) => input.posts,
    (input: FeedSelectorInput) => input.roadReports,
    (input: FeedSelectorInput) => input.gasPrices,
    (input: FeedSelectorInput) => input.typeFilter,
    (input: FeedSelectorInput) => input.distanceFilter,
    (input: FeedSelectorInput) => input.userLat,
    (input: FeedSelectorInput) => input.userLng,
    (input: FeedSelectorInput) => input.userDistrict,
  ],
  (posts, roadReports, gasPrices, typeFilter, distanceFilter, userLat, userLng, userDistrict) => {
    const isReportsFilter = typeFilter === 'reports';
    const hasGPS = userLat != null && userLng != null;

    if (isReportsFilter) {
      const items: FeedItem[] = [];
      (roadReports ?? []).forEach((r) => items.push({ kind: 'road_report', data: r }));
      (gasPrices ?? []).forEach((g) => items.push({ kind: 'gas_price', data: g }));
      return items;
    }

    let filteredPosts = posts ?? [];

    if (distanceFilter && hasGPS) {
      filteredPosts = filteredPosts.filter((p) => {
        if (p.origin_lat == null || p.origin_lng == null) return false;
        return getDistanceKm(
          { lat: userLat!, lng: userLng! },
          { lat: p.origin_lat, lng: p.origin_lng },
        ) <= distanceFilter;
      });
    }

    const items: FeedItem[] = [];
    filteredPosts.forEach((p) => items.push({ kind: 'post', data: p }));

    if (typeFilter === null) {
      (roadReports ?? []).forEach((r) => items.push({ kind: 'road_report', data: r }));
      (gasPrices ?? []).slice(0, GAS_PRICES_LIMIT).forEach((g) => items.push({ kind: 'gas_price', data: g }));
    }

    if (hasGPS) {
      items.sort((a, b) => {
        const aCoord = getPostCoord(a);
        const bCoord = getPostCoord(b);
        const aDist = aCoord ? getDistanceKm({ lat: userLat!, lng: userLng! }, aCoord) : Infinity;
        const bDist = bCoord ? getDistanceKm({ lat: userLat!, lng: userLng! }, bCoord) : Infinity;
        return aDist - bDist;
      });
    } else if (userDistrict) {
      items.sort((a, b) => {
        const aMatch = a.kind === 'post' && postMatchesDistrict(a.data, userDistrict) ? 0 : 1;
        const bMatch = b.kind === 'post' && postMatchesDistrict(b.data, userDistrict) ? 0 : 1;
        return aMatch - bMatch;
      });
    }

    return items;
  },
);

// ─── Top Routes Selector ──────────────────────────────────────────────

interface TopRoutesSelectorInput {
  posts: PostWithAuthor[] | undefined;
  typeFilter: FeedFilter;
  userDistrict: BelizeDistrict | null;
}

export const selectTopRoutes = createSelector(
  [
    (input: TopRoutesSelectorInput) => input.posts,
    (input: TopRoutesSelectorInput) => input.typeFilter,
    (input: TopRoutesSelectorInput) => input.userDistrict,
  ],
  (posts, typeFilter, userDistrict) => {
    if (typeFilter !== null) return [];
    const routes = (posts ?? []).filter(
      (p) => p.type === 'route_offer',
    );
    if (userDistrict) {
      routes.sort((a, b) => {
        const aMatch = postMatchesDistrict(a, userDistrict) ? 0 : 1;
        const bMatch = postMatchesDistrict(b, userDistrict) ? 0 : 1;
        return aMatch - bMatch;
      });
    }
    return routes.slice(0, TOP_ROUTES_LIMIT);
  },
);
