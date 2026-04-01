import React from 'react';
import { Redirect, Stack, usePathname } from 'expo-router';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { normalizeAppPath } from '@/lib/helpers';

export default function AuthLayout() {
  const { session, isLoading, isComplete, nextAuthRoute } = useOnboardingStatus();
  const pathname = normalizeAppPath(usePathname());
  const nextPath = nextAuthRoute ? normalizeAppPath(nextAuthRoute) : null;

  if (isLoading) return null;

  if (session && nextAuthRoute && pathname !== nextPath) {
    return <Redirect href={nextAuthRoute as any} />;
  }

  if (session && isComplete && pathname !== '/explore') {
    return <Redirect href="/(tabs)/explore" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
