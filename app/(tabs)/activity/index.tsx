import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  SectionList,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { ScreenHeader, FeedListSkeleton } from '@/components/ui';
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

type Tab = 'my_posts' | 'history';

const HISTORY_STATUSES: BookingStatus[] = ['completed', 'cancelled', 'no_show'];
const HISTORY_CONTRACT_STATUSES: ContractStatus[] = ['completed', 'cancelled'];
const MY_POSTS_EXCLUDED_STATUSES = ['completed', 'cancelled', 'expired'];

export default function ActivityScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab = params.tab === 'history' ? 'history' : 'my_posts';
  const [tab, setTab] = useState<Tab>(initialTab);
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  const unreadCount = useSelector((state: RootState) => state.notifications.unreadCount);

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
    } else {
      refetchBookings();
      refetchContracts();
    }
  }, [tab, refetchPosts, refetchBookings, refetchContracts]);

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
        <Animated.View entering={(index ?? 0) < 8 ? FadeInUp.duration(350).delay((index ?? 0) * 60) : undefined}>
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
    [handleCancelBooking],
  );

  const renderContract = useCallback(
    ({ item, index }: { item: ContractWithDetails; index?: number }) => (
      <Animated.View entering={(index ?? 0) < 8 ? FadeInUp.duration(350).delay((index ?? 0) * 60) : undefined}>
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
                {getBookingFooterLabel(item.post?.type, item.booking?.seats_booked, item.booking?.payment_method)}
              </Text>
              <Text style={styles.timestamp}>{getTimeAgo(item.created_at)}</Text>
            </View>
          </Card>
        </Pressable>
      </Animated.View>
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
      const isActive = item.status === 'filled';

      const handlePress = () => {
        if (isActive && contractId) {
          router.push(`/(tabs)/activity/${contractId}`);
        } else {
          router.push(`/(tabs)/activity/post/${item.id}`);
        }
      };

      return (
        <Animated.View entering={index < 8 ? FadeInUp.duration(350).delay(index * 60) : undefined}>
          <Pressable onPress={handlePress}>
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
    [handleDeletePost, getContractIdForPost],
  );

  type MyPostSection = { title: string; data: MyPostWithBookings[] };

  const sections = React.useMemo((): MyPostSection[] => {
    if (!myPosts) return [];
    const filtered = myPosts.filter((p) => !MY_POSTS_EXCLUDED_STATUSES.includes(p.status));
    const active: MyPostWithBookings[] = [];
    const regular: MyPostWithBookings[] = [];

    for (const post of filtered) {
      if (post.status === 'filled') {
        active.push(post);
      } else {
        regular.push(post);
      }
    }

    const result: MyPostSection[] = [];
    if (active.length > 0) result.push({ title: 'Active', data: active });
    if (regular.length > 0) result.push({ title: 'My Posts', data: regular });
    return result;
  }, [myPosts]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: MyPostSection }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    ),
    [],
  );

  const isLoading = tab === 'my_posts' ? postsLoading : (bookingsLoading || contractsLoading);
  const isFetching = tab === 'my_posts' ? postsFetching : (bookingsFetching || contractsFetching);

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
        renderItem={renderMyPost}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.feed}
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
            title="No posts yet"
            message="Posts you create will appear here so you can manage them."
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
        contentContainerStyle={styles.feed}
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
    rejected: { label: 'Rejected', bg: '#ffebee', fg: colors.error },
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


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
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
    padding: spacing.lg,
  },
  feed: {
    padding: spacing.lg,
    paddingBottom: 80,
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
    ...typography.body1Bold,
    color: colors.forest[900],
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
