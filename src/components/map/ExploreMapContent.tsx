import React, { useRef, useEffect, useMemo } from 'react';
import MapboxGL from '@rnmapbox/maps';
import { Pressable, StyleSheet } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, spacing } from '@/theme';
import { MAPBOX_ACCESS_TOKEN, BELIZE_CENTER, BELIZE_ZOOM } from '@/lib/mapbox';
import { DEFAULT_NEARBY_ZOOM } from '@/lib/constants';
import { getDistrictBoundariesGeoJSON } from '@/lib/belizeDistricts';
import type { BelizeDistrict } from '@/types/database';

MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);

interface GeoPoint {
  id: string;
  lng: number;
  lat: number;
  color: string;
  label?: string;
}

export interface ExploreMapContentProps {
  posts: GeoPoint[];
  reports: GeoPoint[];
  gasStations: GeoPoint[];
  onPinPress?: (id: string) => void;
  onRecenterRef?: React.MutableRefObject<(() => void) | null>;
  /** Override initial camera center (defaults to BELIZE_CENTER) */
  initialCenter?: { latitude: number; longitude: number };
  /** Override initial zoom (defaults to BELIZE_ZOOM) */
  initialZoom?: number;
  /** Show the blue user-location dot */
  showUserLocation?: boolean;
  /** District to highlight with a brighter border + fill */
  highlightDistrict?: BelizeDistrict | null;
  /** Pixel offset from top of MapView to clear the header overlay */
  compassTopOffset?: number;
}

