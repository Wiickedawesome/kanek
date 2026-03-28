import React from 'react';
import MapboxGL from '@rnmapbox/maps';
import { colors } from '@/theme';

interface RouteOverlayProps {
  /** Array of [longitude, latitude] coordinates forming the route line */
  coordinates: [number, number][];
  /** Line color override */
  color?: string;
  /** Line width */
  width?: number;
}

export function RouteOverlay({
  coordinates,
  color = colors.accent.green,
  width = 4,
}: RouteOverlayProps) {
  if (coordinates.length < 2) return null;

  const routeGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {},
      },
    ],
  };

  return (
    <MapboxGL.ShapeSource id="route-line" shape={routeGeoJSON}>
      <MapboxGL.LineLayer
        id="route-line-layer"
        style={{
          lineColor: color,
          lineWidth: width,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </MapboxGL.ShapeSource>
  );
}
