import NotificationsScreen from '@/components/NotificationsScreen';

/** Explore tab notifications wrapper — keeps the user inside the Explore tab. */
export default function ExploreNotificationsScreen() {
  return <NotificationsScreen backFallback="/(tabs)/explore/" />;
}
