import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { BELIZE_BOUNDS } from '@/lib/mapbox';

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
      pitchEnabled={false}
      rotateEnabled={false}
      onRegionDidChange={handleRegionDidChange}
    >
      <MapboxGL.Camera
        centerCoordinate={[initialCenter.longitude, initialCenter.latitude]}
        zoomLevel={14}
        minZoomLevel={6}
        maxZoomLevel={18}
        maxBounds={{ ne: BELIZE_NE, sw: BELIZE_SW }}
      />
      {MapboxGL.UserLocation && (
        <MapboxGL.UserLocation visible androidRenderMode="compass" />
      )}
    </MapboxGL.MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
