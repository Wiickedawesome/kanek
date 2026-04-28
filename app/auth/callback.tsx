import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { consumeAuthRedirectUrl } from '@/lib/authRedirect';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { colors, spacing, typography } from '@/theme';

type CallbackParams = Record<string, string | string[] | undefined>;

function buildCallbackUrl(params: CallbackParams) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      searchParams.set(key, value);
      continue;
    }

    if (Array.isArray(value) && value[0]) {
      searchParams.set(key, value[0]);
    }
  }

  const query = searchParams.toString();
  return query ? `kanek://auth/callback?${query}` : 'kanek://auth/callback';
}

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams() as CallbackParams;
  const callbackUrl = useMemo(() => buildCallbackUrl(params), [params]);
  const { session, isLoading, nextAuthRoute } = useOnboardingStatus();
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [hasHandledCallback, setHasHandledCallback] = useState(false);

  useEffect(() => {
    let isMounted = true;

    consumeAuthRedirectUrl(callbackUrl)
      .then((result) => {
        if (!isMounted) return;
        setCallbackError(result.error?.message ?? null);
        setHasHandledCallback(true);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setCallbackError(error instanceof Error ? error.message : 'Sign-in could not be completed.');
        setHasHandledCallback(true);
      });

    return () => {
      isMounted = false;
    };
  }, [callbackUrl]);

  useEffect(() => {
    if (!hasHandledCallback || isLoading) return;

    if (callbackError) {
      router.replace('/(auth)/login');
      return;
    }

    if (nextAuthRoute) {
      router.replace(nextAuthRoute as any);
      return;
    }

    if (session) {
      router.replace('/(tabs)/explore');
      return;
    }

    router.replace('/(auth)/login');
  }, [callbackError, hasHandledCallback, isLoading, nextAuthRoute, session]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent.green} />
      <Text style={styles.title}>Completing sign-in</Text>
      <Text style={styles.body}>
        {callbackError ?? 'Please wait while we finish connecting your account.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.neutral[50],
  },
  title: {
    ...typography.h2,
    color: colors.forest[900],
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  body: {
    ...typography.body1,
    color: colors.neutral[500],
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});