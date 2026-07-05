import React from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { Text } from '@/components/ui/Text';

const LOGO_IMAGE = require('../../assets/icon.png');

export default function WelcomeScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Image source={LOGO_IMAGE} style={styles.logo} accessibilityRole="image" accessibilityLabel="Kanek logo" />
        <Text style={styles.brand}>kanek</Text>
        <Text style={styles.tagline}>Move Belize Forward</Text>
        <Text style={styles.description}>
          A community board where Belizeans post mobility needs and others respond.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.replace({ pathname: '/(auth)/login', params: { signup: '1' } })}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.replace({ pathname: '/(auth)/login', params: { signup: '0' } })}
        >
          <Text style={styles.secondaryButtonText}>I already have an account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
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
  logo: {
    width: 120,
    height: 120,
    marginBottom: spacing.lg,
  },
  brand: {
    ...type.h1.bold,
    fontSize: 48,
    lineHeight: 56,
    color: colors.accent.green,
    textAlign: 'center',
  },
  tagline: {
    ...type.h2.bold,
    color: '#ffffff',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  description: {
    ...type.body.regular,
    color: 'rgba(255,255,255,0.78)',
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
    ...type.body.bold,
    color: '#ffffff',
  },
  secondaryButton: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryButtonText: {
    ...type.body.bold,
    color: 'rgba(255,255,255,0.78)',
  },
});
