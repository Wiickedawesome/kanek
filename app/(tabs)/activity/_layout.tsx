import React, { useCallback, useRef } from 'react';
import { Stack, useFocusEffect, usePathname, router } from 'expo-router';

/**
 * Activity tab stack. When the user leaves the tab while a sub-screen
 * (notifications, messages, post detail...) sits on top of the stack,
 * returning to the tab restores that sub-screen — leaving the user "stuck"
 * needing a back-press. We remember the route the user was on when they
 * blurred the tab, and reset to the tab root on refocus if it was a sub-screen.
 */
export default function ActivityLayout() {
  const pathname = usePathname();
  const routeAtBlur = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Refocus: if the tab was left on a sub-screen, reset to the tab root.
      const left = routeAtBlur.current;
      routeAtBlur.current = null;
      if (left && left.startsWith('/activity') && left !== '/activity' && left !== '/activity/') {
        router.replace('/(tabs)/activity/');
      }

      // Blur: remember where the user was.
      return () => {
        routeAtBlur.current = pathname;
      };
    }, [pathname]),
  );

  return <Stack screenOptions={{ headerShown: false }} />;
}
