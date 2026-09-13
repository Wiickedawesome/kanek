import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  FlatList,
  SectionList,
  StyleSheet,
  Pressable,
  RefreshControl,
  Platform,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, usePathname, useFocusEffect } from 'expo-router';
import { useSelector } from 'react-redux';
import { ScreenHeader, FeedListSkeleton, Card, EmptyState, useFloatingTabBarPad } from '@/components/ui';
import { Icon } from '@/components/icons';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatBZD, formatDeparture, getEffectivePostStatus, getTimeAgo } from '@/lib/helpers';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { useGetMyBookingsQuery, useGetMyContractsQuery, useCancelBookingMutation, type BookingWithPost, type ContractWithDetails } from '@/store/api/bookingsApi';
import { useGetMyPostsQuery, useDeletePostMutation, type ActiveBookingPreview, type MyPostWithBookings } from '@/store/api/postsApi';
import { useGetUnreadCountQuery } from '@/store/api/notificationsApi';
import { showAlert, showConfirm } from '@/lib/alert';
import { useRealtime } from '@/hooks/useRealtime';
import type { RootState } from '@/store';
import type { BookingStatus, ContractStatus, PostType } from '@/types/database';
import { Text } from '@/components/ui/Text';

type Tab = 'my_posts' | 'history';

const HISTORY_STATUSES: BookingStatus[] = ['completed', 'cancelled', 'no_show'];
const HISTORY_CONTRACT_STATUSES: ContractStatus[] = ['completed', 'cancelled'];
const MY_POSTS_EXCLUDED_STATUSES = ['completed', 'cancelled', 'expired'];
const ACTIVE_CONTRACT_STATUSES: ContractStatus[] = ['active'];
const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['pending', 'confirmed'];

// Reanimated's FadeInUp uses CSS animations on web that can get stuck at
// intermediate opacity when the parent re-renders (e.g. on theme change),
// producing a translucent "white film" over the cards. Skip on web.
const cardEntering = (index: number) =>
  Platform.OS === 'web' || index >= 8
    ? undefined
    : FadeInUp.duration(350).delay(index * 60);

