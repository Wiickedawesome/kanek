import NotificationsScreen from '@/components/NotificationsScreen';

/** Activity tab notifications — back returns within the Activity stack. */
export default function ActivityNotificationsScreen() {
  return <NotificationsScreen backFallback="/(tabs)/activity/" />;
}
