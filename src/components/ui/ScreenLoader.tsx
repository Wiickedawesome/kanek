import React from 'react';
import { View, ActivityIndicator, StyleSheet, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';

interface ScreenLoaderProps {
  message?: string;
  style?: ViewStyle;
}

/**
 * Standard full-screen loading state.
 * Renders flex-1 centered ActivityIndicator in brand green.
 * Drop in as the only child of a screen wrapper while data is loading.
 */
export function ScreenLoader({ message, style }: ScreenLoaderProps) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size="large" color={colors.accent.green} />
      {message ? (
        <Text variant="bodySm" tone="muted" style={styles.message}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginTop: spacing.md,
  },
});
