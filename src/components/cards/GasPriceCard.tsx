import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, useTheme } from '@/theme';
import { Icon } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
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

function formatPrice(cents: number | null): { value: string; unit: string } {
  if (cents == null) return { value: '—', unit: '' };
  return { value: `$${(cents / 100).toFixed(2)}`, unit: 'BZD/gal' };
}

function PriceCol({ label, cents }: { label: string; cents: number | null }) {
  const { value, unit } = formatPrice(cents);
  return (
    <View style={styles.priceCol}>
      <Text variant="caption" tone="muted" style={styles.center}>{label}</Text>
      <Text variant="body" weight="bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.center}>
        {value}
      </Text>
      {unit ? <Text variant="caption" tone="muted" style={styles.center}>{unit}</Text> : null}
    </View>
  );
}

export const GasPriceCard = React.memo(function GasPriceCard({ gasPrice, onPress }: GasPriceCardProps) {
  const { c } = useTheme();
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
        <Icon name="fuel" size={18} color={colors.accent.green} />
        <Text variant="bodySm" weight="bold" numberOfLines={1} style={styles.flex1}>
          {gasPrice.station_name}
        </Text>
        <Text variant="caption" tone="muted">{age}</Text>
      </View>

      {showAddress ? (
        <View style={styles.addressRow}>
          <Icon name="map-pin" size={14} color={c.textMuted} />
          <Text variant="caption" tone="muted" numberOfLines={2} style={styles.flex1}>
            {address}
          </Text>
        </View>
      ) : null}

      <View style={[styles.pricesRow, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
        <PriceCol label="Regular" cents={gasPrice.regular_cents} />
        <View style={[styles.priceDivider, { backgroundColor: c.border }]} />
        <PriceCol label="Premium" cents={gasPrice.premium_cents} />
        <View style={[styles.priceDivider, { backgroundColor: c.border }]} />
        <PriceCol label="Diesel" cents={gasPrice.diesel_cents} />
      </View>

      <Text variant="caption" tone="muted">
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
  flex1: { flex: 1 },
  center: { textAlign: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingLeft: 26,
  },
  pricesRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  priceCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    gap: 2,
  },
  priceDivider: {
    width: 1,
    alignSelf: 'stretch',
  },
});
