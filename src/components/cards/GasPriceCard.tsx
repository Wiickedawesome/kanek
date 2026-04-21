import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/theme';
import { Icon } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { getTimeAgo } from '@/lib/helpers';
import { reverseGeocode } from '@/lib/mapbox';

interface GasPriceCardProps {
  gasPrice: {
    id: string;
    station_name: string;
    station_lat?: number | null;
    station_lng?: number | null;
    regular_cents: number | null;
    premium_cents: number | null;
    diesel_cents: number | null;
    verified_count: number | null;
    reported_at: string;
  };
  onPress?: () => void;
}

function formatPrice(cents: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)} BZD/gal`;
}


export const GasPriceCard = React.memo(function GasPriceCard({ gasPrice, onPress }: GasPriceCardProps) {
  const age = getTimeAgo(gasPrice.reported_at);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const lat = gasPrice.station_lat;
    const lng = gasPrice.station_lng;
    if (lat == null || lng == null) return;
    reverseGeocode(lat, lng)
      .then((name) => { if (!cancelled) setAddress(name); })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [gasPrice.station_lat, gasPrice.station_lng]);

  const showAddress =
    address &&
    address.trim().toLowerCase() !== gasPrice.station_name.trim().toLowerCase();

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.headerRow}>
        <Icon name="fuel" size={18} color={colors.forest[600]} />
        <Text style={styles.stationName} numberOfLines={1}>
          {gasPrice.station_name}
        </Text>
        <Text style={styles.age}>{age}</Text>
      </View>

      {showAddress ? (
        <View style={styles.addressRow}>
          <Icon name="map-pin" size={14} color={colors.neutral[500]} />
          <Text style={styles.address} numberOfLines={2}>{address}</Text>
        </View>
      ) : null}

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
        Verified by {gasPrice.verified_count ?? 0}{' '}
        {(gasPrice.verified_count ?? 0) === 1 ? 'user' : 'users'}
      </Text>
    </Card>
  );
});

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
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingLeft: 26,
  },
  address: {
    ...typography.caption,
    color: colors.neutral[500],
    flex: 1,
    lineHeight: 16,
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
