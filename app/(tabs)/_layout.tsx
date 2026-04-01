import React from 'react';
import { Redirect, Tabs, usePathname } from 'expo-router';
import { Compass, PlusCircle, ClipboardList, User } from '@/components/icons';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { normalizeAppPath } from '@/lib/helpers';
import { colors } from '@/theme';

export default function TabLayout() {
  const { session, isLoading, isComplete, nextAuthRoute } = useOnboardingStatus();
  const pathname = normalizeAppPath(usePathname());
  const nextPath = nextAuthRoute ? normalizeAppPath(nextAuthRoute) : null;

  if (isLoading) return null;
  if (!session && pathname !== '/welcome') return <Redirect href="/(auth)/welcome" />;
  if (!isComplete && nextAuthRoute && pathname !== nextPath) return <Redirect href={nextAuthRoute as any} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent.green,
        tabBarInactiveTintColor: colors.forest[400],
        tabBarStyle: {
          backgroundColor: colors.neutral[0],
          borderTopColor: colors.neutral[200],
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Manrope-Regular',
        },
      }}
    >
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => <Compass size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: 'Post',
          tabBarIcon: ({ color, size }) => <PlusCircle size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
