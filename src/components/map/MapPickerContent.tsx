import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { MAPBOX_ACCESS_TOKEN, BELIZE_BOUNDS } from '@/lib/mapbox';

MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);

const BELIZE_SW: [number, number] = [BELIZE_BOUNDS.west, BELIZE_BOUNDS.south];
const BELIZE_NE: [number, number] = [BELIZE_BOUNDS.east, BELIZE_BOUNDS.north];

interface MapPickerContentProps {
  initialCenter: { latitude: number; longitude: number };
  onCenterChange: (coords: { latitude: number; longitude: number }) => void;
}

export function MapPickerContent({ initialCenter, onCenterChange }: MapPickerContentProps) {
  const handleRegionDidChange = useCallback(
    (feature: GeoJSON.Feature<GeoJSON.Point>) => {
      const [lng, lat] = feature.geometry.coordinates;
      onCenterChange({ latitude: lat, longitude: lng });
    },
    [onCenterChange],
  );

  return (
    <MapboxGL.MapView
      style={styles.map}
      styleURL={MapboxGL.StyleURL.Street}
      logoEnabled={false}
      attributionEnabled={false}
      compassEnabled
      onRegionDidChange={handleRegionDidChange}
    >
      <MapboxGL.Camera
        centerCoordinate={[initialCenter.longitude, initialCenter.latitude]}
        zoomLevel={14}
        minZoomLevel={6}
        maxZoomLevel={18}
        bounds={{ sw: BELIZE_SW, ne: BELIZE_NE }}
      />
      <MapboxGL.UserLocation visible androidRenderMode="compass" />
    </MapboxGL.MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
