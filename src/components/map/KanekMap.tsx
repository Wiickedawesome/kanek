import React, { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { MAPBOX_ACCESS_TOKEN, BELIZE_CENTER, BELIZE_ZOOM, BELIZE_BOUNDS } from '@/lib/mapbox';

MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);

const BELIZE_SW: [number, number] = [BELIZE_BOUNDS.west, BELIZE_BOUNDS.south];
const BELIZE_NE: [number, number] = [BELIZE_BOUNDS.east, BELIZE_BOUNDS.north];

interface KanekMapProps {
  /** Center latitude/longitude override */
  center?: { latitude: number; longitude: number };
  /** Zoom level override */
  zoom?: number;
  /** Whether user location indicator is shown */
  showUserLocation?: boolean;
  /** Camera padding */
  padding?: { paddingTop: number; paddingBottom: number; paddingLeft: number; paddingRight: number };
  /** Called when map finishes loading */
  onMapReady?: () => void;
  children?: React.ReactNode;
  style?: object;
}

export const KanekMap = forwardRef<MapboxGL.MapView, KanekMapProps>(
  (
    {
      center,
      zoom,
      showUserLocation = true,
      padding,
      onMapReady,
      children,
      style,
    },
    ref,
  ) => {
    const centerCoord = center
      ? [center.longitude, center.latitude]
      : [BELIZE_CENTER.longitude, BELIZE_CENTER.latitude];

    return (
      <View style={[styles.container, style]}>
        <MapboxGL.MapView
          ref={ref}
          style={styles.map}
          styleURL={MapboxGL.StyleURL.Street}
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled
          onDidFinishLoadingMap={onMapReady}
        >
          <MapboxGL.Camera
            centerCoordinate={centerCoord}
            zoomLevel={zoom ?? BELIZE_ZOOM}
            minZoomLevel={6}
            maxZoomLevel={18}
            bounds={{ sw: BELIZE_SW, ne: BELIZE_NE }}
            padding={padding}
            animationMode="flyTo"
            animationDuration={500}
          />

          {showUserLocation && (
            <MapboxGL.UserLocation
              visible
              androidRenderMode="compass"
            />
          )}

          {children}
        </MapboxGL.MapView>
      </View>
    );
  },
);

KanekMap.displayName = 'KanekMap';

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
