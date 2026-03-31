import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '@/components/icons';
import { safeGoBack } from '@/lib/helpers';
import { ExploreMapContent } from '@/components/map/ExploreMapContent';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useGetPostsQuery, type PostWithAuthor } from '@/store/api/postsApi';
import { useGetRoadReportsQuery, useGetGasPricesQuery } from '@/store/api/reportsApi';

/** Colors for each post type pin */
const PIN_COLORS: Record<string, string> = {
  route_offer: colors.accent.green,
  route_request: colors.accent.blue,
  errand: colors.warning,
  package: '#9c27b0',
  job: colors.forest[500],
};

const REPORT_PIN_COLOR = colors.error;
const GAS_PIN_COLOR = colors.forest[600];

export default function ExploreMapScreen() {
  const recenterRef = useRef<(() => void) | null>(null);
  const { data: posts } = useGetPostsQuery({});
  const { data: roadReports } = useGetRoadReportsQuery();
  const { data: gasPrices } = useGetGasPricesQuery();

  const postPoints = useMemo(
    () =>
      (posts ?? [])
        .filter(
          (p): p is PostWithAuthor & { origin_lat: number; origin_lng: number } =>
            p.origin_lat != null && p.origin_lng != null,
        )
        .map((p) => ({
          id: p.id,
          lng: p.origin_lng,
          lat: p.origin_lat,
          color: PIN_COLORS[p.type] ?? colors.forest[400],
          label: p.title,
        })),
    [posts],
  );

  const reportPoints = useMemo(
    () =>
      (roadReports ?? []).map((r) => ({
        id: r.id,
        lng: r.lng,
        lat: r.lat,
        color: REPORT_PIN_COLOR,
        label: r.type,
      })),
    [roadReports],
  );

  const gasPoints = useMemo(
    () =>
      (gasPrices ?? []).map((g) => ({
        id: g.id,
        lng: g.station_lng,
        lat: g.station_lat,
        color: GAS_PIN_COLOR,
        label: g.station_name,
      })),
    [gasPrices],
  );

  const handlePinPress = (id: string) => {
    router.push(`/(tabs)/explore/${id}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack('/(tabs)/explore/')} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Map View</Text>
        <Pressable onPress={() => router.push('/(tabs)/explore/')} hitSlop={12}>
          <Icon name="clipboard-list" size={24} color={colors.neutral[0]} />
        </Pressable>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <ExploreMapContent
          posts={postPoints}
          reports={reportPoints}
          gasStations={gasPoints}
          onPinPress={handlePinPress}
          onRecenterRef={recenterRef}
        />

        {/* Legend */}
        <View style={styles.legend}>
          <LegendRow color={colors.accent.green} label="Driver Offering" />
          <LegendRow color={colors.accent.blue} label="Riders Looking" />
          <LegendRow color={colors.warning} label="Errand" />
          <LegendRow color="#9c27b0" label="Package" />
          <LegendRow color={colors.forest[500]} label="Job" />
          <LegendRow color={REPORT_PIN_COLOR} label="Road Report" />
          <LegendRow color={GAS_PIN_COLOR} label="Gas Station" />
        </View>
      </View>
    </SafeAreaView>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.forest[900],
  },
  headerTitle: {
    ...typography.h3,
    color: colors.neutral[0],
  },
  mapContainer: {
    flex: 1,
  },
  legend: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    ...typography.caption,
    color: colors.forest[900],
  },
});
