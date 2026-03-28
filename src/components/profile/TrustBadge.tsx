import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius } from '@/theme';

interface TrustBadgeProps {
  ratingAvg: number;
  punctualityPct: number;
  totalStrikes?: number;
  /** Tap to view full trust profile */
  onPress?: () => void;
  /** Compact = single line; full = row with labels */
  variant?: 'compact' | 'full';
}

export function TrustBadge({
  ratingAvg,
  punctualityPct,
  totalStrikes = 0,
  onPress,
  variant = 'compact',
}: TrustBadgeProps) {
  const content =
    variant === 'compact' ? (
      <View style={styles.compactRow}>
        <Icon name="star" size={14} color={colors.accent.green} />
        <Text style={styles.compactValue}>{ratingAvg.toFixed(1)}</Text>
        <View style={styles.compactDot} />
        <Icon name="clock" size={14} color={colors.forest[400]} />
        <Text style={styles.compactValue}>{punctualityPct}%</Text>
        {totalStrikes > 0 && (
          <>
            <View style={styles.compactDot} />
            <Icon name="shield-alert" size={14} color={colors.error} />
            <Text style={[styles.compactValue, styles.strikeValue]}>{totalStrikes}</Text>
          </>
        )}
      </View>
    ) : (
      <View style={styles.fullRow}>
        <View style={styles.metric}>
          <Icon name="star" size={16} color={colors.accent.green} />
          <Text style={styles.metricValue}>{ratingAvg.toFixed(1)}</Text>
          <Text style={styles.metricLabel}>rating</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metric}>
          <Icon name="clock" size={16} color={colors.forest[400]} />
          <Text style={styles.metricValue}>{punctualityPct}%</Text>
          <Text style={styles.metricLabel}>on time</Text>
        </View>
        {totalStrikes > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.metric}>
              <Icon name="shield-alert" size={16} color={colors.error} />
              <Text style={[styles.metricValue, styles.strikeValue]}>{totalStrikes}</Text>
              <Text style={styles.metricLabel}>strikes</Text>
            </View>
          </>
        )}
      </View>
    );

  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={8}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactValue: {
    ...typography.caption,
    color: colors.forest[500],
    fontWeight: '600',
  },
  compactDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.neutral[300],
    marginHorizontal: 2,
  },
  strikeValue: {
    color: colors.error,
  },
  fullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  metric: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  metricValue: {
    ...typography.body2Bold,
    color: colors.forest[900],
  },
  metricLabel: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: colors.neutral[300],
  },
});
