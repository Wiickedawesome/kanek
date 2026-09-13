import { createSelector } from '@reduxjs/toolkit';
import type { PostWithAuthor } from '@/store/api/postsApi';
import type { Database, BelizeDistrict, PostType } from '@/types/database';
import { getDistanceKm, isEffectivelyExpiredPost } from '@/lib/helpers';
import { GAS_PRICES_LIMIT, TOP_ROUTES_LIMIT } from '@/lib/constants';

type GasPriceRow = Database['public']['Tables']['gas_prices']['Row'];

export type FeedFilter = PostType | 'reports' | null;

export type FeedSort =
  | 'departing_soon'
  | 'top_rated'
  | 'lowest_price'
  | 'highest_pay'
  | 'closest'
  | 'newest';

export const FEED_SORT_LABEL: Record<FeedSort, string> = {
  departing_soon: 'Departing soon',
  top_rated: 'Top rated',
  lowest_price: 'Lowest price',
  highest_pay: 'Highest pay',
  closest: 'Closest',
  newest: 'Newest',
};

/** Allowed sort options + default per filter. */
const SORTS_BY_FILTER: Record<string, { default: FeedSort; options: FeedSort[] }> = {
  route_offer:   { default: 'departing_soon', options: ['departing_soon', 'top_rated', 'lowest_price', 'newest'] },
  route_request: { default: 'departing_soon', options: ['departing_soon', 'top_rated', 'lowest_price', 'newest'] },
  errand:        { default: 'closest',        options: ['closest', 'newest', 'highest_pay'] },
  package:       { default: 'closest',        options: ['closest', 'newest', 'highest_pay'] },
  job:           { default: 'closest',        options: ['closest', 'newest', 'highest_pay'] },
  reports:       { default: 'closest',        options: ['closest', 'newest'] },
  all:           { default: 'newest',         options: ['newest', 'closest', 'top_rated'] },
};

function filterKey(f: FeedFilter): string {
  return f === null ? 'all' : f;
}

export function getSortOptionsForFilter(f: FeedFilter): FeedSort[] {
  return SORTS_BY_FILTER[filterKey(f)]?.options ?? ['newest'];
}

export function getDefaultSortForFilter(f: FeedFilter): FeedSort {
  return SORTS_BY_FILTER[filterKey(f)]?.default ?? 'newest';
}

export type FeedItem =
  | { kind: 'post'; data: PostWithAuthor }
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
  if (item.kind === 'gas_price') {
    return { lat: item.data.station_lat, lng: item.data.station_lng };
  }
  return null;
}

// ─── Feed Items Selector ──────────────────────────────────────────────

interface FeedSelectorInput {
  posts: PostWithAuthor[] | undefined;
  gasPrices: GasPriceRow[] | undefined;
  typeFilter: FeedFilter;
  distanceFilter: number | null;
  userLat: number | null;
  userLng: number | null;
  userDistrict: BelizeDistrict | null;
  sort: FeedSort;
}

function itemTimestamp(item: FeedItem): number {
  const iso = item.kind === 'post'
    ? (item.data.created_at ?? null)
    : (item.data.reported_at ?? null);
  return iso ? new Date(iso).getTime() : 0;
}

function itemDepartureMs(item: FeedItem): number {
  if (item.kind !== 'post') return Infinity;
  const iso = item.data.departure_at;
  return iso ? new Date(iso).getTime() : Infinity;
}

function itemDistanceKm(item: FeedItem, userLat: number, userLng: number): number {
  const c = getPostCoord(item);
  if (!c) return Infinity;
  return getDistanceKm({ lat: userLat, lng: userLng }, c);
}

function itemRating(item: FeedItem): number {
  if (item.kind !== 'post') return -1;
  return item.data.author?.rating_avg ?? -1;
}

function itemPriceCents(item: FeedItem): number {
  if (item.kind !== 'post') return Infinity;
  return item.data.price_cents ?? Infinity;
}

