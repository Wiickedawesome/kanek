import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from '@/store';
import { useAuthListener } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { InAppToast } from '@/components/ui/InAppToast';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

const ROOT_STACK_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.neutral[50] },
} as const;

function RootLayoutInner() {
  useAuthListener();
  useNotifications();

  const [fontsLoaded] = useFonts({
    'WorkSans-Bold': require('../assets/fonts/WorkSans-Bold.ttf'),
    'WorkSans-Medium': require('../assets/fonts/WorkSans-Medium.ttf'),
    'Manrope-Regular': require('../assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Bold': require('../assets/fonts/Manrope-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="light" />
      <InAppToast />
      <Stack screenOptions={ROOT_STACK_OPTIONS} />
    </>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <RootLayoutInner />
      </SafeAreaProvider>
    </Provider>
  );
}
