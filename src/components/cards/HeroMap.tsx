import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { borderRadius, useTheme } from '@/theme';
import { HeroGradient } from './HeroGradient';
import type { PostType } from '@/types/database';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

interface HeroMapProps {
  origin: { lat: number; lng: number };
  destination?: { lat: number; lng: number } | null;
  /** Used as a fallback gradient if Mapbox is unreachable. */
  fallbackType?: PostType;
  height?: number;
}

/**
 * Static-image Mapbox hero. Renders a route preview between origin and
 * destination (when both present) or a centred origin marker. Falls back to
 * `HeroGradient` if `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` is missing or the
 * image fails to load.
 */
export function HeroMap({ origin, destination, fallbackType = 'route_offer', height = 180 }: HeroMapProps) {
  const { isDark } = useTheme();
  const [errored, setErrored] = React.useState(false);

  if (!MAPBOX_TOKEN || errored) {
    return <HeroGradient type={fallbackType} height={height} />;
  }

  const url = buildStaticMapUrl({ origin, destination, dark: isDark });

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

function buildStaticMapUrl({
  origin,
  destination,
  dark,
}: {
  origin: { lat: number; lng: number };
  destination?: { lat: number; lng: number } | null;
  dark: boolean;
}) {
  const style = dark
    ? 'mapbox/dark-v11'
    : 'mapbox/outdoors-v12';

  const o = `pin-l-a+65f67b(${origin.lng.toFixed(5)},${origin.lat.toFixed(5)})`;

  // 600x360 @2x = ~1200x720. Reasonable for card hero.
  const size = '600x360@2x';

  if (destination) {
    const d = `pin-l-b+d32f2f(${destination.lng.toFixed(5)},${destination.lat.toFixed(5)})`;
    // path style: 5px line, neon green
    const path = `path-5+65f67b-1.0(${encodePath(origin, destination)})`;
    return `https://api.mapbox.com/styles/v1/${style}/static/${path},${o},${d}/auto/${size}?padding=40&access_token=${MAPBOX_TOKEN}&logo=false&attribution=false`;
  }

  // Single point — fixed zoom
  return `https://api.mapbox.com/styles/v1/${style}/static/${o}/${origin.lng.toFixed(5)},${origin.lat.toFixed(5)},12/${size}?access_token=${MAPBOX_TOKEN}&logo=false&attribution=false`;
}

/** Mapbox static API expects polyline-encoded paths. We use a simple 2-point line. */
function encodePath(a: { lat: number; lng: number }, b: { lat: number; lng: number }): string {
  return encodePolyline([
    [a.lat, a.lng],
    [b.lat, b.lng],
  ]);
}

/** Minimal Google polyline encoder (precision 5). */
function encodePolyline(points: [number, number][]): string {
  let lastLat = 0;
  let lastLng = 0;
  let result = '';
  for (const [lat, lng] of points) {
    const iLat = Math.round(lat * 1e5);
    const iLng = Math.round(lng * 1e5);
    result += encodeValue(iLat - lastLat) + encodeValue(iLng - lastLng);
    lastLat = iLat;
    lastLng = iLng;
  }
  return encodeURIComponent(result);
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let result = '';
  while (v >= 0x20) {
    result += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  result += String.fromCharCode(v + 63);
  return result;
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    overflow: 'hidden',
  },
});
