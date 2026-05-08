import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, type, spacing, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { getEventIcon, getEventSequence } from '@/lib/tripEvents';
import type { ContractEvent } from '@/store/api/contractEventsApi';
import type { PostType } from '@/types/database';
import { Text } from '@/components/ui/Text';

interface Props {
  postType: PostType;
  events: ContractEvent[];
}

export function TripProgressTimeline({ postType, events }: Props) {
  const { c } = useTheme();
  const styles = createStyles(c);
  const sequence = getEventSequence(postType);
  const completedTypes = new Set(events.map((e) => e.event_type));

  if (sequence.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Progress</Text>
      {sequence.map((step, index) => {
        const completed = completedTypes.has(step.type);
        const matchingEvent = events.find((e) => e.event_type === step.type);
        const isLast = index === sequence.length - 1;

        return (
          <View key={step.type} style={styles.row}>
            {/* Vertical line + dot */}
            <View style={styles.indicator}>
              <View
                style={[
                  styles.dot,
                  completed ? styles.dotCompleted : styles.dotPending,
                ]}
              >
                {completed && (
                  <Icon
                    name={getEventIcon(step.type)}
                    size={12}
                    color={colors.neutral[0]}
                  />
                )}
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    completed ? styles.lineCompleted : styles.linePending,
                  ]}
                />
              )}
            </View>

            {/* Label + timestamp */}
            <View style={styles.content}>
              <Text
                style={[
                  styles.label,
                  completed ? styles.labelCompleted : styles.labelPending,
                ]}
              >
                {step.label}
              </Text>
              {matchingEvent && (
                <Text style={styles.timestamp}>
                  {new Date(matchingEvent.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: { marginBottom: spacing.lg },
  title: {
    ...type.bodySm.bold,
    color: c.textMuted,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    minHeight: 40,
  },
  indicator: {
    width: 28,
    alignItems: 'center',
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCompleted: {
    backgroundColor: colors.accent.green,
  },
  dotPending: {
    backgroundColor: c.border,
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 18,
  },
  lineCompleted: {
    backgroundColor: colors.accent.green,
  },
  linePending: {
    backgroundColor: c.border,
  },
  content: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.md,
  },
  label: {
    ...type.body.regular,
  },
  labelCompleted: {
    color: c.text,
    fontWeight: '600',
  },
  labelPending: {
    color: c.textMuted,
  },
  timestamp: {
    ...type.caption.regular,
    color: c.textMuted,
    marginTop: 2,
  },
});
