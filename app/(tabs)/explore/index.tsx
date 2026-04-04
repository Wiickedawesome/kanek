import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { router } from 'expo-router';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { FilterChip, EmptyState } from '@/components/ui';
import { Icon } from '@/components/icons';
import { RouteOfferCard, RouteRequestCard, ErrandCard, JobCard, RoadReportCard, GasPriceCard, TopRoutesSection } from '@/components/cards';
import { useGetPostsQuery, type PostWithAuthor } from '@/store/api/postsApi';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';
import { useGetRoadReportsQuery, useGetGasPricesQuery, useVerifyGasPriceMutation } from '@/store/api/reportsApi';
import type { PostType, Database, BelizeDistrict } from '@/types/database';
import type { RootState } from '@/store';
import { useRealtime } from '@/hooks/useRealtime';
import { TOP_ROUTES_LIMIT, GAS_PRICES_LIMIT, DISTANCE_PRESETS, BELIZE_DISTRICTS } from '@/lib/constants';
import { getDistanceKm } from '@/lib/helpers';

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

type FeedFilter = PostType | 'reports' | null;

type RoadReportRow = Database['public']['Tables']['road_reports']['Row'];
type GasPriceRow = Database['public']['Tables']['gas_prices']['Row'];

type FeedItem =
  | { kind: 'post'; data: PostWithAuthor }
  | { kind: 'road_report'; data: RoadReportRow }
  | { kind: 'gas_price'; data: GasPriceRow };

