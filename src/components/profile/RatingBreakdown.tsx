import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, type, spacing, borderRadius, shadows, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';

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
  const { c } = useTheme();
  const styles = createStyles(c);
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
          <Icon name="clock" size={20} color={c.textMuted} />
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

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    ...shadows.sm,
  },
  metric: { flex: 1, alignItems: 'center', gap: spacing.xs },
  value: { ...type.h3.bold, color: c.text },
  errorValue: { color: colors.error },
  label: { ...type.caption.regular, color: c.textMuted },
  divider: { width: 1, backgroundColor: c.border },
  warning: {
    ...type.caption.regular,
    color: colors.error,
    textAlign: 'center',
  },
});
