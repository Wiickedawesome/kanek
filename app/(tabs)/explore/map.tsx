import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { router } from 'expo-router';
import { Icon } from '@/components/icons';
import { safeGoBack } from '@/lib/helpers';
import { ExploreMapContent } from '@/components/map/ExploreMapContent';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useGetPostsQuery, type PostWithAuthor } from '@/store/api/postsApi';
import { useGetRoadReportsQuery, useGetGasPricesQuery } from '@/store/api/reportsApi';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';
import { DISTRICT_CENTERS, DEFAULT_NEARBY_ZOOM } from '@/lib/constants';
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
  const { data: posts } = useGetPostsQuery({});
  const { data: roadReports } = useGetRoadReportsQuery();
  const { data: gasPrices } = useGetGasPricesQuery();

  // User GPS from Redux
  const userLat = useSelector((s: RootState) => s.location.latitude);
  const userLng = useSelector((s: RootState) => s.location.longitude);
  const hasGPS = userLat != null && userLng != null;

  // Profile district as fallback — use explicit district, or infer from address_line
  const userId = useSelector((s: RootState) => s.auth.user?.id);
  const { data: profile } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const profileDistrict = useMemo<BelizeDistrict | null>(() => {
    if (profile?.district) return profile.district;
    const addr = (profile?.address_line ?? '').toLowerCase();
    if (!addr) return null;
    if (['cayo', 'san ignacio', 'santa elena', 'belmopan', 'benque', 'spanish lookout'].some((k) => addr.includes(k))) return 'cayo';
    if (['belize city', 'ladyville', 'hattieville', 'sandhill'].some((k) => addr.includes(k))) return 'belize';
    if (['corozal'].some((k) => addr.includes(k))) return 'corozal';
    if (['orange walk'].some((k) => addr.includes(k))) return 'orange_walk';
    if (['stann creek', 'dangriga', 'hopkins', 'placencia', 'independence'].some((k) => addr.includes(k))) return 'stann_creek';
    if (['toledo', 'punta gorda', 'big falls'].some((k) => addr.includes(k))) return 'toledo';
    return null;
  }, [profile?.district, profile?.address_line]);

  // Determine initial camera: GPS → profile district → Belize-wide
  const { initialCenter, initialZoom } = useMemo(() => {
    if (hasGPS) {
      return { initialCenter: { latitude: userLat, longitude: userLng }, initialZoom: DEFAULT_NEARBY_ZOOM };
    }
    if (profileDistrict && DISTRICT_CENTERS[profileDistrict]) {
      return { initialCenter: DISTRICT_CENTERS[profileDistrict], initialZoom: DEFAULT_NEARBY_ZOOM };
    }
    return { initialCenter: undefined, initialZoom: undefined };
  }, [hasGPS, userLat, userLng, profileDistrict]);

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
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          showUserLocation={hasGPS}
          highlightDistrict={profileDistrict}
        />

        {/* Header overlay */}
        <View style={styles.headerOverlay}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => safeGoBack('/(tabs)/explore/')} hitSlop={12}>
              <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
            </Pressable>
            <Text style={styles.headerTitle}>Map View</Text>
            <Pressable onPress={() => router.push('/(tabs)/explore/')} hitSlop={12}>
              <Icon name="clipboard-list" size={24} color={colors.neutral[0]} />
            </Pressable>
          </View>
        </View>

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
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.forest[900],
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
    color: colors.neutral[0],
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
