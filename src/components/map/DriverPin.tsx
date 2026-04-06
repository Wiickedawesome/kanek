import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { colors, shadows } from '@/theme';

interface DriverPinProps {
  /** [longitude, latitude] */
  coordinate: [number, number];
  /** Heading in degrees (0 = north), null if unavailable */
  heading: number | null;
}

/**
 * Pulsing green marker showing the driver's live position on the map.
 * The inner arrow rotates to show heading when available.
 */
export function DriverPin({ coordinate, heading }: DriverPinProps) {
  return (
    <MapboxGL.MarkerView id="driver-live" coordinate={coordinate}>
      <View style={styles.outer}>
        <View
          style={[
            styles.arrow,
            heading != null ? { transform: [{ rotate: `${heading}deg` }] } : undefined,
          ]}
        >
          <View style={styles.arrowInner} />
        </View>
      </View>
    </MapboxGL.MarkerView>
  );
}

const SIZE = 36;

const styles = StyleSheet.create({
  outer: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: 'rgba(81,193,82,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    width: SIZE * 0.55,
    height: SIZE * 0.55,
    borderRadius: (SIZE * 0.55) / 2,
    backgroundColor: colors.accent.green,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  arrowInner: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.neutral[0],
    marginBottom: 1,
  },
});
