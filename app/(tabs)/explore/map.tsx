import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { router } from 'expo-router';
import { Icon } from '@/components/icons';
import { safeGoBack } from '@/lib/helpers';
import { FilterChip } from '@/components/ui';
import { GlassView } from '@/components/ui';
import { ExploreMapContent } from '@/components/map/ExploreMapContent';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useGetPostsQuery, type PostWithAuthor } from '@/store/api/postsApi';
import { useGetRoadReportsQuery, useGetGasPricesQuery } from '@/store/api/reportsApi';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';
import { DISTRICT_CENTERS, BELIZE_DISTRICTS, DEFAULT_NEARBY_ZOOM } from '@/lib/constants';
import type { BelizeDistrict } from '@/types/database';
import type { RootState } from '@/store';

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
  const [selectedDistrict, setSelectedDistrict] = useState<BelizeDistrict | null>(null);

  const { data: posts } = useGetPostsQuery({});
  const { data: roadReports } = useGetRoadReportsQuery();
  const { data: gasPrices } = useGetGasPricesQuery();

  // User GPS from Redux
  const userLat = useSelector((s: RootState) => s.location.latitude);
  const userLng = useSelector((s: RootState) => s.location.longitude);
  const hasGPS = userLat != null && userLng != null;

  // Profile district as fallback
  const userId = useSelector((s: RootState) => s.auth.user?.id);
  const { data: profile } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const profileDistrict = profile?.district ?? null;

  // Determine initial camera: district chip → GPS → profile district → Belize-wide
  const { initialCenter, initialZoom } = useMemo(() => {
    if (selectedDistrict) {
      return { initialCenter: DISTRICT_CENTERS[selectedDistrict], initialZoom: DEFAULT_NEARBY_ZOOM };
    }
    if (hasGPS) {
      return { initialCenter: { latitude: userLat, longitude: userLng }, initialZoom: DEFAULT_NEARBY_ZOOM };
    }
    if (profileDistrict && DISTRICT_CENTERS[profileDistrict]) {
      return { initialCenter: DISTRICT_CENTERS[profileDistrict], initialZoom: DEFAULT_NEARBY_ZOOM };
    }
    return { initialCenter: undefined, initialZoom: undefined };
  }, [selectedDistrict, hasGPS, userLat, userLng, profileDistrict]);

  const handleDistrictPress = (key: BelizeDistrict) => {
    const next = selectedDistrict === key ? null : key;
    setSelectedDistrict(next);
    if (next) {
      recenterRef.current?.();
    }
  };

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
      {/* Map fills entire area */}
      <View style={styles.mapContainer}>
        <ExploreMapContent
          posts={postPoints}
          reports={reportPoints}
          gasStations={gasPoints}
          onPinPress={handlePinPress}
          onRecenterRef={recenterRef}
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          showUserLocation={hasGPS}
        />

        {/* Glass header overlay */}
        <GlassView intensity={80} style={styles.glassHeader}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => safeGoBack('/(tabs)/explore/')} hitSlop={12}>
              <Icon name="chevron-left" size={24} color={colors.forest[900]} />
            </Pressable>
            <Text style={styles.headerTitle}>Map View</Text>
            <Pressable onPress={() => router.push('/(tabs)/explore/')} hitSlop={12}>
              <Icon name="clipboard-list" size={24} color={colors.forest[900]} />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.districtChips}
          >
            {BELIZE_DISTRICTS.map((d) => (
              <FilterChip
                key={d.key}
                label={d.label}
                selected={selectedDistrict === d.key}
                onPress={() => handleDistrictPress(d.key)}
              />
            ))}
          </ScrollView>
        </GlassView>

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
  mapContainer: {
    flex: 1,
  },
  glassHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingBottom: spacing.sm,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.forest[900],
  },
  districtChips: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
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