export default function ActivityScreen() {
  const { c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const tabBarPad = useFloatingTabBarPad();
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab = params.tab === 'history' ? 'history' : 'my_posts';
  const [tab, setTab] = useState<Tab>(initialTab);
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  const activityPathname = usePathname();
  const activityLeftRoute = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      const left = activityLeftRoute.current;
      activityLeftRoute.current = null;
      if (
        left &&
        left.startsWith('/activity') &&
        left !== '/activity' &&
        left !== '/activity/' &&
        left !== '/activity/notifications'
      ) {
        setTab(initialTab);
      }
      return () => {
        activityLeftRoute.current = activityPathname;
      };
    }, [activityPathname, initialTab]),
  );

  const { data: unreadCount = 0 } = useGetUnreadCountQuery(userId ?? '', {
    skip: !userId,
    pollingInterval: 60_000,
  });

  const {
    data: bookings,
    isLoading: bookingsLoading,
    isFetching: bookingsFetching,
    refetch: refetchBookings,
  } = useGetMyBookingsQuery(
    { userId: userId ?? '', status: HISTORY_STATUSES },
    { skip: !userId || tab !== 'history' },
  );

  const {
    data: historyContracts,
    isLoading: contractsLoading,
    isFetching: contractsFetching,
    refetch: refetchContracts,
  } = useGetMyContractsQuery(
    { userId: userId ?? '', status: HISTORY_CONTRACT_STATUSES },
    { skip: !userId || tab !== 'history' },
  );

  const {
    data: myPosts,
    isLoading: postsLoading,
    isFetching: postsFetching,
    refetch: refetchPosts,
  } = useGetMyPostsQuery(
    { userId: userId ?? '' },
    { skip: !userId || tab !== 'my_posts' },
  );

  const {
    data: activeContracts,
    isLoading: activeContractsLoading,
    isFetching: activeContractsFetching,
    refetch: refetchActiveContracts,
  } = useGetMyContractsQuery(
    { userId: userId ?? '', status: ACTIVE_CONTRACT_STATUSES },
    { skip: !userId || tab !== 'my_posts' },
  );

  const {
    data: activeBookings,
    isLoading: activeBookingsLoading,
    isFetching: activeBookingsFetching,
    refetch: refetchActiveBookings,
  } = useGetMyBookingsQuery(
    { userId: userId ?? '', status: ACTIVE_BOOKING_STATUSES },
    { skip: !userId || tab !== 'my_posts' },
  );

  // Active contracts where user is booker/helper (not post author)
  const activeJobs = React.useMemo(() => {
    if (!activeContracts || !userId) return [];
    return activeContracts.filter(c => c.post?.author_id !== userId);
  }, [activeContracts, userId]);

  // Active bookings where user is booker/rider (not post author), excluding contracts already in activeJobs
  const userActiveBookings = React.useMemo(() => {
    if (!activeBookings || !userId) return [];
    const contractBookingIds = new Set(activeJobs.map(c => c.booking_id).filter(Boolean));
    return activeBookings.filter(b => b.post?.author_id !== userId && !contractBookingIds.has(b.id));
  }, [activeBookings, activeJobs, userId]);

  const [deletePost] = useDeletePostMutation();
  const [cancelBooking] = useCancelBookingMutation();

  const { subscribeToBookings } = useRealtime();

  useEffect(() => {
    const unsubBookings = subscribeToBookings();
    return () => {
      unsubBookings();
    };
  }, [subscribeToBookings]);

  const handleCancelBooking = useCallback(async (bookingId: string, title: string) => {
    const confirmed = await showConfirm(
      'Cancel Booking',
      `Cancel your booking for "${title}"?`,
    );
    if (!confirmed) return;

    try {
      await cancelBooking({ bookingId }).unwrap();
      showAlert('Cancelled', 'Your booking has been cancelled.');
    } catch (e: any) {
      const msg = e?.data?.error ?? e?.error ?? e?.message ?? 'Failed to cancel booking.';
      showAlert('Error', msg);
    }
  }, [cancelBooking]);

  const handleDeletePost = useCallback(async (postId: string, title: string) => {
    const confirmed = await showConfirm(
      'Delete Post',
      `Are you sure you want to delete "${title}"?`,
    );
    if (!confirmed) return;

    try {
      await deletePost(postId).unwrap();
    } catch (e: any) {
      const msg = e?.data?.error ?? e?.error ?? e?.message ?? 'Failed to delete post.';
      showAlert('Error', msg);
    }
  }, [deletePost]);

  const onRefresh = useCallback(() => {
    if (tab === 'my_posts') {
      refetchPosts();
      refetchActiveContracts();
      refetchActiveBookings();
    } else {
      refetchBookings();
      refetchContracts();
    }
  }, [tab, refetchPosts, refetchActiveContracts, refetchActiveBookings, refetchBookings, refetchContracts]);

  const renderBooking = useCallback(
    ({ item, index }: { item: BookingWithPost; index?: number }) => {
      const hasContract = item.contract?.[0]?.id;
      const canCancel = item.status === 'confirmed' || item.status === 'pending';

      const handlePress = () => {
        if (hasContract) {
          router.push(`/(tabs)/activity/${item.contract![0]!.id}`);
        } else {
          router.push(`/(tabs)/activity/post/${item.post_id}`);
        }
      };

      return (
        <Animated.View entering={cardEntering(index ?? 0)}>
          <Pressable onPress={handlePress}>
            <Card style={styles.bookingCard}>
              <View style={styles.cardHeader}>
                {item.post && <PostTypeBadge type={item.post.type} />}
                <StatusBadge status={item.status} />
              </View>

              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.post?.title ?? 'Untitled Post'}
              </Text>

              {item.post?.origin_address && item.post?.dest_address && (
                <View style={styles.routeInfo}>
                  <Icon name="map-pin" size={14} color={c.textMuted} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {item.post.origin_address} → {item.post.dest_address}
                  </Text>
                </View>
              )}

              {item.post?.departure_at && (
                <View style={styles.routeInfo}>
                  <Icon name="clock" size={14} color={c.textMuted} />
                  <Text style={styles.routeText}>{formatDeparture(item.post.departure_at)}</Text>
                </View>
              )}

              {item.post?.price_cents != null && (
                <View style={styles.routeInfo}>
                  <Icon name="receipt" size={14} color={c.textMuted} />
                  <Text style={styles.routeText}>{formatBZD(item.post.price_cents)}</Text>
                </View>
              )}

              <View style={styles.cardFooter}>
                <Text style={styles.footerText}>
                  {getBookingFooterLabel(item.post?.type, item.seats_booked, item.payment_method)}
                </Text>
                {canCancel ? (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleCancelBooking(item.id, item.post?.title ?? 'this booking');
                    }}
                    hitSlop={8}
                    style={styles.deleteButton}
                  >
                    <Icon name="x" size={16} color={colors.error} />
                    <Text style={styles.deleteText}>Cancel</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.timestamp}>{getTimeAgo(item.created_at)}</Text>
                )}
              </View>
            </Card>
          </Pressable>
        </Animated.View>
      );
    },
    [handleCancelBooking, styles, c],
  );

  const renderContract = useCallback(
    ({ item, index }: { item: ContractWithDetails; index?: number }) => (
      <Animated.View entering={cardEntering(index ?? 0)}>
        <Pressable onPress={() => router.push(`/(tabs)/activity/${item.id}`)}>
          <Card style={styles.bookingCard}>
            <View style={styles.cardHeader}>
              {item.post && <PostTypeBadge type={item.post.type} />}
              <ContractStatusBadge status={item.status} />
            </View>

            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.post?.title ?? 'Untitled Post'}
            </Text>

            {item.post?.origin_address && item.post?.dest_address && (
              <View style={styles.routeInfo}>
                <Icon name="map-pin" size={14} color={c.textMuted} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {item.post.origin_address} → {item.post.dest_address}
                </Text>
              </View>
            )}

            <View style={styles.cardFooter}>
              <Text style={styles.footerText}>
                {getBookingFooterLabel(item.post?.type, item.booking?.seats_booked, item.booking?.payment_method)}
              </Text>
              <Text style={styles.timestamp}>{getTimeAgo(item.created_at)}</Text>
            </View>
          </Card>
        </Pressable>
      </Animated.View>
    ),
    [styles, c],
  );

  // Build merged history list: contracts first, then bookings without a contract
  type HistoryItem =
    | { kind: 'contract'; data: ContractWithDetails }
    | { kind: 'booking'; data: BookingWithPost };

  const historyItems = React.useMemo((): HistoryItem[] => {
    if (tab !== 'history') return [];
    const items: HistoryItem[] = [];

    // Add completed/cancelled contracts
    const contractBookingIds = new Set<string>();
    if (historyContracts) {
      for (const c of historyContracts) {
        items.push({ kind: 'contract', data: c });
        if (c.booking_id) contractBookingIds.add(c.booking_id);
      }
    }

    // Add bookings that don't have a corresponding contract (e.g. cancelled before acceptance)
    if (bookings) {
      for (const b of bookings) {
        if (!contractBookingIds.has(b.id)) {
          items.push({ kind: 'booking', data: b });
        }
      }
    }

    // Sort newest first
    items.sort((a, b) => {
      const dateA = new Date(a.data.created_at).getTime();
      const dateB = new Date(b.data.created_at).getTime();
      return dateB - dateA;
    });

    return items;
  }, [tab, historyContracts, bookings]);

  const renderHistoryItem = useCallback(
    ({ item }: { item: HistoryItem }) => {
      if (item.kind === 'contract') return renderContract({ item: item.data });
      return renderBooking({ item: item.data });
    },
    [renderContract, renderBooking],
  );

  const getContractIdForPost = useCallback((post: MyPostWithBookings): string | null => {
    const confirmed = post.activeBookings.find(b => b.status === 'confirmed' && b.contract?.length > 0);
    return confirmed?.contract?.[0]?.id ?? null;
  }, []);

  const renderMyPost = useCallback(
    ({ item, index }: { item: MyPostWithBookings; index: number }) => {
      const joinerPreview = item.activeBookings.slice(0, 3);
      const showJoinerPreview = item.activeBookingsCount > 0;
      const contractId = getContractIdForPost(item);
      const effectiveStatus = getEffectivePostStatus(
        item.status,
        item.departure_at,
        item.route_duration_min,
        item.type,
      );
      const isActive = effectiveStatus === 'filled' || effectiveStatus === 'in_progress';
      const isManageableRoute = item.type === 'route_offer' && isActive;

      const handlePress = () => {
        if (isManageableRoute) {
          router.push(`/(tabs)/activity/trip/${item.id}`);
        } else if (isActive && contractId) {
          router.push(`/(tabs)/activity/${contractId}`);
        } else {
          router.push(`/(tabs)/activity/post/${item.id}`);
        }
      };

      return (
        <Animated.View entering={cardEntering(index)}>
          <Pressable onPress={handlePress}>
            <Card style={styles.bookingCard}>
            <View style={styles.cardHeader}>
              <PostTypeBadge type={item.type} />
              <PostStatusBadge status={effectiveStatus} />
            </View>

            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>

            {item.origin_address && item.dest_address && (
              <View style={styles.routeInfo}>
                <Icon name="map-pin" size={14} color={c.textMuted} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {item.origin_address} → {item.dest_address}
                </Text>
              </View>
            )}

            {item.departure_at && (
              <View style={styles.routeInfo}>
                <Icon name="clock" size={14} color={c.textMuted} />
                <Text style={styles.routeText}>{formatDeparture(item.departure_at)}</Text>
              </View>
            )}

            {item.price_cents != null && (
              <View style={styles.routeInfo}>
                <Icon name="receipt" size={14} color={c.textMuted} />
                <Text style={styles.routeText}>{formatBZD(item.price_cents)}</Text>
              </View>
            )}

            {showJoinerPreview && (
              <View style={styles.joinerPreview}>
                <View style={styles.joinerAvatars}>
                  {joinerPreview.map((booking) => (
                    <View key={booking.id} style={styles.joinerAvatarWrap}>
                      <Avatar
                        uri={booking.user?.avatar_url ?? null}
                        name={getBookingPreviewName(booking)}
                        size="sm"
                      />
                    </View>
                  ))}
                </View>
                <View style={styles.joinerPreviewTextWrap}>
                  <Text style={styles.joinerPreviewLabel}>
                    {getJoinerPreviewLabel(item.type, item.activeBookingsCount)}
                  </Text>
                  <Text style={styles.joinerPreviewNames} numberOfLines={1}>
                    {getJoinerPreviewNames(item.activeBookings)}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.cardFooter}>
              <Text style={styles.timestamp}>{getTimeAgo(item.created_at)}</Text>
              {!isActive && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeletePost(item.id, item.title);
                  }}
                  hitSlop={8}
                  style={styles.deleteButton}
                >
                  <Icon name="alert-triangle" size={16} color={colors.error} />
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              )}
            </View>
          </Card>
        </Pressable>
      </Animated.View>
      );
    },
    [handleDeletePost, getContractIdForPost, styles, c],
  );

  type SectionItem =
    | { kind: 'post'; data: MyPostWithBookings }
    | { kind: 'contract'; data: ContractWithDetails }
    | { kind: 'booking'; data: BookingWithPost };

  type ActivitySection = { title: string; data: SectionItem[] };

  const sections = React.useMemo((): ActivitySection[] => {
    const result: ActivitySection[] = [];

    // 1. Active bookings / requests (user is booker / rider)
    if (userActiveBookings.length > 0) {
      result.push({
        title: 'My Bookings & Requests',
        data: userActiveBookings.map(b => ({ kind: 'booking' as const, data: b })),
      });
    }

    // 2. Active jobs (user is booker/helper, not post author)
    if (activeJobs.length > 0) {
      result.push({
        title: 'Active Trips & Jobs',
        data: activeJobs.map(c => ({ kind: 'contract' as const, data: c })),
      });
    }

    if (myPosts) {
      const filtered = myPosts.filter((p) => {
        const effectiveStatus = getEffectivePostStatus(
          p.status,
          p.departure_at,
          p.route_duration_min,
          p.type,
        );
        return !MY_POSTS_EXCLUDED_STATUSES.includes(effectiveStatus);
      });
      const active: SectionItem[] = [];
      const regular: SectionItem[] = [];

      for (const post of filtered) {
        const item: SectionItem = { kind: 'post', data: post };
        const effectiveStatus = getEffectivePostStatus(
          post.status,
          post.departure_at,
          post.route_duration_min,
          post.type,
        );
        if (effectiveStatus === 'filled' || effectiveStatus === 'in_progress') {
          active.push(item);
        } else {
          regular.push(item);
        }
      }

      if (active.length > 0) result.push({ title: 'Active Listings', data: active });
      if (regular.length > 0) result.push({ title: 'My Listings', data: regular });
    }

    return result;
  }, [userActiveBookings, activeJobs, myPosts]);

  const renderSectionItem = useCallback(
    ({ item, index }: { item: SectionItem; index: number }) => {
      if (item.kind === 'contract') {
        return renderContract({ item: item.data, index });
      }
      if (item.kind === 'booking') {
        return renderBooking({ item: item.data, index });
      }
      return renderMyPost({ item: item.data, index });
    },
    [renderContract, renderBooking, renderMyPost],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ActivitySection }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    ),
    [styles],
  );

  const isLoading = tab === 'my_posts' ? (postsLoading || activeContractsLoading || activeBookingsLoading) : (bookingsLoading || contractsLoading);
  const isFetching = tab === 'my_posts' ? (postsFetching || activeContractsFetching || activeBookingsFetching) : (bookingsFetching || contractsFetching);

  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <View style={styles.centered}>
        <FeedListSkeleton count={3} />
      </View>
    );
  } else if (tab === 'my_posts') {
    content = (
      <SectionList
        sections={sections}
        renderItem={renderSectionItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => (item.kind === 'contract' ? `c_${item.data.id}` : item.kind === 'booking' ? `b_${item.data.id}` : `p_${item.data.id}`)}
        contentContainerStyle={[styles.feed, { paddingBottom: tabBarPad }]}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={onRefresh}
            tintColor={colors.accent.green}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="clipboard-list"
            title="No active activity"
            message="Rides you book and posts you create will appear here."
          />
        }
      />
    );
  } else {
    content = (
      <FlatList
        data={historyItems}
        renderItem={renderHistoryItem}
        keyExtractor={(item) => (item.kind === 'contract' ? `c_${item.data.id}` : `b_${item.data.id}`)}
        contentContainerStyle={[styles.feed, { paddingBottom: tabBarPad }]}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={onRefresh}
            tintColor={colors.accent.green}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="clipboard-list"
            title="No history yet"
            message="Your completed and cancelled jobs will show here."
          />
        }
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <Pressable onPress={() => router.navigate('/(tabs)/activity/notifications')} hitSlop={12} style={styles.bellButton}>
          <Icon name="bell" size={22} color={c.text} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </ScreenHeader>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'my_posts' && styles.tabActive]}
          onPress={() => setTab('my_posts')}
        >
          <Text style={[styles.tabText, tab === 'my_posts' && styles.tabTextActive]}>
            Active
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'history' && styles.tabActive]}
          onPress={() => setTab('history')}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </Pressable>
      </View>

      {content}
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const { c, isDark } = useTheme();
  const styles = createStyles(c);
  const config: Record<BookingStatus, { label: string; bg: string; fg: string }> = isDark
    ? {
        pending: { label: 'Pending', bg: 'rgba(255, 193, 7, 0.18)', fg: '#ffd76d' },
        confirmed: { label: 'Confirmed', bg: 'rgba(81, 193, 82, 0.18)', fg: colors.accent.neonGreen },
        completed: { label: 'Completed', bg: 'rgba(255, 255, 255, 0.08)', fg: c.textMuted },
        cancelled: { label: 'Cancelled', bg: 'rgba(211, 47, 47, 0.22)', fg: '#ff8a8a' },
        rejected: { label: 'Rejected', bg: 'rgba(211, 47, 47, 0.22)', fg: '#ff8a8a' },
        no_show: { label: 'No Show', bg: 'rgba(211, 47, 47, 0.22)', fg: '#ff8a8a' },
      }
    : {
        pending: { label: 'Pending', bg: '#fff8e1', fg: colors.warning },
        confirmed: { label: 'Confirmed', bg: '#e8f5e9', fg: colors.accent.green },
        completed: { label: 'Completed', bg: colors.neutral[200], fg: colors.forest[700] },
        cancelled: { label: 'Cancelled', bg: '#ffebee', fg: colors.error },
        rejected: { label: 'Rejected', bg: '#ffebee', fg: colors.error },
        no_show: { label: 'No Show', bg: '#ffebee', fg: colors.error },
      };

  const cfg = config[status];

  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.statusText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

