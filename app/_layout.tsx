import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
import { initSentry, Sentry } from '@/lib/sentry';
import { initMapbox } from '@/lib/mapboxBootstrap';
import { colors, typography, spacing } from '@/theme';

SplashScreen.preventAutoHideAsync();
initSentry();
initMapbox();

const ROOT_STACK_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.neutral[100] },
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
      <StatusBar style="light" backgroundColor={colors.forest[900]} translucent={false} />
      <InAppToast />
      <Stack screenOptions={ROOT_STACK_OPTIONS} />
    </>
  );
}

function ErrorFallback({ resetError }: { error: unknown; componentStack: string; eventId: string; resetError: () => void }) {
  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.body}>The app ran into an unexpected error. Please try again.</Text>
      <TouchableOpacity style={errorStyles.button} onPress={resetError}>
        <Text style={errorStyles.buttonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.neutral[100] },
  title: { ...typography.h2, color: colors.forest[900], marginBottom: spacing.sm },
  body: { ...typography.body1, color: colors.forest[400], textAlign: 'center', marginBottom: spacing.lg },
  button: { backgroundColor: colors.forest[600], paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 999 },
  buttonText: { ...typography.body1Bold, color: '#fff' },
});

export default Sentry.wrap(function RootLayout() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <Sentry.ErrorBoundary fallback={ErrorFallback}>
          <RootLayoutInner />
        </Sentry.ErrorBoundary>
      </SafeAreaProvider>
    </Provider>
  );
});
