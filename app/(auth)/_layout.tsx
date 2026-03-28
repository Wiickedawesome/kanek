import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

export default function AuthLayout() {
  const { session, isLoading } = useSelector((state: RootState) => state.auth);

  if (isLoading) return null;
  if (session) return <Redirect href="/(tabs)/explore" />;

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
