import React, { useEffect } from 'react';
import { Tabs, usePathname, router } from 'expo-router';
import { Compass, PlusCircle, ClipboardList, User } from '@/components/icons';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { useGetUnreadCountQuery } from '@/store/api/notificationsApi';
import { normalizeAppPath } from '@/lib/helpers';
import { FloatingTabBar } from '@/components/ui/FloatingTabBar';

export default function TabLayout() {
  const { session, isLoading, isComplete, nextAuthRoute } = useOnboardingStatus();
  const pathname = normalizeAppPath(usePathname());
  const nextPath = nextAuthRoute ? normalizeAppPath(nextAuthRoute) : null;

  // Use an effect instead of <Redirect> so replaces fire exactly once per
  // state transition. Rendering <Redirect> every render while pathname is
  // still catching up causes "Maximum update depth exceeded" loops.
  useEffect(() => {
    if (isLoading) return;
    if (!session && pathname !== '/welcome') {
      router.replace('/(auth)/welcome');
      return;
    }
    if (!isComplete && nextAuthRoute && pathname !== nextPath) {
      router.replace(nextAuthRoute as any);
    }
  }, [isLoading, session, pathname, isComplete, nextAuthRoute, nextPath]);

  if (isLoading) return null;
  if (!session && pathname !== '/welcome') return null;
  if (!isComplete && nextAuthRoute && pathname !== nextPath) return null;

  const userId = session?.user?.id;

  return <TabNavigator userId={userId} />;
}

function TabNavigator({ userId }: { userId?: string }) {
  const { data: unreadCount } = useGetUnreadCountQuery(userId ?? '', {
    skip: !userId,
    pollingInterval: 60_000,
  });
  const badge = unreadCount && unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : undefined;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
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
          tabBarBadge: badge,
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
