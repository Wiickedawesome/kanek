import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { spacing, borderRadius, colors } from '@/theme';
import { Text } from '@/components/ui/Text';
import { formatBZD } from '@/lib/helpers';

interface PriceBadgeProps {
  cents: number;
  /** Background color of the pill. Defaults to `colors.accent.green`. */
  color?: string;
  /** Text color. Defaults to inverse (white). */
  textColor?: string;
  /** Text shown before the amount, e.g. "Offering", "Fee", "Delivery". */
  prefix?: string;
  /** Text shown after the amount, e.g. "/seat", "/hr". */
  suffix?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Standard payout / price pill used by all post cards.
 * Renders a pill with `tone="inverse"` text on a colored background.
 */
export const PriceBadge = React.memo(function PriceBadge({
  cents,
  color = colors.accent.green,
  textColor,
  prefix,
  suffix,
  style,
}: PriceBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: color }, style]}>
      <Text
        variant="caption"
        weight="semibold"
        tone={textColor ? undefined : 'inverse'}
        style={textColor ? { color: textColor } : undefined}
      >
        {prefix ? `${prefix} ` : ''}
        {formatBZD(cents)}
        {suffix ?? ''}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
    marginLeft: 'auto',
  },
});
