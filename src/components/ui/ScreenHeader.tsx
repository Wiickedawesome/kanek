import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type ViewStyle,
  type StyleProp,
  type LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, borderRadius } from '@/theme';

interface ScreenHeaderProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * Unified glass-card header shell used on every screen.
 *
 * iOS   — BlurView (dark, intensity 90) + forest-green tint overlay
 * Other — solid colors.forest[900]
 *
 * Provides overflow:hidden + barely-curved bottom corners (borderRadius.sm = 6).
 * Pass per-screen layout styles (padding, flex, etc.) via the `style` prop.
 * Do NOT set backgroundColor in the passed style — this component owns that.
 */
export function ScreenHeader({ children, style, onLayout }: ScreenHeaderProps) {
  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.container, style]} onLayout={onLayout}>
        <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.iosTint} />
        {children}
        <View style={styles.bottomEdge} />
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.solidBg, style]} onLayout={onLayout}>
      {children}
      <View style={styles.bottomEdge} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderBottomLeftRadius: borderRadius.sm,
    borderBottomRightRadius: borderRadius.sm,
    // iOS: bg is transparent — BlurView + tint take over
    backgroundColor: 'transparent',
  },
  solidBg: {
    backgroundColor: colors.forest[900],
  },
  iosTint: {
    ...StyleSheet.absoluteFillObject,
    // Light forest-green tint — low opacity to let the blur breathe
    backgroundColor: 'rgba(20, 45, 0, 0.38)',
  },
  bottomEdge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
});
