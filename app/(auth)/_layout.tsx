import React, { useEffect } from 'react';
import { Stack, usePathname, router } from 'expo-router';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { normalizeAppPath } from '@/lib/helpers';

export default function AuthLayout() {
  const { session, isLoading, isComplete, nextAuthRoute } = useOnboardingStatus();
  const pathname = normalizeAppPath(usePathname());
  const nextPath = nextAuthRoute ? normalizeAppPath(nextAuthRoute) : null;

  // Use an effect instead of <Redirect> so the replace fires exactly once per
  // state transition. Rendering <Redirect> on every mismatched render can
  // cause a navigation update loop while expo-router finishes resolving the
  // new pathname, which surfaces as "Maximum update depth exceeded".
  useEffect(() => {
    if (isLoading || !session) return;
    if (nextAuthRoute && pathname !== nextPath) {
      router.replace(nextAuthRoute as any);
      return;
    }
    if (isComplete && pathname !== '/explore') {
      router.replace('/(tabs)/explore');
    }
  }, [isLoading, session, nextAuthRoute, pathname, nextPath, isComplete]);

  if (isLoading) return null;

  // Avoid rendering the wrong screen while a redirect is in-flight.
  if (session && nextAuthRoute && pathname !== nextPath) return null;
  if (session && isComplete && pathname !== '/explore') return null;

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
