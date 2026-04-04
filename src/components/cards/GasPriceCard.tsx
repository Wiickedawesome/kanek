import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/theme';
import { Icon } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { getTimeAgo } from '@/lib/helpers';

interface GasPriceCardProps {
  gasPrice: {
    id: string;
    station_name: string;
    regular_cents: number | null;
    premium_cents: number | null;
    diesel_cents: number | null;
    verified_count: number;
    reported_at: string;
  };
  onPress?: () => void;
}

function formatPrice(cents: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)} BZD/gal`;
}


export function GasPriceCard({ gasPrice, onPress }: GasPriceCardProps) {
  const age = getTimeAgo(gasPrice.reported_at);

  return (
    <Card onPress={onPress} style={styles.card} variant="glass">
      <View style={styles.headerRow}>
        <Icon name="fuel" size={18} color={colors.forest[600]} />
        <Text style={styles.stationName} numberOfLines={1}>
          {gasPrice.station_name}
        </Text>
        <Text style={styles.age}>{age}</Text>
      </View>

      <View style={styles.pricesRow}>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>Regular</Text>
          <Text style={styles.priceValue}>{formatPrice(gasPrice.regular_cents)}</Text>
        </View>
        <View style={styles.priceDivider} />
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>Premium</Text>
          <Text style={styles.priceValue}>{formatPrice(gasPrice.premium_cents)}</Text>
        </View>
        <View style={styles.priceDivider} />
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>Diesel</Text>
          <Text style={styles.priceValue}>{formatPrice(gasPrice.diesel_cents)}</Text>
        </View>
      </View>

      <Text style={styles.verified}>
        Verified by {gasPrice.verified_count}{' '}
        {gasPrice.verified_count === 1 ? 'user' : 'users'}
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
  stationName: {
    ...typography.body2Bold,
    color: colors.forest[900],
    flex: 1,
  },
  age: {
    ...typography.caption,
    color: colors.neutral[400],
  },
  pricesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  priceLabel: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  priceValue: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  priceDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.neutral[200],
  },
  verified: {
    ...typography.caption,
    color: colors.neutral[500],
  },
});