function PostStatusBadge({ status }: { status: string }) {
  const { c, isDark } = useTheme();
  const styles = createStyles(c);
  const config: Record<string, { label: string; bg: string; fg: string }> = isDark
    ? {
        open: { label: 'Open', bg: 'rgba(81, 193, 82, 0.18)', fg: colors.accent.neonGreen },
        activated: { label: 'Activated', bg: 'rgba(73, 103, 246, 0.22)', fg: '#7da0ff' },
        in_progress: { label: 'In Progress', bg: 'rgba(255, 193, 7, 0.18)', fg: '#ffd76d' },
        filled: { label: 'Accepted', bg: 'rgba(73, 103, 246, 0.22)', fg: '#7da0ff' },
        completed: { label: 'Completed', bg: 'rgba(255, 255, 255, 0.08)', fg: c.textMuted },
        cancelled: { label: 'Cancelled', bg: 'rgba(211, 47, 47, 0.22)', fg: '#ff8a8a' },
        expired: { label: 'Expired', bg: 'rgba(255, 255, 255, 0.08)', fg: c.textMuted },
      }
    : {
        open: { label: 'Open', bg: '#e8f5e9', fg: colors.accent.green },
        activated: { label: 'Activated', bg: '#e3f2fd', fg: '#1565c0' },
        in_progress: { label: 'In Progress', bg: '#fff8e1', fg: colors.warning },
        filled: { label: 'Accepted', bg: '#e3f2fd', fg: '#1565c0' },
        completed: { label: 'Completed', bg: colors.neutral[200], fg: colors.forest[700] },
        cancelled: { label: 'Cancelled', bg: '#ffebee', fg: colors.error },
        expired: { label: 'Expired', bg: colors.neutral[200], fg: '#6b7264' },
      };

  const fallback = isDark
    ? { label: status, bg: 'rgba(255, 255, 255, 0.08)', fg: c.textMuted }
    : { label: status, bg: colors.neutral[200], fg: '#6b7264' };
  const cfg = config[status] ?? fallback;

  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.statusText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const { c, isDark } = useTheme();
  const styles = createStyles(c);
  const config: Record<ContractStatus, { label: string; bg: string; fg: string }> = isDark
    ? {
        active: { label: 'Active', bg: 'rgba(81, 193, 82, 0.18)', fg: colors.accent.neonGreen },
        completed: { label: 'Completed', bg: 'rgba(255, 255, 255, 0.08)', fg: c.textMuted },
        cancelled: { label: 'Cancelled', bg: 'rgba(211, 47, 47, 0.22)', fg: '#ff8a8a' },
        disputed: { label: 'Disputed', bg: 'rgba(255, 193, 7, 0.18)', fg: '#ffd76d' },
      }
    : {
        active: { label: 'Active', bg: '#e8f5e9', fg: colors.accent.green },
        completed: { label: 'Completed', bg: colors.neutral[200], fg: colors.forest[700] },
        cancelled: { label: 'Cancelled', bg: '#ffebee', fg: colors.error },
        disputed: { label: 'Disputed', bg: '#fff8e1', fg: colors.warning },
      };

  const cfg = config[status];

  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.statusText, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
}

