import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MapboxGL from '@rnmapbox/maps';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useGetPostsQuery, type PostWithAuthor } from '@/store/api/postsApi';
import { useGetRoadReportsQuery, useGetGasPricesQuery } from '@/store/api/reportsApi';
import { MAPBOX_ACCESS_TOKEN, BELIZE_CENTER, BELIZE_ZOOM } from '@/lib/mapbox';

MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);

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
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const { data: posts } = useGetPostsQuery({});
  const { data: roadReports } = useGetRoadReportsQuery();
  const { data: gasPrices } = useGetGasPricesQuery();

  /** Only posts with coordinates */
  const mappablePosts = useMemo(
    () =>
      (posts ?? []).filter(
        (p): p is PostWithAuthor & { origin_lat: number; origin_lng: number } =>
          p.origin_lat != null && p.origin_lng != null,
      ),
    [posts],
  );

  /** GeoJSON FeatureCollection for the points */
  const geoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: mappablePosts.map((p) => ({
        type: 'Feature' as const,
        id: p.id,
        geometry: {
          type: 'Point' as const,
          coordinates: [p.origin_lng, p.origin_lat],
        },
        properties: {
          id: p.id,
          type: p.type,
          title: p.title,
          color: PIN_COLORS[p.type] ?? colors.forest[400],
        },
      })),
    }),
    [mappablePosts],
  );

  /** Road reports GeoJSON */
  const reportsGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: (roadReports ?? []).map((r) => ({
        type: 'Feature' as const,
        id: r.id,
        geometry: {
          type: 'Point' as const,
          coordinates: [r.lng, r.lat],
        },
        properties: {
          id: r.id,
          type: r.type,
          color: REPORT_PIN_COLOR,
        },
      })),
    }),
    [roadReports],
  );

  /** Gas prices GeoJSON */
  const gasGeoJson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: (gasPrices ?? []).map((g) => ({
        type: 'Feature' as const,
        id: g.id,
        geometry: {
          type: 'Point' as const,
          coordinates: [g.station_lng, g.station_lat],
        },
        properties: {
          id: g.id,
          station: g.station_name,
          color: GAS_PIN_COLOR,
        },
      })),
    }),
    [gasPrices],
  );

  const handlePinPress = (event: any) => {
    const feature = event?.features?.[0];
    if (feature?.properties?.id) {
      router.push(`/(tabs)/explore/${feature.properties.id}`);
    }
  };

  const recenter = () => {
    cameraRef.current?.setCamera({
      centerCoordinate: [BELIZE_CENTER.longitude, BELIZE_CENTER.latitude],
      zoomLevel: BELIZE_ZOOM,
      animationDuration: 600,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Map View</Text>
        <Pressable onPress={() => router.push('/(tabs)/explore/')} hitSlop={12}>
          <Icon name="clipboard-list" size={24} color={colors.neutral[0]} />
        </Pressable>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapboxGL.MapView
          style={styles.map}
          styleURL={MapboxGL.StyleURL.Street}
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled
          compassPosition={{ top: 72, right: 16 }}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            centerCoordinate={[BELIZE_CENTER.longitude, BELIZE_CENTER.latitude]}
            zoomLevel={BELIZE_ZOOM}
            animationMode="moveTo"
            animationDuration={0}
          />

          {geoJson.features.length > 0 && (
            <MapboxGL.ShapeSource
              id="posts"
              shape={geoJson}
              onPress={handlePinPress}
            >
              <MapboxGL.CircleLayer
                id="posts-circles"
                style={{
                  circleRadius: 8,
                  circleColor: ['get', 'color'],
                  circleStrokeWidth: 2,
                  circleStrokeColor: '#ffffff',
                }}
              />
            </MapboxGL.ShapeSource>
          )}

          {reportsGeoJson.features.length > 0 && (
            <MapboxGL.ShapeSource id="road-reports" shape={reportsGeoJson}>
              <MapboxGL.CircleLayer
                id="road-reports-circles"
                style={{
                  circleRadius: 7,
                  circleColor: REPORT_PIN_COLOR,
                  circleStrokeWidth: 2,
                  circleStrokeColor: '#ffffff',
                }}
              />
            </MapboxGL.ShapeSource>
          )}

          {gasGeoJson.features.length > 0 && (
            <MapboxGL.ShapeSource id="gas-prices" shape={gasGeoJson}>
              <MapboxGL.CircleLayer
                id="gas-prices-circles"
                style={{
                  circleRadius: 7,
                  circleColor: GAS_PIN_COLOR,
                  circleStrokeWidth: 2,
                  circleStrokeColor: '#ffffff',
                }}
              />
            </MapboxGL.ShapeSource>
          )}
        </MapboxGL.MapView>

        {/* Recenter button */}
        <Pressable style={styles.recenterBtn} onPress={recenter}>
          <Icon name="compass" size={22} color={colors.forest[900]} />
        </Pressable>

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
  map: {
    flex: 1,
  },
  recenterBtn: {
    position: 'absolute',
    bottom: 100,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
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
