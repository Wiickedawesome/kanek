import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { formatDistance, formatDuration } from '@/lib/mapbox';
import { formatBZD } from '@/lib/helpers';

interface RouteInfoCardProps {
  distanceKm: number;
  durationMinutes: number;
  fuelCostCents: number;
}

interface RouteInfoLoadingProps {
  loading: true;
}

type Props = RouteInfoCardProps | RouteInfoLoadingProps;

function isLoading(props: Props): props is RouteInfoLoadingProps {
  return 'loading' in props && props.loading;
}

/** Uber-style route summary card: distance · time · fuel cost */
export function RouteInfoCard(props: Props) {
  if (isLoading(props)) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={colors.accent.green} />
        <Text style={styles.loadingText}>Calculating route…</Text>
      </View>
    );
  }

  const { distanceKm, durationMinutes, fuelCostCents } = props;

  return (
    <View style={styles.card}>
      <View style={styles.stat}>
        <Icon name="navigation" size={18} color={colors.accent.green} />
        <Text style={styles.value}>{formatDistance(distanceKm)}</Text>
        <Text style={styles.label}>Distance</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.stat}>
        <Icon name="clock" size={18} color={colors.accent.green} />
        <Text style={styles.value}>{formatDuration(durationMinutes)}</Text>
        <Text style={styles.label}>Drive time</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.stat}>
        <Icon name="fuel" size={18} color={colors.accent.green} />
        <Text style={styles.value}>{formatBZD(fuelCostCents)}</Text>
        <Text style={styles.label}>Est. gas</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  value: {
    ...typography.body1,
    fontWeight: '700',
    color: colors.forest[900],
  },
  label: {
    ...typography.caption,
    color: colors.forest[400],
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.neutral[200],
  },
  loadingText: {
    ...typography.body2,
    color: colors.forest[400],
  },
});
