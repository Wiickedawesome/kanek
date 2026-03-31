import React from 'react';

interface RouteOverlayProps {
  coordinates: [number, number][];
  color?: string;
  width?: number;
}

/** Web stub — native Mapbox GL route overlay is not available on web */
export function RouteOverlay(_props: RouteOverlayProps) {
  return null;
}
