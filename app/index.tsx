import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Image } from 'expo-image';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { normalizeAppPath } from '@/lib/helpers';
import { colors } from '@/theme';

// While this route decides where to navigate next, the explore tab (a live
// Mapbox map) can be briefly visible underneath. Rendering a solid branded
// placeholder keeps the tile grid + location radar from flashing at launch.
function LaunchPlaceholder() {
  return (
    <View style={styles.root}>
      <Image source={require('../assets/icon.png')} style={styles.logo} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.forest[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 160,
    height: 160,
  },
});

export default function Index() {
  const { session, isLoading, nextAuthRoute } = useOnboardingStatus();
  const pathname = normalizeAppPath(usePathname());

  useEffect(() => {
    if (isLoading || pathname !== '/') return;

    if (!session) {
      router.replace('/(auth)/welcome');
      return;
    }

    if (nextAuthRoute) {
      router.replace(nextAuthRoute as any);
      return;
    }

    router.replace('/(tabs)/explore');
  }, [isLoading, nextAuthRoute, pathname, session]);

  return <LaunchPlaceholder />;
}