const FILTER_OPTIONS: { label: string; value: FeedFilter }[] = [
  { label: 'All', value: null },
  { label: 'Routes', value: 'route_offer' },
  { label: 'Riders', value: 'route_request' },
  { label: 'Errands', value: 'errand' },
  { label: 'Packages', value: 'package' },
  { label: 'Jobs', value: 'job' },
  { label: 'Reports', value: 'reports' },
];

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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function ExploreScreen() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FeedFilter>(null);
  const [districtFilter, setDistrictFilter] = useState<BelizeDistrict | null>(null);
  const [distanceFilter, setDistanceFilter] = useState<number | null>(null);

  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const userLat = useSelector((state: RootState) => state.location.latitude);
  const userLng = useSelector((state: RootState) => state.location.longitude);
  const hasGPS = userLat != null && userLng != null;

  const { data: profile } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const firstName = profile?.first_name ?? '';
  const userDistrict = profile?.district ?? null;

  const isReportsFilter = typeFilter === 'reports';
  const postTypeFilter = isReportsFilter ? null : typeFilter;

  const { data: posts, isLoading: postsLoading, isFetching: postsFetching, refetch: refetchPosts } = useGetPostsQuery({
    type: postTypeFilter,
    search: search.length >= 2 ? search : undefined,
  });

  const { data: roadReports, isLoading: reportsLoading, refetch: refetchReports } = useGetRoadReportsQuery();
  const { data: gasPrices, isLoading: gasLoading, refetch: refetchGas } = useGetGasPricesQuery();
  const [verifyGasPrice] = useVerifyGasPriceMutation();

  const { subscribeToRoadReports } = useRealtime();

  useEffect(() => {
    const unsubscribe = subscribeToRoadReports();
    return () => {
      unsubscribe?.();
    };
  }, [subscribeToRoadReports]);

  const feedItems = useMemo<FeedItem[]>(() => {
    if (isReportsFilter) {
      const items: FeedItem[] = [];
      (roadReports ?? []).forEach((r) => items.push({ kind: 'road_report', data: r }));
      (gasPrices ?? []).forEach((g) => items.push({ kind: 'gas_price', data: g }));
      return items;
    }

    let filteredPosts = posts ?? [];

    // District filter
    if (districtFilter) {
      filteredPosts = filteredPosts.filter((p) => postMatchesDistrict(p, districtFilter));
    }

    // Distance radius filter (needs GPS)
    if (distanceFilter && hasGPS) {
      filteredPosts = filteredPosts.filter((p) => {
        if (p.origin_lat == null || p.origin_lng == null) return false;
        const d = getDistanceKm(
          { lat: userLat, lng: userLng },
          { lat: p.origin_lat, lng: p.origin_lng },
        );
        return d <= distanceFilter;
      });
    }

    const items: FeedItem[] = [];
    filteredPosts.forEach((p) => items.push({ kind: 'post', data: p }));

    // When showing "All", weave active road reports and recent gas prices into feed
    if (typeFilter === null) {
      (roadReports ?? []).forEach((r) => items.push({ kind: 'road_report', data: r }));
      (gasPrices ?? []).slice(0, GAS_PRICES_LIMIT).forEach((g) => items.push({ kind: 'gas_price', data: g }));
    }

    // Sort by proximity if user has GPS, otherwise fall back to district match
    if (hasGPS) {
      items.sort((a, b) => {
        const aCoord = getPostCoord(a);
        const bCoord = getPostCoord(b);
        const aDist = aCoord ? getDistanceKm({ lat: userLat, lng: userLng }, aCoord) : Infinity;
        const bDist = bCoord ? getDistanceKm({ lat: userLat, lng: userLng }, bCoord) : Infinity;
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
  }, [posts, roadReports, gasPrices, typeFilter, isReportsFilter, userDistrict, districtFilter, distanceFilter, hasGPS, userLat, userLng]);

  const isLoading = postsLoading || reportsLoading || gasLoading;
  const isFetching = postsFetching;

  const topRoutes = useMemo(() => {
    if (typeFilter !== null) return [];
    const routes = (posts ?? []).filter(
      (p) => p.type === 'route_offer' || p.type === 'route_request',
    );
    // Prioritize routes in user's district
    if (userDistrict) {
      routes.sort((a, b) => {
        const aMatch = postMatchesDistrict(a, userDistrict) ? 0 : 1;
        const bMatch = postMatchesDistrict(b, userDistrict) ? 0 : 1;
        return aMatch - bMatch;
      });
    }
    return routes.slice(0, TOP_ROUTES_LIMIT);
  }, [posts, typeFilter, userDistrict]);

  const onRefresh = useCallback(() => {
    refetchPosts();
    refetchReports();
    refetchGas();
  }, [refetchPosts, refetchReports, refetchGas]);

  const openPost = useCallback((id: string) => {
    router.push(`/(tabs)/explore/${id}`);
  }, []);

  const renderItem = useCallback(({ item }: { item: FeedItem }) => {
    switch (item.kind) {
      case 'road_report':
        return (
          <RoadReportCard
            report={item.data}
            onPress={() => router.push({ pathname: '/modals/report-detail', params: { id: item.data.id } })}
          />
        );
      case 'gas_price':
        return (
          <GasPriceCard
            gasPrice={item.data}
            onPress={() => verifyGasPrice(item.data.id)}
          />
        );
      case 'post': {
        const onPress = () => openPost(item.data.id);
        switch (item.data.type) {
          case 'route_offer':
            return <RouteOfferCard post={item.data} onPress={onPress} />;
          case 'route_request':
            return <RouteRequestCard post={item.data} onPress={onPress} />;
          case 'errand':
          case 'package':
            return <ErrandCard post={item.data} onPress={onPress} />;
          case 'job':
            return <JobCard post={item.data} onPress={onPress} />;
          default:
            return <ErrandCard post={item.data} onPress={onPress} />;
        }
      }
    }
  }, [openPost, verifyGasPrice]);

  const keyExtractor = useCallback((item: FeedItem) => {
    return `${item.kind}-${item.kind === 'post' ? item.data.id : item.data.id}`;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {getGreeting()}{firstName ? `, ${firstName}` : ''}
        </Text>

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Icon name="search" size={20} color={colors.neutral[400]} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search routes, errands..."
              placeholderTextColor={colors.neutral[400]}
              returnKeyType="search"
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            onPress={() => router.push('/(tabs)/explore/map')}
            hitSlop={8}
          >
            <Icon name="map-pin" size={20} color={colors.forest[900]} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filters}
      >
        {FILTER_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.label}
            label={opt.label}
            selected={typeFilter === opt.value}
            onPress={() => setTypeFilter(opt.value)}
          />
        ))}
      </ScrollView>

      {/* District filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filters}
      >
        {BELIZE_DISTRICTS.map((d) => (
          <FilterChip
            key={d.key}
            label={d.label}
            selected={districtFilter === d.key}
            onPress={() => setDistrictFilter(districtFilter === d.key ? null : d.key)}
          />
        ))}
      </ScrollView>

      {/* Distance radius chips (only when GPS available) */}
      {hasGPS && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filters}
        >
          <FilterChip
            label="All distances"
            selected={distanceFilter === null}
            onPress={() => setDistanceFilter(null)}
          />
          {DISTANCE_PRESETS.map((km) => (
            <FilterChip
              key={km}
              label={`${km} km`}
              selected={distanceFilter === km}
              onPress={() => setDistanceFilter(distanceFilter === km ? null : km)}
            />
          ))}
        </ScrollView>
      )}

      <FlatList
        data={feedItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={styles.list}
        contentContainerStyle={styles.feed}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View>
            {topRoutes.length > 0 && (
              <TopRoutesSection routes={topRoutes} onPressRoute={openPost} />
            )}
            <Text style={styles.sectionHeading}>
              {typeFilter === null ? 'Community board' : FILTER_OPTIONS.find(o => o.value === typeFilter)?.label ?? 'Posts'}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={onRefresh}
            tintColor={colors.accent.green}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="compass"
              title="No posts yet"
              message="Be the first to post a route, errand, or job to the community board."
            />
          )
        }
      />

      {/* Report FABs */}
      <View style={styles.fabContainer}>
        <Pressable
          style={[styles.fab, styles.fabSecondary]}
          onPress={() => router.push('/modals/report-gas')}
        >
          <Icon name="fuel" size={20} color={colors.neutral[0]} />
        </Pressable>
        <Pressable
          style={styles.fab}
          onPress={() => router.push('/modals/report-road')}
        >
          <Icon name="alert-triangle" size={20} color={colors.neutral[0]} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  greeting: {
    ...typography.h2,
    color: colors.forest[900],
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  searchInput: {
    flex: 1,
    ...typography.body2,
    color: colors.forest[900],
    padding: 0,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  iconButtonPressed: {
    backgroundColor: colors.neutral[100],
  },
  filters: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  filterScroll: {
    flexGrow: 0,
  },
  list: {
    flex: 1,
  },
  feed: {
    padding: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionHeading: {
    ...typography.h3,
    color: colors.forest[900],
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  separator: {
    height: spacing.md,
  },
  fabContainer: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  fabSecondary: {
    backgroundColor: colors.forest[600],
  },
});
