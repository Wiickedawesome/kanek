import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/theme';

interface RatingBreakdownProps {
  ratingAvg: number;
  punctualityPct: number;
  strikesSoft: number;
  strikesHard: number;
}

export function RatingBreakdown({
  ratingAvg,
  punctualityPct,
  strikesSoft,
  strikesHard,
}: RatingBreakdownProps) {
  const totalStrikes = strikesSoft + strikesHard;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.metric}>
          <Icon name="star" size={20} color={colors.accent.green} />
          <Text style={styles.value}>{ratingAvg.toFixed(1)}</Text>
          <Text style={styles.label}>Rating</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metric}>
          <Icon name="clock" size={20} color={colors.forest[400]} />
          <Text style={styles.value}>{punctualityPct}%</Text>
          <Text style={styles.label}>On time</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metric}>
          <Icon
            name="shield-alert"
            size={20}
            color={strikesHard > 0 ? colors.error : colors.neutral[400]}
          />
          <Text style={[styles.value, strikesHard > 0 && styles.errorValue]}>
            {totalStrikes}
          </Text>
          <Text style={styles.label}>Strikes</Text>
        </View>
      </View>

      {strikesHard > 0 && (
        <Text style={styles.warning}>
          {strikesHard} hard strike{strikesHard !== 1 ? 's' : ''} — account at risk
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    ...shadows.sm,
  },
  metric: { flex: 1, alignItems: 'center', gap: spacing.xs },
  value: { ...typography.h3, color: colors.forest[900] },
  errorValue: { color: colors.error },
  label: { ...typography.caption, color: colors.neutral[500] },
  divider: { width: 1, backgroundColor: colors.neutral[200] },
  warning: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
  },
});
