import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { KanekMap } from './KanekMap';
import { DriverPin } from './DriverPin';
import { RouteOverlay } from './RouteOverlay';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius } from '@/theme';
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
    () => driverLocation
      ? [driverLocation.longitude, driverLocation.latitude]
      : null,
    [driverLocation],
  );

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

  // Compute initial center — driver position, or midpoint of route, or origin
  const initialCenter = useMemo(() => {
    if (driverLocation) {
      return { latitude: driverLocation.latitude, longitude: driverLocation.longitude };
    }
    if (origin && destination) {
      return {
        latitude: (origin[1] + destination[1]) / 2,
        longitude: (origin[0] + destination[0]) / 2,
      };
    }
    if (origin) {
      return { latitude: origin[1], longitude: origin[0] };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount

  return (
    <View style={[styles.container, style]}>
      <KanekMap
        center={initialCenter}
        zoom={driverLocation ? 14 : 11}
        showUserLocation={isDriver}
      >
        {/* Camera ref for programmatic updates */}
        <MapboxGL.Camera
          ref={cameraRef}
          centerCoordinate={
            driverCoord ??
            (origin ? origin : undefined)
          }
          zoomLevel={driverLocation ? 14 : 11}
          animationMode="easeTo"
          animationDuration={500}
        />

        {/* Route line */}
        {routeCoordinates && routeCoordinates.length >= 2 && (
          <RouteOverlay coordinates={routeCoordinates} width={5} />
        )}

        {/* Origin pin */}
        {origin && (
          <MapboxGL.MarkerView id="origin" coordinate={origin}>
            <View style={styles.endpointPin}>
              <View style={[styles.endpointDot, styles.originDot]} />
            </View>
          </MapboxGL.MarkerView>
        )}

        {/* Destination pin */}
        {destination && (
          <MapboxGL.MarkerView id="destination" coordinate={destination}>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
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
