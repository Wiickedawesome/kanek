import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Tabs, usePathname, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass, PlusCircle, ClipboardList, User } from '@/components/icons';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { useGetUnreadCountQuery } from '@/store/api/notificationsApi';
import { normalizeAppPath } from '@/lib/helpers';
import { colors } from '@/theme';

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
  const insets = useSafeAreaInsets();
  const { data: unreadCount } = useGetUnreadCountQuery(userId ?? '', {
    skip: !userId,
    pollingInterval: 60_000,
  });
  const badge = unreadCount && unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : undefined;
  const bottomInset = Platform.OS === 'web' ? 0 : insets.bottom;
  const tabBarHeight = 54 + Math.max(bottomInset, 10);
  const tabBarPaddingBottom = Math.max(bottomInset, 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent.green,
        tabBarInactiveTintColor: colors.forest[400],
        tabBarStyle: Platform.select({
          web: {
            backgroundColor: 'rgba(246, 246, 244, 0.82)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderTopWidth: 1,
            borderTopColor: 'rgba(0, 0, 0, 0.06)',
            height: tabBarHeight,
            paddingBottom: 10,
            paddingTop: 4,
          } as any,
          default: {
            backgroundColor: colors.neutral[50],
            borderTopWidth: 1,
            borderTopColor: 'rgba(0, 0, 0, 0.06)',
            elevation: 0,
            height: tabBarHeight,
            paddingBottom: tabBarPaddingBottom,
            paddingTop: 4,
          },
        }),
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
          tabBarBadge: badge,
          tabBarBadgeStyle: {
            backgroundColor: '#d32f2f',
            color: '#fff',
            fontSize: 10,
            fontFamily: 'Manrope-Bold',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            lineHeight: 18,
          },
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
