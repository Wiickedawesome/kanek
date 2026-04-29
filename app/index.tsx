import { useEffect } from 'react';
import { router, usePathname } from 'expo-router';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { normalizeAppPath } from '@/lib/helpers';

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

  if (isLoading) return null;
  if (pathname !== '/') return null;

  return null;
}
