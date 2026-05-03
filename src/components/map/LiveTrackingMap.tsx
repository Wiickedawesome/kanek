import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { KanekMap } from './KanekMap';
import { DriverPin } from './DriverPin';
import { RouteOverlay } from './RouteOverlay';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/theme';
import { BELIZE_CENTER } from '@/lib/mapbox';
import { isInBelize } from '@/lib/helpers';
import type { DriverLocationUpdate } from '@/store/slices/locationSlice';

interface LiveTrackingMapProps {
  /** Driver's live position */
  driverLocation: DriverLocationUpdate | null;
  /** Origin coords [longitude, latitude] */
  origin: [number, number] | null;
  /** Destination coords [longitude, latitude] */
  destination: [number, number] | null;
  /** Pre-computed route geometry coordinates */
  routeCoordinates?: [number, number][];
  /** Whether current user is the driver */
  isDriver: boolean;
  style?: object;
}

/** Validate a `[lng, lat]` tuple is non-null and inside Belize. */
function safeCoord(c: [number, number] | null): [number, number] | null {
  if (!c) return null;
  const [lng, lat] = c;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  if (!isInBelize(lat, lng)) return null;
  return c;
}

/**
 * Full live-tracking map view for an active contract.
 * Shows the route overlay, origin/destination pins, and the driver's
 * pulsing marker that updates in real-time.
 */
export function LiveTrackingMap({
  driverLocation,
  origin,
  destination,
  routeCoordinates,
  isDriver,
  style,
}: LiveTrackingMapProps) {
  const cameraRef = useRef<MapboxGL.Camera>(null);

  const driverCoord = useMemo<[number, number] | null>(
    () => {
      if (!driverLocation) return null;
      const c: [number, number] = [driverLocation.longitude, driverLocation.latitude];
      return safeCoord(c);
    },
    [driverLocation],
  );

  const safeOrigin = useMemo(() => safeCoord(origin), [origin]);
  const safeDestination = useMemo(() => safeCoord(destination), [destination]);

  // Follow driver position when it updates
  useEffect(() => {
    if (!driverCoord || !cameraRef.current) return;
    cameraRef.current.setCamera({
      centerCoordinate: driverCoord,
      zoomLevel: 14,
      animationDuration: 1000,
      animationMode: 'easeTo',
    });
  }, [driverCoord]);

  // Compute initial center — driver position, origin, destination, or
  // Belize fallback. Reactive to current props (not mount-only) so the
  // first paint after data loads is correct.
  const initialCenter = useMemo<{ latitude: number; longitude: number }>(() => {
    if (driverCoord) {
      return { latitude: driverCoord[1], longitude: driverCoord[0] };
    }
    if (safeOrigin && safeDestination) {
      return {
        latitude: (safeOrigin[1] + safeDestination[1]) / 2,
        longitude: (safeOrigin[0] + safeDestination[0]) / 2,
      };
    }
    if (safeOrigin) {
      return { latitude: safeOrigin[1], longitude: safeOrigin[0] };
    }
    if (safeDestination) {
      return { latitude: safeDestination[1], longitude: safeDestination[0] };
    }
    return BELIZE_CENTER;
  }, [driverCoord, safeOrigin, safeDestination]);

  const initialZoom = driverCoord ? 14 : safeOrigin || safeDestination ? 11 : 7;

  return (
    <View style={[styles.container, style]}>
      <KanekMap
        center={initialCenter}
        zoom={initialZoom}
        showUserLocation={isDriver}
        cameraRef={cameraRef}
      >
        {/* Route line */}
        {routeCoordinates && routeCoordinates.length >= 2 && (
          <RouteOverlay coordinates={routeCoordinates} width={5} />
        )}

        {/* Origin pin */}
        {safeOrigin && (
          <MapboxGL.MarkerView id="origin" coordinate={safeOrigin}>
            <View style={styles.endpointPin}>
              <View style={[styles.endpointDot, styles.originDot]} />
            </View>
          </MapboxGL.MarkerView>
        )}

        {/* Destination pin */}
        {safeDestination && (
          <MapboxGL.MarkerView id="destination" coordinate={safeDestination}>
            <View style={styles.endpointPin}>
              <View style={[styles.endpointDot, styles.destDot]} />
            </View>
          </MapboxGL.MarkerView>
        )}

        {/* Driver's live position */}
        {driverCoord && (
          <DriverPin
            coordinate={driverCoord}
            heading={driverLocation?.heading ?? null}
          />
        )}
      </KanekMap>

      {/* Tracking info overlay */}
      {driverLocation && (
        <View style={styles.infoOverlay}>
          <Icon name="navigation" size={14} color={colors.accent.green} />
          <Text style={styles.infoText}>
            {isDriver ? 'Broadcasting your location' : 'Tracking driver'}
          </Text>
          {driverLocation.speed != null && driverLocation.speed > 0 && (
            <Text style={styles.speedText}>
              {Math.round(driverLocation.speed * 3.6)} km/h
            </Text>
          )}
        </View>
      )}

      {!driverLocation && !isDriver && (
        <View style={styles.waitingOverlay}>
          <Icon name="clock" size={16} color={colors.neutral[400]} />
          <Text style={styles.waitingText}>Waiting for driver location...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, borderRadius: borderRadius.lg, overflow: 'hidden' },

  endpointPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  endpointDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  originDot: { backgroundColor: colors.accent.green },
  destDot: { backgroundColor: colors.error },

  infoOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    ...shadows.md,
  },
  infoText: {
    ...typography.caption,
    color: colors.forest[900],
    fontWeight: '600',
    flex: 1,
  },
  speedText: {
    ...typography.caption,
    color: colors.accent.green,
    fontWeight: '700',
  },

  waitingOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
  },
  waitingText: {
    ...typography.caption,
    color: colors.neutral[400],
  },
});