function getBookingPreviewName(booking: ActiveBookingPreview) {
  return booking.user
    ? `${booking.user.first_name ?? ''} ${booking.user.last_name ?? ''}`.trim() || 'Unknown'
    : 'Unknown';
}

function getJoinerPreviewLabel(type: PostType, count: number) {
  switch (type) {
    case 'route_offer':
      return count === 1 ? 'Rider joined' : 'Riders joined';
    case 'route_request':
      return count === 1 ? 'Driver joined' : 'Drivers joined';
    case 'job':
      return count === 1 ? 'Applicant' : 'Applicants';
    case 'package':
      return count === 1 ? 'Courier assigned' : 'Couriers assigned';
    default:
      return count === 1 ? 'Helper accepted' : 'Helpers accepted';
  }
}

function getJoinerPreviewNames(bookings: ActiveBookingPreview[]) {
  const names = bookings.slice(0, 2).map(getBookingPreviewName);
  if (bookings.length <= 2) {
    return names.join(', ');
  }
  return `${names.join(', ')} +${bookings.length - 2} more`;
}

function getBookingFooterLabel(
  postType: PostType | undefined,
  seatsBooked: number | null | undefined,
  paymentMethod: string | null | undefined,
): string {
  let label: string;
  switch (postType) {
    case 'route_offer':
      label = `${seatsBooked ?? 1} seat${(seatsBooked ?? 1) !== 1 ? 's' : ''}`;
      break;
    case 'route_request':
      label = 'Drive offer';
      break;
    case 'errand':
      label = 'Errand';
      break;
    case 'package':
      label = 'Delivery';
      break;
    case 'job':
      label = 'Application';
      break;
    default:
      label = 'Booking';
  }
  if (paymentMethod) {
    const methodLabel = paymentMethod === 'ekyash' ? 'E-Kyash' : paymentMethod === 'cash' ? 'Cash' : paymentMethod;
    label += ` · ${methodLabel}`;
  }
  return label;
}


