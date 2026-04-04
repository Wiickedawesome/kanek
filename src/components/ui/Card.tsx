import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable, StyleProp } from 'react-native';
import { colors, borderRadius, spacing } from '@/theme';
import { GlassView } from './GlassView';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  variant?: 'default' | 'glass';
}

export function Card({ children, onPress, style, padded = true, variant = 'default' }: CardProps) {
  const Wrapper = variant === 'glass' ? GlassView : View;
  const wrapperStyle =
    variant === 'glass'
      ? [styles.glassCard, padded && styles.padded, style]
      : [styles.card, padded && styles.padded, style];

  const content = <Wrapper style={wrapperStyle}>{children}</Wrapper>;

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  glassCard: {
    borderRadius: borderRadius.md,
  },
  padded: {
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.92,
  },
});
