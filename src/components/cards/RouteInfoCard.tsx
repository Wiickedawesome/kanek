import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { Text } from '@/components/ui/Text';
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
  const { c } = useTheme();
  const styles = createStyles(c);
  if (isLoading(props)) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={colors.accent.green} />
        <Text variant="bodySm" tone="muted">Calculating route…</Text>
      </View>
    );
  }

  const { distanceKm, durationMinutes, fuelCostCents } = props;

  return (
    <View style={styles.card}>
      <View style={styles.stat}>
        <Icon name="navigation" size={18} color={colors.accent.green} />
        <Text variant="body" weight="bold">{formatDistance(distanceKm)}</Text>
        <Text variant="caption" tone="muted">Distance</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.stat}>
        <Icon name="clock" size={18} color={colors.accent.green} />
        <Text variant="body" weight="bold">{formatDuration(durationMinutes)}</Text>
        <Text variant="caption" tone="muted">Drive time</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.stat}>
        <Icon name="fuel" size={18} color={colors.accent.green} />
        <Text variant="body" weight="bold">{formatBZD(fuelCostCents)}</Text>
        <Text variant="caption" tone="muted">Est. gas</Text>
      </View>
    </View>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      gap: spacing.md,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs,
    },
    divider: {
      width: 1,
      height: 40,
      backgroundColor: c.border,
    },
  });
