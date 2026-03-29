import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Card, EmptyState } from '@/components/ui';
import { formatBZD, formatDeparture, getTimeAgo } from '@/lib/helpers';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useGetMyBookingsQuery, type BookingWithPost } from '@/store/api/bookingsApi';
import { useGetMyPostsQuery, useDeletePostMutation, type PostWithAuthor } from '@/store/api/postsApi';
import type { RootState } from '@/store';
import type { BookingStatus } from '@/types/database';

type Tab = 'active' | 'history' | 'my_posts';

const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'confirmed'];
const HISTORY_STATUSES: BookingStatus[] = ['completed', 'cancelled', 'no_show'];

export default function ActivityScreen() {
  const [tab, setTab] = useState<Tab>('my_posts');
  const userId = useSelector((state: RootState) => state.auth.user?.id);

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
    data: myPosts,
    isLoading: postsLoading,
    isFetching: postsFetching,
    refetch: refetchPosts,
  } = useGetMyPostsQuery(
    { userId: userId ?? '' },
    { skip: !userId || tab !== 'my_posts' },
  );

  const [deletePost] = useDeletePostMutation();

  const handleDeletePost = useCallback(async (postId: string, title: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Are you sure you want to delete "${title}"?`)
      : await new Promise<boolean>((resolve) =>
          Alert.alert(
            'Delete Post',
            `Are you sure you want to delete "${title}"?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ],
          ),
        );

    if (!confirmed) return;

    try {
      await deletePost(postId).unwrap();
    } catch (e: any) {
      const msg = e?.data?.error ?? e?.error ?? e?.message ?? 'Failed to delete post.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  }, [deletePost]);

  const onRefresh = useCallback(() => {
    if (tab === 'my_posts') {
      refetchPosts();
    } else {
      refetchBookings();
    }
  }, [tab, refetchPosts, refetchBookings]);

  const renderBooking = useCallback(
    ({ item }: { item: BookingWithPost }) => (
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
          <Text style={styles.timestamp}>{getTimeAgo(item.created_at)}</Text>
        </View>
      </Card>
    ),
    [],
  );

  const renderMyPost = useCallback(
    ({ item }: { item: PostWithAuthor }) => (
      <Pressable onPress={() => router.push(`/explore/${item.id}`)}>
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
    ),
    [handleDeletePost],
  );

  const isLoading = tab === 'my_posts' ? postsLoading : bookingsLoading;
  const isFetching = tab === 'my_posts' ? postsFetching : bookingsFetching;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>

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

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent.green} />
        </View>
      ) : tab === 'my_posts' ? (
        <FlatList
          data={myPosts}
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
      ) : (
        <FlatList
          data={bookings}
          renderItem={renderBooking}
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
              title={tab === 'active' ? 'No active bookings' : 'No history yet'}
              message={
                tab === 'active'
                  ? 'When you book a ride or accept an errand, it will appear here.'
                  : 'Your completed and cancelled bookings will show here.'
              }
            />
          }
        />
      )}
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
    filled: { label: 'Filled', bg: '#fff8e1', fg: colors.warning },
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


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.forest[900],
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
});
