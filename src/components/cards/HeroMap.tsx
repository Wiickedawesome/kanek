import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { borderRadius } from '@/theme';
import { HeroGradient } from './HeroGradient';
import { buildRouteMapUrl, buildPointMapUrl } from '@/lib/mapbox';
import type { PostType } from '@/types/database';

interface HeroMapProps {
  origin: { lat: number; lng: number };
  destination?: { lat: number; lng: number } | null;
  /** Real driving geometry (LineString) from the routing engine. When
   *  present the hero traces the actual road; otherwise we fall back to a
   *  straight line between origin and destination. */
  routeGeometry?: { type: string; coordinates: [number, number][] } | null;
  /** Used as a fallback gradient if Mapbox is unreachable. */
  fallbackType?: PostType;
  height?: number;
  /** Render width in points. Used to compute pixel dimensions for the
   *  static-image request so the map renders crisp at common card widths. */
  width?: number;
}

/**
 * Static-image Mapbox hero used by all post cards. Renders the real driving
 * route between origin and destination when geometry is available, falling
 * back to a straight line and finally to a `HeroGradient` placeholder.
 *
 * This component is the single source of truth for in-card route maps —
 * use it everywhere a route preview is shown so cards stay visually
 * consistent across the feed and the "Top routes" rail.
 */
export function HeroMap({
  origin,
  destination,
  routeGeometry,
  fallbackType = 'route_offer',
  height = 180,
  width,
}: HeroMapProps) {
  const [errored, setErrored] = React.useState(false);

  const url = useMemo(() => {
    // Compute @2x pixel size for retina screens. If width is unknown, use a
    // reasonable default that matches the feed-card width.
    const renderWidth = width ?? 360;
    const pxW = Math.round(renderWidth * 2);
    const pxH = Math.round(height * 2);

    if (destination) {
      return buildRouteMapUrl(origin.lat, origin.lng, destination.lat, destination.lng, {
        width: pxW,
        height: pxH,
        routeGeometry: routeGeometry ?? null,
        padding: 40,
      });
    }
    return buildPointMapUrl(origin.lat, origin.lng, {
      width: pxW,
      height: pxH,
      padding: 40,
    });
  }, [origin.lat, origin.lng, destination, routeGeometry, width, height]);

  if (!url || errored) {
    return <HeroGradient type={fallbackType} height={height} />;
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <Image
        source={{ uri: url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={120}
        onError={() => setErrored(true)}
        cachePolicy="memory-disk"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderTopLeftRadius: borderRadius.md,
    borderTopRightRadius: borderRadius.md,
    overflow: 'hidden',
  },
});
