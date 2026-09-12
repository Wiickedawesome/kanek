import React, { useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { Card, EmptyState, ScreenHeader, ScreenLoader, useFloatingTabBarPad } from '@/components/ui';
import { getTimeAgo, navigateToNotification } from '@/lib/helpers';
import { colors, type, spacing, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '@/store/api/notificationsApi';
import type { RootState } from '@/store';
import type { Database } from '@/types/database';
import { Text } from '@/components/ui/Text';

type NotificationRow = Database['public']['Tables']['notifications']['Row'];

const ICON_MAP: Record<string, React.ComponentProps<typeof Icon>['name']> = {
  payment_sent: 'receipt',
  payment_received: 'receipt',
  booking_confirmed: 'clipboard-list',
  booking_cancelled: 'clipboard-list',
  contract_completed: 'star',
  new_booking: 'user',
  new_applicant: 'user',
  applicant_accepted: 'clipboard-list',
  applicant_rejected: 'alert-triangle',
  booking_accepted: 'clipboard-list',
  booking_rejected: 'alert-triangle',
  match_confirmed: 'clipboard-list',
  contract_event: 'navigation',
  new_message: 'send',
  post_cancelled: 'alert-triangle',
  errand_accepted: 'package',
  job_application: 'clipboard-list',
  job_accepted: 'clipboard-list',
  job_match_confirmed: 'clipboard-list',
  route_activated: 'navigation',
  sos_sent: 'shield-alert',
  driver_verified: 'user',
  driver_verification_rejected: 'alert-triangle',
  rider_verified: 'user',
  rider_document_rejected: 'alert-triangle',
  account_suspended: 'shield-alert',
  account_reactivated: 'circle-dot',
  post_removed: 'alert-triangle',
  strike_received: 'alert-triangle',
  strike_issued: 'alert-triangle',
};

export default function NotificationsScreen() {
  const { c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const tabBarPad = useFloatingTabBarPad();
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
      navigateToNotification(
        notification.type,
        notification.data as Record<string, unknown> | null,
      );
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
                <Icon name={iconName} size={18} color={item.read ? '#6b7264' : colors.accent.green} />
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
    [handlePress, styles],
  );

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Notifications"
        onBack={() => router.navigate('/(tabs)/activity/')}
        right={
          unreadCount > 0 && userId ? (
            <Pressable onPress={() => markAllRead(userId)} hitSlop={12}>
              <Text style={styles.markAllText}>Read all</Text>
            </Pressable>
          ) : (
            <View style={{ width: 60 }} />
          )
        }
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ScreenLoader />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarPad }]}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
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


const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: { ...type.h3.bold, color: c.text },
  markAllText: { ...type.bodySm.bold, color: colors.accent.green },
  list: { padding: spacing.lg, paddingBottom: spacing.lg },
  separator: { height: spacing.sm },
  notifCard: { padding: spacing.md },
  unreadCard: {
    backgroundColor:
      c.scheme === 'dark' ? 'rgba(81, 193, 82, 0.10)' : '#f0fdf0',
    borderColor:
      c.scheme === 'dark' ? 'rgba(81, 193, 82, 0.30)' : 'rgba(81, 193, 82, 0.40)',
    borderWidth: 1,
  },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleUnread: { backgroundColor: 'rgba(81, 193, 82, 0.18)' },
  notifContent: { flex: 1, gap: 2 },
  notifTitle: { ...type.bodySm.regular, color: c.text },
  notifTitleUnread: { ...type.bodySm.bold },
  notifBody: { ...type.caption.regular, color: c.textMuted },
  notifTime: { ...type.caption.regular, color: c.textMuted, marginTop: 2 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.green,
    marginTop: 6,
  },
});