export function ExploreMapContent({
  posts,
  reports,
  gasStations,
  onPinPress,
  onRecenterRef,
  initialCenter,
  initialZoom,
  showUserLocation = false,
  highlightDistrict,
  compassTopOffset = 64,
}: ExploreMapContentProps) {
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const center = initialCenter ?? BELIZE_CENTER;
  const zoom = initialZoom ?? BELIZE_ZOOM;

  // When GPS is not active, fly camera whenever the district-based center changes
  useEffect(() => {
    if (showUserLocation) return; // followUserLocation on Camera handles GPS case
    cameraRef.current?.setCamera({
      centerCoordinate: [center.longitude, center.latitude],
      zoomLevel: zoom,
      animationDuration: 600,
    });
  }, [center.latitude, center.longitude, zoom, showUserLocation]);

  const districtGeoJSON = useMemo(
    () => getDistrictBoundariesGeoJSON(highlightDistrict),
    [highlightDistrict],
  );

  const geoJson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: posts.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      properties: { id: p.id, color: p.color, label: p.label ?? '' },
    })),
  };

  const reportsGeoJson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: reports.map((r) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] },
      properties: { id: r.id, color: r.color, label: r.label ?? '' },
    })),
  };

  const gasGeoJson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: gasStations.map((g) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [g.lng, g.lat] },
      properties: { id: g.id, color: g.color, label: g.label ?? '' },
    })),
  };

  const handlePinPress = (event: any) => {
    const feature = event?.features?.[0];
    if (feature?.properties?.id) {
      onPinPress?.(feature.properties.id);
    }
  };

  const recenter = () => {
    cameraRef.current?.setCamera({
      centerCoordinate: [center.longitude, center.latitude],
      zoomLevel: zoom,
      animationDuration: 600,
    });
  };

  // Expose recenter to parent
  if (onRecenterRef) onRecenterRef.current = recenter;

  return (
    <>
      <MapboxGL.MapView
        style={s.map}
        styleURL={MapboxGL.StyleURL.Street}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled
        compassPosition={{ top: compassTopOffset + 20, right: 16 }}
      >
        {showUserLocation ? (
          <MapboxGL.Camera
            ref={cameraRef}
            followUserLocation
            followZoomLevel={DEFAULT_NEARBY_ZOOM}
            animationMode="easeTo"
            animationDuration={600}
          />
        ) : (
          <MapboxGL.Camera
            ref={cameraRef}
            centerCoordinate={[center.longitude, center.latitude]}
            zoomLevel={zoom}
            animationMode="moveTo"
            animationDuration={0}
          />
        )}

        {showUserLocation && <MapboxGL.UserLocation visible />}

        {/* District boundary overlay */}
        <MapboxGL.ShapeSource id="districts" shape={districtGeoJSON}>
          <MapboxGL.FillLayer
            id="districts-fill"
            style={{
              fillColor: [
                'case',
                ['==', ['get', 'highlighted'], true],
                'rgba(81, 193, 82, 0.18)',
                'rgba(39, 67, 18, 0.05)',
              ] as any,
            }}
          />
          <MapboxGL.LineLayer
            id="districts-border"
            style={{
              lineColor: [
                'case',
                ['==', ['get', 'highlighted'], true],
                'rgba(81, 193, 82, 0.90)',
                'rgba(39, 67, 18, 0.22)',
              ] as any,
              lineWidth: [
                'case',
                ['==', ['get', 'highlighted'], true],
                2,
                1,
              ] as any,
            }}
          />
        </MapboxGL.ShapeSource>

        {geoJson.features.length > 0 && (
          <MapboxGL.ShapeSource
            id="posts"
            shape={geoJson}
            onPress={handlePinPress}
            cluster
            clusterMaxZoomLevel={14}
            clusterRadius={50}
          >
            <MapboxGL.CircleLayer
              id="posts-clusters"
              filter={['has', 'point_count']}
              style={{
                circleRadius: ['step', ['get', 'point_count'], 18, 10, 24, 50, 32],
                circleColor: '#2e7d32',
                circleStrokeWidth: 2,
                circleStrokeColor: '#ffffff',
              }}
            />
            <MapboxGL.SymbolLayer
              id="posts-cluster-count"
              filter={['has', 'point_count']}
              style={{
                textField: ['get', 'point_count_abbreviated'],
                textSize: 13,
                textColor: '#ffffff',
              }}
            />
            <MapboxGL.CircleLayer
              id="posts-circles"
              filter={['!', ['has', 'point_count']]}
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
          <MapboxGL.ShapeSource
            id="road-reports"
            shape={reportsGeoJson}
            cluster
            clusterMaxZoomLevel={14}
            clusterRadius={50}
          >
            <MapboxGL.CircleLayer
              id="road-reports-clusters"
              filter={['has', 'point_count']}
              style={{
                circleRadius: ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
                circleColor: '#d32f2f',
                circleStrokeWidth: 2,
                circleStrokeColor: '#ffffff',
              }}
            />
            <MapboxGL.SymbolLayer
              id="road-reports-cluster-count"
              filter={['has', 'point_count']}
              style={{
                textField: ['get', 'point_count_abbreviated'],
                textSize: 12,
                textColor: '#ffffff',
              }}
            />
            <MapboxGL.CircleLayer
              id="road-reports-circles"
              filter={['!', ['has', 'point_count']]}
              style={{
                circleRadius: 7,
                circleColor: ['get', 'color'],
                circleStrokeWidth: 2,
                circleStrokeColor: '#ffffff',
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {gasGeoJson.features.length > 0 && (
          <MapboxGL.ShapeSource
            id="gas-prices"
            shape={gasGeoJson}
            cluster
            clusterMaxZoomLevel={14}
            clusterRadius={50}
          >
            <MapboxGL.CircleLayer
              id="gas-prices-clusters"
              filter={['has', 'point_count']}
              style={{
                circleRadius: ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
                circleColor: '#2e7d32',
                circleStrokeWidth: 2,
                circleStrokeColor: '#ffffff',
              }}
            />
            <MapboxGL.SymbolLayer
              id="gas-prices-cluster-count"
              filter={['has', 'point_count']}
              style={{
                textField: ['get', 'point_count_abbreviated'],
                textSize: 12,
                textColor: '#ffffff',
              }}
            />
            <MapboxGL.CircleLayer
              id="gas-prices-circles"
              filter={['!', ['has', 'point_count']]}
              style={{
                circleRadius: 7,
                circleColor: ['get', 'color'],
                circleStrokeWidth: 2,
                circleStrokeColor: '#ffffff',
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>

      {/* Recenter button */}
      <Pressable style={s.recenterBtn} onPress={recenter}>
        <Icon name="compass" size={22} color={colors.forest[900]} />
      </Pressable>
    </>
  );
}

const s = StyleSheet.create({
  map: { flex: 1 },
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
});
