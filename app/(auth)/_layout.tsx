import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';

export default function AuthLayout() {
  const { session, isLoading } = useSelector((state: RootState) => state.auth);

  const { data: profile, isLoading: profileLoading } = useGetMyProfileQuery(
    session?.user?.id ?? '',
    { skip: !session?.user?.id },
  );

  if (isLoading) return null;

  if (session) {
    // Wait for profile check before deciding
    if (profileLoading) return null;

    // Onboarding complete — redirect to main app
    if (profile?.first_name) {
      return <Redirect href="/(tabs)/explore" />;
    }

    // Profile incomplete — stay in auth stack for onboarding
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
