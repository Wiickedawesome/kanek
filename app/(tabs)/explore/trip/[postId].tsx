import DriverTripManageScreen from '@/components/trip/DriverTripManageScreen';

/**
 * Explore-tab wrapper for the driver trip screen.
 *
 * Expo Router binds a route to its owning tab, so pushing
 * `/(tabs)/activity/trip/...` from the feed would switch the user to Activity
 * and put Activity's history under their back button. Rendering the same shared
 * screen from an Explore-owned route keeps navigation inside Explore.
 */
export default function ExploreTripManageRoute() {
  return <DriverTripManageScreen backFallback="/(tabs)/explore/" />;
}
