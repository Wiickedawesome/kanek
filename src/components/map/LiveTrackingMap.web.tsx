import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/theme';
import type { DriverLocationUpdate } from '@/store/slices/locationSlice';

interface LiveTrackingMapProps {
  driverLocation: DriverLocationUpdate | null;
  origin: [number, number] | null;
  destination: [number, number] | null;
  routeCoordinates?: [number, number][];
  isDriver: boolean;
  style?: object;
}

/** Web fallback — native Mapbox tracking map is not available on web */
export function LiveTrackingMap({
  driverLocation,
  isDriver,
  style,
}: LiveTrackingMapProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.placeholder}>
        <Icon name="navigation" size={32} color={colors.neutral[400]} />
        <Text style={styles.title}>Live tracking map</Text>
        <Text style={styles.subtitle}>Available on mobile devices</Text>
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.neutral[100],
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 200,
  },
  title: {
    ...typography.body1Bold,
    color: colors.neutral[500],
  },
  subtitle: {
    ...typography.caption,
    color: colors.neutral[400],
  },
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
});
