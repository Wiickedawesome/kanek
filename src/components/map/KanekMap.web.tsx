import React, { forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';

interface KanekMapProps {
  center?: { latitude: number; longitude: number };
  zoom?: number;
  showUserLocation?: boolean;
  padding?: { paddingTop: number; paddingBottom: number; paddingLeft: number; paddingRight: number };
  onMapReady?: () => void;
  children?: React.ReactNode;
  style?: object;
}

/** Web stub — native Mapbox MapView is not available on web */
export const KanekMap = forwardRef<View, KanekMapProps>(
  ({ style }, ref) => (
    <View ref={ref} style={[styles.container, style]} />
  ),
);

KanekMap.displayName = 'KanekMap';

const styles = StyleSheet.create({
  container: { flex: 1 },
});
