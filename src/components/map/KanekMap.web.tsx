import React, { forwardRef, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import mapboxgl from 'mapbox-gl';
import { MAPBOX_ACCESS_TOKEN, BELIZE_CENTER, BELIZE_ZOOM, BELIZE_BOUNDS } from '@/lib/mapbox';

// Inject mapbox-gl CSS once
if (typeof document !== 'undefined') {
  const linkId = 'mapbox-gl-css';
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://api.mapbox.com/mapbox-gl-js/v${mapboxgl.version}/mapbox-gl.css`;
    document.head.appendChild(link);
  }
}

const BELIZE_MAX_BOUNDS: [[number, number], [number, number]] = [
  [BELIZE_BOUNDS.west, BELIZE_BOUNDS.south],
  [BELIZE_BOUNDS.east, BELIZE_BOUNDS.north],
];

interface KanekMapProps {
  center?: { latitude: number; longitude: number };
  zoom?: number;
  showUserLocation?: boolean;
  padding?: { paddingTop: number; paddingBottom: number; paddingLeft: number; paddingRight: number };
  onMapReady?: () => void;
  /** Ignored on web — mapbox-gl uses imperative APIs, not React children. */
  cameraRef?: unknown;
  children?: React.ReactNode;
  style?: object;
}

/**
 * Web KanekMap. Renders a real mapbox-gl map (matches the native variant's
 * shape: center/zoom/maxBounds/showUserLocation). `children` is ignored —
 * mapbox-gl is imperative; markers/overlays should be added on the web side
 * using the dedicated *.web.tsx content components (e.g. ExploreMapContent.web).
 */
export const KanekMap = forwardRef<View, KanekMapProps>(
  ({ center, zoom, showUserLocation, onMapReady, children, style }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);

    // Init once
    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;

      if (!MAPBOX_ACCESS_TOKEN) {
        // Bootstrap warns; no point trying to render a token-less map.
        return;
      }
      mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

      const c = center ?? BELIZE_CENTER;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [c.longitude, c.latitude],
        zoom: zoom ?? BELIZE_ZOOM,
        minZoom: 6,
        maxZoom: 18,
        maxBounds: BELIZE_MAX_BOUNDS,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

      if (showUserLocation) {
        map.addControl(
          new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserHeading: true,
          }),
          'top-right',
        );
      }

      map.once('load', () => {
        onMapReady?.();
      });

      mapRef.current = map;

      return () => {
        map.remove();
        mapRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // React to center/zoom changes
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !center) return;
      map.flyTo({
        center: [center.longitude, center.latitude],
        zoom: zoom ?? map.getZoom(),
        duration: 600,
      });
      // We deliberately depend on the primitive lat/lng/zoom rather than
      // the `center` object reference (which would re-fire on every render).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [center?.latitude, center?.longitude, zoom]);

    if (children !== undefined && children !== null && process.env.NODE_ENV !== 'production') {
      // One-time dev warn so engineers know children are ignored on web.
      console.warn(
        '[KanekMap.web] children are ignored on web — use the *.web.tsx content components for markers/overlays.',
      );
    }

    return (
      <View ref={ref} style={[styles.container, style]}>
        <div ref={containerRef} style={containerStyle} />
      </View>
    );
  },
);

KanekMap.displayName = 'KanekMap';

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});