function compareForSort(
  sort: FeedSort,
  a: FeedItem,
  b: FeedItem,
  userLat: number | null,
  userLng: number | null,
  userDistrict: BelizeDistrict | null,
): number {
  switch (sort) {
    case 'departing_soon':
      return itemDepartureMs(a) - itemDepartureMs(b);
    case 'top_rated':
      return itemRating(b) - itemRating(a);
    case 'lowest_price':
      return itemPriceCents(a) - itemPriceCents(b);
    case 'highest_pay':
      return itemPriceCents(b) - itemPriceCents(a);
    case 'closest': {
      if (userLat != null && userLng != null) {
        return itemDistanceKm(a, userLat, userLng) - itemDistanceKm(b, userLat, userLng);
      }
      if (userDistrict) {
        const aMatch = a.kind === 'post' && postMatchesDistrict(a.data, userDistrict) ? 0 : 1;
        const bMatch = b.kind === 'post' && postMatchesDistrict(b.data, userDistrict) ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }
      return itemTimestamp(b) - itemTimestamp(a);
    }
    case 'newest':
    default:
      return itemTimestamp(b) - itemTimestamp(a);
  }
}

export const selectFeedItems = createSelector(
  [
    (input: FeedSelectorInput) => input.posts,
    (input: FeedSelectorInput) => input.gasPrices,
    (input: FeedSelectorInput) => input.typeFilter,
    (input: FeedSelectorInput) => input.distanceFilter,
    (input: FeedSelectorInput) => input.userLat,
    (input: FeedSelectorInput) => input.userLng,
    (input: FeedSelectorInput) => input.userDistrict,
    (input: FeedSelectorInput) => input.sort,
  ],
  (posts, gasPrices, typeFilter, distanceFilter, userLat, userLng, userDistrict, sort) => {
    const isReportsFilter = typeFilter === 'reports';
    const hasGPS = userLat != null && userLng != null;

    if (isReportsFilter) {
      const items: FeedItem[] = (gasPrices ?? []).map((g: GasPriceRow) => ({ kind: 'gas_price', data: g } as FeedItem));
      items.sort((a: FeedItem, b: FeedItem) => compareForSort(sort, a, b, userLat, userLng, userDistrict));
      return items;
    }

    let filteredPosts = (posts ?? []).filter(
      (post: PostWithAuthor) => !isEffectivelyExpiredPost(post.status, post.departure_at),
    );

    if (distanceFilter && hasGPS) {
      filteredPosts = filteredPosts.filter((p: PostWithAuthor) => {
        if (p.origin_lat == null || p.origin_lng == null) return false;
        return getDistanceKm(
          { lat: userLat!, lng: userLng! },
          { lat: p.origin_lat, lng: p.origin_lng },
        ) <= distanceFilter;
      });
    }

    const items: FeedItem[] = [];
    filteredPosts.forEach((p: PostWithAuthor) => items.push({ kind: 'post', data: p }));

    if (typeFilter === null) {
      (gasPrices ?? []).slice(0, GAS_PRICES_LIMIT).forEach((g: GasPriceRow) => items.push({ kind: 'gas_price', data: g }));
    }

    items.sort((a: FeedItem, b: FeedItem) => compareForSort(sort, a, b, userLat, userLng, userDistrict));
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
      (p: PostWithAuthor) => p.type === 'route_offer' && !isEffectivelyExpiredPost(p.status, p.departure_at),
    );
    if (userDistrict) {
      routes.sort((a: PostWithAuthor, b: PostWithAuthor) => {
        const aMatch = postMatchesDistrict(a, userDistrict) ? 0 : 1;
        const bMatch = postMatchesDistrict(b, userDistrict) ? 0 : 1;
        return aMatch - bMatch;
      });
    }
    return routes.slice(0, TOP_ROUTES_LIMIT);
  },
);
