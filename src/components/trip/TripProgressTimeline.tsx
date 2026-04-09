import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, typography, spacing } from '@/theme';
import { getEventIcon, getEventSequence } from '@/lib/tripEvents';
import type { ContractEvent } from '@/store/api/contractEventsApi';
import type { PostType } from '@/types/database';

interface Props {
  postType: PostType;
  events: ContractEvent[];
}

export function TripProgressTimeline({ postType, events }: Props) {
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

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  title: {
    ...typography.body2Bold,
    color: colors.forest[400],
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
    backgroundColor: colors.neutral[200],
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
    backgroundColor: colors.neutral[200],
  },
  content: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.md,
  },
  label: {
    ...typography.body1,
  },
  labelCompleted: {
    color: colors.forest[900],
    fontWeight: '600',
  },
  labelPending: {
    color: colors.neutral[400],
  },
  timestamp: {
    ...typography.caption,
    color: colors.forest[400],
    marginTop: 2,
  },
});
