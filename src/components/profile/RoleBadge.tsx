import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, type } from '@/theme';
import { Text } from '@/components/ui/Text';

type Role = string | null | undefined;

interface RoleBadgeProps {
  role: Role;
  /** Renders without `alignSelf: 'flex-start'`; useful inside a row. */
  inline?: boolean;
}

/**
 * Standard "Driver" / "Rider" pill used on profile screens and modals.
 * Green pill with dark forest-900 text — readable in both themes because
 * the background is fixed.
 */
export const RoleBadge = React.memo(function RoleBadge({ role, inline }: RoleBadgeProps) {
  const label = role === 'driver' ? 'Driver' : 'Rider';
  return (
    <View style={[styles.badge, inline ? null : styles.standalone]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.accent.green,
  },
  standalone: {
    alignSelf: 'flex-start',
  },
  text: {
    ...type.caption.regular,
    color: colors.forest[900],
    fontWeight: '600',
  },
});
