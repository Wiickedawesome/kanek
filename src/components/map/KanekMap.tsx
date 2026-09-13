import React, { forwardRef, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { BELIZE_CENTER, BELIZE_ZOOM, BELIZE_BOUNDS } from '@/lib/mapbox';

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
  /**
   * Optional ref to the internal MapboxGL.Camera. When the parent needs to
   * imperatively drive the camera (e.g. follow a moving driver position),
   * pass a ref here instead of mounting a second `<MapboxGL.Camera>` as a
   * child — Mapbox does not support multiple Cameras on one MapView.
   */
  cameraRef?: React.Ref<MapboxGL.Camera>;
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
      cameraRef,
      children,
      style,
    },
    ref,
  ) => {
    // When a parent owns the camera via cameraRef, the declarative Camera
    // must not re-fly on every parent re-render (it fights imperative
    // setCamera calls and snaps the view). Only apply center/zoom once,
    // at mount; afterwards the ref-based owner drives the camera.
    const centerCoord = useMemo<[number, number]>(
      () => (center ? [center.longitude, center.latitude] : [BELIZE_CENTER.longitude, BELIZE_CENTER.latitude]),
      // center only matters at mount when a cameraRef owner exists
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [cameraRef ? null : center],
    );
    const zoomLevel = useMemo(
      () => zoom ?? BELIZE_ZOOM,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [cameraRef ? null : zoom],
    );

    return (
      <View style={[styles.container, style]}>
        <MapboxGL.MapView
          ref={ref}
          style={styles.map}
          styleURL={MapboxGL.StyleURL.Street}
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled
          pitchEnabled={false}
          rotateEnabled={false}
          onDidFinishLoadingMap={onMapReady}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            centerCoordinate={centerCoord}
            zoomLevel={zoomLevel}
            minZoomLevel={6}
            maxZoomLevel={18}
            maxBounds={{ ne: BELIZE_NE, sw: BELIZE_SW }}
            padding={padding}
            animationMode="flyTo"
            animationDuration={500}
          />

          {showUserLocation && MapboxGL.UserLocation && (
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
