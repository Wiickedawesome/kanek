import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, typography, spacing, borderRadius } from '@/theme';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.brand}>kanek</Text>
        <Text style={styles.tagline}>Move Belize Forward</Text>
        <Text style={styles.description}>
          A community board where Belizeans post mobility needs — rides, routes,
          errands, deliveries — and others respond.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/phone-verify')}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/phone-verify')}
        >
          <Text style={styles.secondaryButtonText}>I already have an account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.forest[900],
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {
    ...typography.h1,
    fontSize: 48,
    lineHeight: 56,
    color: colors.accent.green,
    textAlign: 'center',
  },
  tagline: {
    ...typography.h2,
    color: colors.neutral[0],
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  description: {
    ...typography.body1,
    color: colors.neutral[400],
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  actions: {
    paddingBottom: spacing.xxl,
  },
  primaryButton: {
    backgroundColor: colors.forest[600],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...typography.body1Bold,
    color: colors.neutral[0],
  },
  secondaryButton: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryButtonText: {
    ...typography.body1Bold,
    color: colors.neutral[400],
  },
});
