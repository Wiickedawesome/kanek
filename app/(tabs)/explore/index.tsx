import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  TextInput,
  FlatList,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Pressable,
  Modal,
  Platform,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { router } from 'expo-router';
import { colors, type, spacing, borderRadius, shadows, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { FilterChip, EmptyState, ScreenHeader, FeedListSkeleton, MapFab, useFloatingTabBarPad } from '@/components/ui';
import { Icon } from '@/components/icons';
import { RouteOfferCard, RouteRequestCard, ErrandCard, JobCard, GasPriceCard, TopRoutesSection } from '@/components/cards';
import { useGetPostsQuery } from '@/store/api/postsApi';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';
import { useGetGasPricesQuery } from '@/store/api/reportsApi';
import { useGetUnreadCountQuery } from '@/store/api/notificationsApi';
import type { RootState } from '@/store';
import { useRealtime } from '@/hooks/useRealtime';
import { DISTANCE_PRESETS } from '@/lib/constants';
import { openInMaps } from '@/lib/helpers';
import { selectFeedItems, selectTopRoutes, getDefaultSortForFilter, getSortOptionsForFilter, FEED_SORT_LABEL, type FeedFilter, type FeedItem, type FeedSort } from '@/store/selectors/feedSelectors';
import { Text } from '@/components/ui/Text';

const FILTER_OPTIONS: { label: string; value: FeedFilter }[] = [
  { label: 'All', value: null },
  { label: 'Routes', value: 'route_offer' },
  { label: 'Rides', value: 'route_request' },
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
  const { c } = useTheme();
  const styles = createStyles(c);
  const tabBarPad = useFloatingTabBarPad({ withMapFab: true });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FeedFilter>(null);
  const [distanceFilter, setDistanceFilter] = useState<number | null>(null);
  const [showDistance, setShowDistance] = useState(false);
  const [sort, setSort] = useState<FeedSort>(() => getDefaultSortForFilter(null));
  const [sortOpen, setSortOpen] = useState(false);

  const onSelectFilter = useCallback((value: FeedFilter) => {
    setTypeFilter(value);
    setSort(getDefaultSortForFilter(value));
  }, []);

  const sortOptions = useMemo(() => getSortOptionsForFilter(typeFilter), [typeFilter]);

  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const userLatRaw = useSelector((state: RootState) => state.location.latitude);
  const userLngRaw = useSelector((state: RootState) => state.location.longitude);
  // Quantize to ~500m to avoid re-sorting feed on every GPS tick
  const userLat = useMemo(() => userLatRaw != null ? Math.round(userLatRaw * 200) / 200 : null, [userLatRaw]);
  const userLng = useMemo(() => userLngRaw != null ? Math.round(userLngRaw * 200) / 200 : null, [userLngRaw]);
  const hasGPS = userLat != null && userLng != null;

  const { data: profile } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const { data: unreadCount = 0 } = useGetUnreadCountQuery(userId ?? '', {
    skip: !userId,
    pollingInterval: 60_000,
  });
  const firstName = profile?.first_name ?? '';
  const userDistrict = profile?.district ?? null;

  const isReportsFilter = typeFilter === 'reports';
  const postTypeFilter = isReportsFilter ? null : typeFilter;

  const { data: posts, isLoading: postsLoading, isFetching: postsFetching, refetch: refetchPosts } = useGetPostsQuery({
    type: postTypeFilter,
    search: search.length >= 2 ? search : undefined,
  });

  const { data: gasPrices, isLoading: gasLoading, refetch: refetchGas } = useGetGasPricesQuery();

  const { subscribeToGasPrices } = useRealtime();

  useEffect(() => {
    const unsubscribe = subscribeToGasPrices();
    return () => {
      unsubscribe?.();
    };
  }, [subscribeToGasPrices]);

  const feedItems = selectFeedItems({
    posts, gasPrices, typeFilter, distanceFilter, userLat, userLng, userDistrict, sort,
  });

  const isLoading = postsLoading || gasLoading;
  const isFetching = postsFetching;

  const topRoutes = selectTopRoutes({ posts, typeFilter, userDistrict });

  const onRefresh = useCallback(() => {
    refetchPosts();
    refetchGas();
  }, [refetchPosts, refetchGas]);

  const openPost = useCallback((id: string) => {
    router.push(`/(tabs)/explore/${id}`);
  }, []);

  const renderItem = useCallback(({ item, index }: { item: FeedItem; index: number }) => {
    let content: React.ReactNode;

    switch (item.kind) {
      case 'gas_price':
        content = (
          <GasPriceCard
            gasPrice={item.data}
            onPress={() => openInMaps(null, {
              lat: item.data.station_lat,
              lng: item.data.station_lng,
              label: item.data.station_name,
            })}
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
      <Animated.View entering={Platform.OS === 'web' ? undefined : FadeInUp.duration(350).delay(index * 60)}>
        {content}
      </Animated.View>
    );
  }, [openPost]);

  const keyExtractor = useCallback((item: FeedItem) => {
    return `${item.kind}-${item.kind === 'post' ? item.data.id : item.data.id}`;
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.greeting}>
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/activity/notifications')}
            hitSlop={12}
            style={styles.bellButton}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Icon name="bell" size={22} color={c.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Icon name="search" size={20} color={c.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search rides, errands..."
              placeholderTextColor={c.textMuted}
              returnKeyType="search"
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            onPress={() => router.push('/(tabs)/explore/map')}
            hitSlop={8}
          >
            <Icon name="map-pin" size={20} color={c.text} />
          </Pressable>
        </View>
      </ScreenHeader>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filters}
      >
        {hasGPS && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle distance filters"
            onPress={() => setShowDistance((v) => !v)}
            style={({ pressed }) => [
              styles.allChip,
              { backgroundColor: c.chipBg, borderColor: c.chipBorder },
              showDistance && { backgroundColor: c.chipSelectedBg, borderColor: c.chipSelectedBg },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Icon name="filter" size={14} color={showDistance ? c.chipSelectedText : c.chipText} />
          </Pressable>
        )}

        {FILTER_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.label}
            label={opt.label}
            selected={typeFilter === opt.value}
            onPress={() => onSelectFilter(opt.value)}
          />
        ))}
      </ScrollView>

      {/* Distance radius chips (only when GPS available and toggled on) */}
      {hasGPS && showDistance && (
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

      {/* Count + sort row */}
      <View style={styles.countRow}>
        <Text style={[styles.countText, { color: c.text }]}>
          {feedItems.length} {feedItems.length === 1 ? 'post' : 'posts'}
        </Text>
        <Pressable hitSlop={8} style={styles.sortPill} onPress={() => setSortOpen(true)} accessibilityRole="button" accessibilityLabel="Change sort order">
          <Text style={[styles.sortText, { color: c.textMuted }]}>{FEED_SORT_LABEL[sort]}</Text>
          <Icon name="chevron-down" size={14} color={c.textMuted} />
        </Pressable>
      </View>

      <Modal
        visible={sortOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortOpen(false)}
      >
        <Pressable style={styles.sortBackdrop} onPress={() => setSortOpen(false)}>
          <Pressable style={[styles.sortSheet, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => {}}>
            <Text style={[styles.sortSheetTitle, { color: c.textMuted }]}>Sort by</Text>
            {sortOptions.map((opt) => {
              const selected = opt === sort;
              return (
                <Pressable
                  key={opt}
                  onPress={() => { setSort(opt); setSortOpen(false); }}
                  style={({ pressed }) => [
                    styles.sortOption,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.sortOptionText, { color: c.text, fontFamily: selected ? 'Manrope-Bold' : 'Manrope-Regular' }]}>
                    {FEED_SORT_LABEL[opt]}
                  </Text>
                  {selected && <Icon name="chevron-right" size={16} color={c.text} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <FlatList
        data={feedItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={styles.list}
        contentContainerStyle={[styles.feed, { paddingBottom: tabBarPad + spacing.xl }]}
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
              message="Be the first to post a ride, errand, or job to the community board."
            />
          )
        }
      />

      {/* Floating Map pill (above tab bar) */}
      <MapFab onPress={() => router.push('/(tabs)/explore/map')} />
    </SafeAreaView>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  bellButton: {
    position: 'relative',
    padding: spacing.xs,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.accent.green,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: colors.forest[900],
    fontSize: 10,
    fontFamily: 'Manrope-Bold',
    lineHeight: 12,
  },
  greeting: {
    ...type.h2.bold,
    color: c.text,
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
    backgroundColor: c.surface,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
  },
  searchInput: {
    flex: 1,
    ...type.bodySm.regular,
    color: c.text,
    padding: 0,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  iconButtonPressed: {
    backgroundColor: c.bg,
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
  allChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  allChipLabel: {
    ...type.bodySm.regular,
    fontFamily: 'Manrope-Bold',
    fontSize: 13,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  countText: {
    ...type.body.bold,
    fontSize: 15,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sortText: {
    ...type.bodySm.regular,
    fontSize: 13,
  },
  sortBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sortSheet: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  sortSheetTitle: {
    ...type.bodySm.regular,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  sortOptionText: {
    ...type.body.regular,
    fontSize: 15,
  },
  list: {
    flex: 1,
  },
  feed: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
  },
  separator: {
    height: spacing.md,
  },
  fabContainer: {
    position: 'absolute',
    right: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  fab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  fabSecondary: {
    backgroundColor: colors.forest[600],
  },
});
