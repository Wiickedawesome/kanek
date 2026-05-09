import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing, borderRadius, type, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { Text } from '@/components/ui/Text';

type Role = string | null | undefined;

interface RoleBadgeProps {
  role: Role;
  /** Renders without `alignSelf: 'flex-start'`; useful inside a row. */
  inline?: boolean;
}

/**
 * Standard "Driver" / "Rider" pill used on profile screens and modals.
 * Uses the canonical chip-selected tokens so it matches every other
 * solid pill in the app in both light and dark mode.
 */
export const RoleBadge = React.memo(function RoleBadge({ role, inline }: RoleBadgeProps) {
  const { c } = useTheme();
  const styles = createStyles(c);
  const label = role === 'driver' ? 'Driver' : 'Rider';
  return (
    <View style={[styles.badge, inline ? null : styles.standalone]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
});

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
    badge: {
      paddingHorizontal: spacing.md,
      paddingVertical: 2,
      borderRadius: borderRadius.pill,
      backgroundColor: c.chipSelectedBg,
    },
    standalone: {
      alignSelf: 'flex-start',
    },
    text: {
      ...type.caption.regular,
      color: c.chipSelectedText,
      fontWeight: '600',
    },
  });
