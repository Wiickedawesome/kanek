import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { ScreenHeader } from '@/components/ui';
import { TopographicBg } from '@/components/ui';
import { Icon } from '@/components/icons';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Card, EmptyState } from '@/components/ui';
import { formatBZD, formatDeparture, getTimeAgo } from '@/lib/helpers';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useGetMyBookingsQuery, useGetMyContractsQuery, useCancelBookingMutation, type BookingWithPost, type ContractWithDetails } from '@/store/api/bookingsApi';
import { useGetMyPostsQuery, useDeletePostMutation, type ActiveBookingPreview, type MyPostWithBookings } from '@/store/api/postsApi';
import { showAlert, showConfirm } from '@/lib/alert';
import { useRealtime } from '@/hooks/useRealtime';
import type { RootState } from '@/store';
import type { BookingStatus, ContractStatus, PostType } from '@/types/database';

type Tab = 'active' | 'history' | 'my_posts';

const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'confirmed'];
const HISTORY_STATUSES: BookingStatus[] = ['completed', 'cancelled', 'no_show'];
const ACTIVE_CONTRACT_STATUSES: ContractStatus[] = ['active'];
const HISTORY_CONTRACT_STATUSES: ContractStatus[] = ['completed', 'cancelled'];
const MY_POSTS_EXCLUDED_STATUSES = ['completed', 'cancelled', 'expired'];