const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...type.h2.bold,
    color: c.text,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.accent.green,
  },
  tabText: {
    ...type.body.regular,
    color: c.textMuted,
  },
  tabTextActive: {
    ...type.body.bold,
    color: c.text,
  },
  centered: {
    flex: 1,
    padding: spacing.lg,
  },
  feed: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.sm,
    flexGrow: 1,
  },
  separator: {
    height: spacing.md,
  },
  sectionHeader: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionHeaderText: {
    ...type.body.bold,
    color: c.text,
    fontSize: 15,
  },
  bookingCard: {
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    ...type.body.bold,
    color: c.text,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeText: {
    ...type.bodySm.regular,
    color: c.textMuted,
    flex: 1,
  },
  joinerPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  joinerAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinerAvatarWrap: {
    marginRight: -8,
  },
  joinerPreviewTextWrap: {
    flex: 1,
    gap: 2,
    marginLeft: spacing.xs,
  },
  joinerPreviewLabel: {
    ...type.bodySm.bold,
    color: c.text,
  },
  joinerPreviewNames: {
    ...type.caption.regular,
    color: c.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  footerText: {
    ...type.bodySm.regular,
    color: c.textMuted,
  },
  timestamp: {
    ...type.caption.regular,
    color: c.textMuted,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  statusText: {
    ...type.caption.regular,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  deleteText: {
    ...type.caption.regular,
    color: colors.error,
    fontWeight: '600',
  },
  bellButton: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: colors.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
