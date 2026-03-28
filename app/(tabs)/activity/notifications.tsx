import React, { useCallback } from 'react';
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
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { Card, EmptyState } from '@/components/ui';
import { getTimeAgo } from '@/lib/helpers';
import { colors, typography, spacing } from '@/theme';
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '@/store/api/notificationsApi';
import type { RootState } from '@/store';
import type { Database } from '@/types/database';

type NotificationRow = Database['public']['Tables']['notifications']['Row'];

const ICON_MAP: Record<string, React.ComponentProps<typeof Icon>['name']> = {
  payment_sent: 'receipt',
  payment_received: 'receipt',
  booking_confirmed: 'clipboard-list',
  booking_cancelled: 'clipboard-list',
  sos_sent: 'shield-alert',
  driver_verified: 'user',
  strike_issued: 'alert-triangle',
};

export default function NotificationsScreen() {
  const userId = useSelector((s: RootState) => s.auth.user?.id);
  const {
    data: notifications,
    isLoading,
    isFetching,
    refetch,
  } = useGetNotificationsQuery(userId ?? '', { skip: !userId });

  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();

  const handlePress = useCallback(
    (notification: NotificationRow) => {
      if (!notification.read) {
        markRead(notification.id);
      }
      const data = notification.data as { contractId?: string } | null;
      if (data?.contractId) {
        router.push(`/(tabs)/activity/${data.contractId}`);
      }
    },
    [markRead],
  );

  const renderNotification = useCallback(
    ({ item }: { item: NotificationRow }) => {
      const iconName = ICON_MAP[item.type] ?? 'compass';
      return (
        <Pressable onPress={() => handlePress(item)}>
          <Card style={[styles.notifCard, !item.read && styles.unreadCard]}>
            <View style={styles.notifRow}>
              <View style={[styles.iconCircle, !item.read && styles.iconCircleUnread]}>
                <Icon name={iconName} size={18} color={item.read ? colors.neutral[400] : colors.accent.green} />
              </View>
              <View style={styles.notifContent}>
                <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.body && (
                  <Text style={styles.notifBody} numberOfLines={2}>
                    {item.body}
                  </Text>
                )}
                <Text style={styles.notifTime}>{getTimeAgo(item.created_at)}</Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </View>
          </Card>
        </Pressable>
      );
    },
    [handlePress],
  );

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="navigation" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && userId ? (
          <Pressable onPress={() => markAllRead(userId)} hitSlop={12}>
            <Text style={styles.markAllText}>Read all</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent.green} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={colors.accent.green}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="clipboard-list"
              title="No notifications"
              message="You'll see booking updates, payments, and alerts here."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.forest[900],
  },
  headerTitle: { ...typography.h3, color: colors.neutral[0] },
  markAllText: { ...typography.body2Bold, color: colors.accent.green },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  separator: { height: spacing.sm },
  notifCard: { padding: spacing.md },
  unreadCard: { backgroundColor: '#f0fdf0' },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleUnread: { backgroundColor: '#e8f5e9' },
  notifContent: { flex: 1, gap: 2 },
  notifTitle: { ...typography.body2, color: colors.forest[900] },
  notifTitleUnread: { ...typography.body2Bold },
  notifBody: { ...typography.caption, color: colors.neutral[500] },
  notifTime: { ...typography.caption, color: colors.neutral[400], marginTop: 2 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.green,
    marginTop: 6,
  },
});