export default function ActivityScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab = (params.tab === 'active' || params.tab === 'history') ? params.tab : 'my_posts';
  const [tab, setTab] = useState<Tab>(initialTab);
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  const unreadCount = useSelector((state: RootState) => state.notifications.unreadCount);

  const statuses = tab === 'active' ? ACTIVE_STATUSES : HISTORY_STATUSES;

  const {
    data: bookings,
    isLoading: bookingsLoading,
    isFetching: bookingsFetching,
    refetch: refetchBookings,
  } = useGetMyBookingsQuery(
    { userId: userId ?? '', status: statuses },
    { skip: !userId || tab === 'my_posts' },
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
    data: activeContracts,
    isLoading: activeContractsLoading,
    isFetching: activeContractsFetching,
    refetch: refetchActiveContracts,
  } = useGetMyContractsQuery(
    { userId: userId ?? '', status: ACTIVE_CONTRACT_STATUSES },
    { skip: !userId || tab !== 'active' },
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
    } else if (tab === 'history') {
      refetchBookings();
      refetchContracts();
    } else {
      refetchBookings();
      refetchActiveContracts();
    }
  }, [tab, refetchPosts, refetchBookings, refetchContracts, refetchActiveContracts]);

  const renderBooking = useCallback(
    ({ item }: { item: BookingWithPost }) => {
      const hasContract = item.contract?.id;
      const canCancel = item.status === 'confirmed' || item.status === 'pending';

      const handlePress = () => {
        if (hasContract) {
          router.push(`/(tabs)/activity/${item.contract!.id}`);
        } else {
          router.push(`/(tabs)/activity/post/${item.post_id}`);
        }
      };

      return (
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
                <Icon name="map-pin" size={14} color={colors.forest[400]} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {item.post.origin_address} → {item.post.dest_address}
                </Text>
              </View>
            )}

            {item.post?.departure_at && (
              <View style={styles.routeInfo}>
                <Icon name="clock" size={14} color={colors.forest[400]} />
                <Text style={styles.routeText}>{formatDeparture(item.post.departure_at)}</Text>
              </View>
            )}

            <View style={styles.cardFooter}>
              <Text style={styles.footerText}>
                {item.seats_booked} seat{item.seats_booked !== 1 ? 's' : ''}
                {item.payment_method ? ` · ${item.payment_method}` : ''}
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
      );
    },
    [handleCancelBooking],
  );

  const renderContract = useCallback(
    ({ item }: { item: ContractWithDetails }) => (
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
              <Icon name="map-pin" size={14} color={colors.forest[400]} />
              <Text style={styles.routeText} numberOfLines={1}>
                {item.post.origin_address} → {item.post.dest_address}
              </Text>
            </View>
          )}

          <View style={styles.cardFooter}>
            <Text style={styles.footerText}>
              {item.booking?.seats_booked ?? 1} seat{(item.booking?.seats_booked ?? 1) !== 1 ? 's' : ''}
              {item.booking?.payment_method ? ` · ${item.booking.payment_method}` : ''}
            </Text>
            <Text style={styles.timestamp}>{getTimeAgo(item.created_at)}</Text>
          </View>
        </Card>
      </Pressable>
    ),
    [],
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

  // Build merged active list: active contracts + active bookings (dedup)
  type ActiveItem =
    | { kind: 'contract'; data: ContractWithDetails }
    | { kind: 'booking'; data: BookingWithPost };

  const activeItems = React.useMemo((): ActiveItem[] => {
    if (tab !== 'active') return [];
    const items: ActiveItem[] = [];

    const contractBookingIds = new Set<string>();
    if (activeContracts) {
      for (const c of activeContracts) {
        items.push({ kind: 'contract', data: c });
        if (c.booking_id) contractBookingIds.add(c.booking_id);
      }
    }

    if (bookings) {
      for (const b of bookings) {
        if (!contractBookingIds.has(b.id)) {
          items.push({ kind: 'booking', data: b });
        }
      }
    }

    items.sort((a, b) => {
      const dateA = new Date(a.data.created_at).getTime();
      const dateB = new Date(b.data.created_at).getTime();
      return dateB - dateA;
    });

    return items;
  }, [tab, activeContracts, bookings]);

  const renderHistoryItem = useCallback(
    ({ item }: { item: HistoryItem }) => {
      if (item.kind === 'contract') return renderContract({ item: item.data });
      return renderBooking({ item: item.data });
    },
    [renderContract, renderBooking],
  );

  const renderActiveItem = useCallback(
    ({ item }: { item: ActiveItem }) => {
      if (item.kind === 'contract') return renderContract({ item: item.data });
      return renderBooking({ item: item.data });
    },
    [renderContract, renderBooking],
  );

  const renderMyPost = useCallback(
    ({ item }: { item: MyPostWithBookings }) => {
      const joinerPreview = item.activeBookings.slice(0, 3);
      const showJoinerPreview = item.activeBookingsCount > 0;

      return (
        <Pressable onPress={() => router.push(`/(tabs)/activity/post/${item.id}`)}>
          <Card style={styles.bookingCard}>
            <View style={styles.cardHeader}>
              <PostTypeBadge type={item.type} />
              <PostStatusBadge status={item.status} />
            </View>

            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>

            {item.origin_address && item.dest_address && (
              <View style={styles.routeInfo}>
                <Icon name="map-pin" size={14} color={colors.forest[400]} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {item.origin_address} → {item.dest_address}
                </Text>
              </View>
            )}

            {item.departure_at && (
              <View style={styles.routeInfo}>
                <Icon name="clock" size={14} color={colors.forest[400]} />
                <Text style={styles.routeText}>{formatDeparture(item.departure_at)}</Text>
              </View>
            )}

            {item.price_cents != null && (
              <View style={styles.routeInfo}>
                <Icon name="receipt" size={14} color={colors.forest[400]} />
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
            </View>
          </Card>
        </Pressable>
      );
    },
    [handleDeletePost],
  );

  const filteredPosts = React.useMemo(() => {
    if (!myPosts) return [];
    return myPosts.filter((p) => !MY_POSTS_EXCLUDED_STATUSES.includes(p.status));
  }, [myPosts]);

  const isLoading = tab === 'my_posts' ? postsLoading : tab === 'history' ? (bookingsLoading || contractsLoading) : (bookingsLoading || activeContractsLoading);
  const isFetching = tab === 'my_posts' ? postsFetching : tab === 'history' ? (bookingsFetching || contractsFetching) : (bookingsFetching || activeContractsFetching);

  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </View>
    );
  } else if (tab === 'my_posts') {
    content = (
      <FlatList
        data={filteredPosts}
        renderItem={renderMyPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.feed}
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
            title="No posts yet"
            message="Posts you create will appear here so you can manage them."
          />
        }
      />
    );
  } else if (tab === 'history') {
    content = (
      <FlatList
        data={historyItems}
        renderItem={renderHistoryItem}
        keyExtractor={(item) => (item.kind === 'contract' ? `c_${item.data.id}` : `b_${item.data.id}`)}
        contentContainerStyle={styles.feed}
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
  } else {
    content = (
      <FlatList
        data={activeItems}
        renderItem={renderActiveItem}
        keyExtractor={(item) => (item.kind === 'contract' ? `c_${item.data.id}` : `b_${item.data.id}`)}
        contentContainerStyle={styles.feed}
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
            title="No active bookings"
            message="When you book a ride or accept an errand, it will appear here."
          />
        }
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopographicBg />
      <ScreenHeader style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <Pressable onPress={() => router.push('/(tabs)/activity/notifications')} hitSlop={12} style={styles.bellButton}>
          <Icon name="bell" size={22} color={colors.neutral[0]} />
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
            My Posts
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
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
  const config: Record<BookingStatus, { label: string; bg: string; fg: string }> = {
    pending: { label: 'Pending', bg: '#fff8e1', fg: colors.warning },
    confirmed: { label: 'Confirmed', bg: '#e8f5e9', fg: colors.accent.green },
    completed: { label: 'Completed', bg: colors.neutral[200], fg: colors.forest[500] },
    cancelled: { label: 'Cancelled', bg: '#ffebee', fg: colors.error },
    no_show: { label: 'No Show', bg: '#ffebee', fg: colors.error },
  };

  const c = config[status];

  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

function PostStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string; fg: string }> = {
    open: { label: 'Open', bg: '#e8f5e9', fg: colors.accent.green },
    activated: { label: 'Activated', bg: '#e3f2fd', fg: '#1565c0' },
    in_progress: { label: 'In Progress', bg: '#fff8e1', fg: colors.warning },
    filled: { label: 'Accepted', bg: '#e3f2fd', fg: '#1565c0' },
    completed: { label: 'Completed', bg: colors.neutral[200], fg: colors.forest[500] },
    cancelled: { label: 'Cancelled', bg: '#ffebee', fg: colors.error },
    expired: { label: 'Expired', bg: colors.neutral[200], fg: colors.neutral[500] },
  };

  const c = config[status] ?? { label: status, bg: colors.neutral[200], fg: colors.neutral[500] };

  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const config: Record<ContractStatus, { label: string; bg: string; fg: string }> = {
    active: { label: 'Active', bg: '#e8f5e9', fg: colors.accent.green },
    completed: { label: 'Completed', bg: colors.neutral[200], fg: colors.forest[500] },
    cancelled: { label: 'Cancelled', bg: '#ffebee', fg: colors.error },
    disputed: { label: 'Disputed', bg: '#fff8e1', fg: colors.warning },
  };

  const c = config[status];

  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusText, { color: c.fg }]}>{c.label}</Text>
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


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[0],
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
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
    ...typography.body1,
    color: colors.neutral[400],
  },
  tabTextActive: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feed: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  separator: {
    height: spacing.md,
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
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeText: {
    ...typography.body2,
    color: colors.forest[500],
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
    ...typography.body2Bold,
    color: colors.forest[900],
  },
  joinerPreviewNames: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  footerText: {
    ...typography.body2,
    color: colors.forest[500],
  },
  timestamp: {
    ...typography.caption,
    color: colors.neutral[400],
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  deleteText: {
    ...typography.caption,
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
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: colors.neutral[0],
    fontSize: 10,
    fontWeight: '700',
  },
});
