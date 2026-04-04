import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/theme';
import { Icon } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { getTimeAgo } from '@/lib/helpers';

interface RoadReportCardProps {
  report: {
    id: string;
    type: string;
    description: string | null;
    upvotes: number | null;
    created_at: string;
  };
  onPress?: () => void;
}

const reportTypeLabels: Record<string, string> = {
  accident: 'Accident',
  checkpoint: 'Checkpoint',
  traffic: 'Traffic',
  flooding: 'Flooding',
  construction: 'Construction',
  road_damage: 'Road Damage',
};

export function RoadReportCard({ report, onPress }: RoadReportCardProps) {
  const age = getTimeAgo(report.created_at);

  return (
    <Card onPress={onPress} style={styles.card} variant="glass">
      <View style={styles.headerRow}>
        <Icon name="alert-triangle" size={18} color={colors.warning} />
        <Text style={styles.type}>
          Road Report {'\u00b7'} {reportTypeLabels[report.type] ?? report.type}
        </Text>
        <Text style={styles.age}>{age}</Text>
      </View>
      {report.description && (
        <Text style={styles.description} numberOfLines={2}>
          {report.description}
        </Text>
      )}
      <Text style={styles.upvotes}>
        Reported by {report.upvotes ?? 0} {(report.upvotes ?? 0) === 1 ? 'user' : 'users'}
      </Text>
    </Card>
  );
}


const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  type: {
    ...typography.body2Bold,
    color: colors.forest[900],
    flex: 1,
  },
  age: {
    ...typography.caption,
    color: colors.neutral[400],
  },
  description: {
    ...typography.body2,
    color: colors.forest[500],
  },
  upvotes: {
    ...typography.caption,
    color: colors.neutral[500],
  },
});
