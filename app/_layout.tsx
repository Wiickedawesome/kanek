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
import { colors, type, spacing, ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();
initSentry();
initMapbox();

function RootLayoutInner() {
  const { c, isDark } = useTheme();
  useAuthListener();
  useNotifications();

  const [fontsLoaded] = useFonts({
    'WorkSans-Bold': require('../assets/fonts/WorkSans-Bold.ttf'),
    'WorkSans-SemiBold': require('../assets/fonts/WorkSans-SemiBold.ttf'),
    'WorkSans-Medium': require('../assets/fonts/WorkSans-Medium.ttf'),
    'Manrope-Regular': require('../assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Medium': require('../assets/fonts/Manrope-Medium.ttf'),
    'Manrope-SemiBold': require('../assets/fonts/Manrope-SemiBold.ttf'),
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
      <StatusBar style={isDark ? 'light' : 'light'} backgroundColor={isDark ? c.bg : colors.forest[900]} translucent={false} />
      <InAppToast />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
    </>
  );
}

function ErrorFallback({ resetError }: { error: unknown; componentStack: string; eventId: string; resetError: () => void }) {
  const { c, isDark } = useTheme();
  const primaryBg = isDark ? colors.accent.neonGreen : colors.forest[600];
  const primaryFg = isDark ? colors.forest[900] : '#fff';
  return (
    <View style={[errorStyles.container, { backgroundColor: c.bg }]}>
      <Text style={[errorStyles.title, { color: c.text }]}>Something went wrong</Text>
      <Text style={[errorStyles.body, { color: c.textMuted }]}>The app ran into an unexpected error. Please try again.</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={[errorStyles.button, { backgroundColor: primaryBg }]}
        onPress={resetError}
      >
        <Text style={[errorStyles.buttonText, { color: primaryFg }]}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  title: { ...type.h2.bold, marginBottom: spacing.sm },
  body: { ...type.body.regular, textAlign: 'center', marginBottom: spacing.lg },
  button: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 999 },
  buttonText: { ...type.body.bold },
});

export default Sentry.wrap(function RootLayout() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Sentry.ErrorBoundary fallback={ErrorFallback}>
            <RootLayoutInner />
          </Sentry.ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </Provider>
  );
});
