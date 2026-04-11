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
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { router } from 'expo-router';
import { colors, typography, spacing, borderRadius, shadows } from '@/theme';
import { FilterChip, EmptyState, TopographicBg, ScreenHeader, FeedListSkeleton } from '@/components/ui';
import { Icon } from '@/components/icons';
import { RouteOfferCard, RouteRequestCard, ErrandCard, JobCard, RoadReportCard, GasPriceCard, TopRoutesSection } from '@/components/cards';
import { useGetPostsQuery, type PostWithAuthor } from '@/store/api/postsApi';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';
import { useGetRoadReportsQuery, useGetGasPricesQuery, useVerifyGasPriceMutation } from '@/store/api/reportsApi';
import type { Database } from '@/types/database';
import type { RootState } from '@/store';
import { useRealtime } from '@/hooks/useRealtime';
import { DISTANCE_PRESETS } from '@/lib/constants';
import { selectFeedItems, selectTopRoutes, type FeedFilter, type FeedItem } from '@/store/selectors/feedSelectors';

type RoadReportRow = Database['public']['Tables']['road_reports']['Row'];
type GasPriceRow = Database['public']['Tables']['gas_prices']['Row'];

const FILTER_OPTIONS: { label: string; value: FeedFilter }[] = [
  { label: 'All', value: null },
  { label: 'Routes', value: 'route_offer' },
  { label: 'Riders', value: 'route_request' },
  { label: 'Errands', value: 'errand' },
  { label: 'Packages', value: 'package' },
  { label: 'Jobs', value: 'job' },
  { label: 'Reports', value: 'reports' },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function ExploreScreen() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FeedFilter>(null);
  const [distanceFilter, setDistanceFilter] = useState<number | null>(null);

  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const userLatRaw = useSelector((state: RootState) => state.location.latitude);
  const userLngRaw = useSelector((state: RootState) => state.location.longitude);
  // Quantize to ~500m to avoid re-sorting feed on every GPS tick
  const userLat = useMemo(() => userLatRaw != null ? Math.round(userLatRaw * 200) / 200 : null, [userLatRaw]);
  const userLng = useMemo(() => userLngRaw != null ? Math.round(userLngRaw * 200) / 200 : null, [userLngRaw]);
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

  const feedItems = selectFeedItems({
    posts, roadReports, gasPrices, typeFilter, distanceFilter, userLat, userLng, userDistrict,
  });

  const isLoading = postsLoading || reportsLoading || gasLoading;
  const isFetching = postsFetching;

  const topRoutes = selectTopRoutes({ posts, typeFilter, userDistrict });

  const onRefresh = useCallback(() => {
    refetchPosts();
    refetchReports();
    refetchGas();
  }, [refetchPosts, refetchReports, refetchGas]);

  const openPost = useCallback((id: string) => {
    router.push(`/(tabs)/explore/${id}`);
  }, []);

  const renderItem = useCallback(({ item, index }: { item: FeedItem; index: number }) => {
    let content: React.ReactNode;

    switch (item.kind) {
      case 'road_report':
        content = (
          <RoadReportCard
            report={item.data}
            onPress={() => router.push({ pathname: '/modals/report-detail', params: { id: item.data.id } })}
          />
        );
        break;
      case 'gas_price':
        content = (
          <GasPriceCard
            gasPrice={item.data}
            onPress={() => verifyGasPrice(item.data.id)}
          />
        );
        break;
      case 'post': {
        const onPress = () => openPost(item.data.id);
        switch (item.data.type) {
          case 'route_offer':
            content = <RouteOfferCard post={item.data} onPress={onPress} />;
            break;
          case 'route_request':
            content = <RouteRequestCard post={item.data} onPress={onPress} />;
            break;
          case 'errand':
          case 'package':
            content = <ErrandCard post={item.data} onPress={onPress} />;
            break;
          case 'job':
            content = <JobCard post={item.data} onPress={onPress} />;
            break;
          default:
            content = <ErrandCard post={item.data} onPress={onPress} />;
        }
        break;
      }
    }

    if (index >= 8) return <View>{content}</View>;

    return (
      <Animated.View entering={FadeInUp.duration(350).delay(index * 60)}>
        {content}
      </Animated.View>
    );
  }, [openPost, verifyGasPrice]);

  const keyExtractor = useCallback((item: FeedItem) => {
    return `${item.kind}-${item.kind === 'post' ? item.data.id : item.data.id}`;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <TopographicBg />
      <ScreenHeader style={styles.header}>
        <Text style={styles.greeting}>
          {getGreeting()}{firstName ? `, ${firstName}` : ''}
        </Text>

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Icon name="search" size={20} color={'rgba(255,255,255,0.55)'} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search routes, errands..."
              placeholderTextColor={'rgba(255,255,255,0.45)'}
              returnKeyType="search"
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            onPress={() => router.push('/(tabs)/explore/map')}
            hitSlop={8}
          >
            <Icon name="map-pin" size={20} color={colors.neutral[0]} />
          </Pressable>
        </View>
      </ScreenHeader>

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
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
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
          isLoading ? <FeedListSkeleton /> : (
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  greeting: {
    ...typography.h2,
    color: colors.neutral[0],
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
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchInput: {
    flex: 1,
    ...typography.body2,
    color: colors.neutral[0],
    padding: 0,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  iconButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.22)',
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
    paddingBottom: 80,
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
    ...shadows.md,
  },
  fabSecondary: {
    backgroundColor: colors.forest[600],
  },
});
