import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type ViewStyle,
  type StyleProp,
  type LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors, spacing, shadows } from '@/theme';

interface ScreenHeaderProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * Unified header shell used on every screen.
 *
 * iOS   — BlurView (dark, intensity 65) + gradient tint overlay
 * Other — gradient from forest-900 → forest-800
 *
 * Features: 20px bottom radius, subtle drop shadow, accent-green bottom edge.
 * Pass per-screen layout styles (padding, flex, etc.) via the `style` prop.
 * Do NOT set backgroundColor in the passed style — this component owns that.
 */
export function ScreenHeader({ children, style, onLayout }: ScreenHeaderProps) {
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.outer} onLayout={onLayout}>
        <View style={[styles.container, style]}>
          <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(20, 45, 0, 0.45)', 'rgba(28, 37, 19, 0.35)']}
            style={StyleSheet.absoluteFill}
          />
          {children}
          <View style={styles.accentEdge} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.outer} onLayout={onLayout}>
      <View style={[styles.container, style]}>
        <LinearGradient
          colors={[colors.forest[900], colors.forest[800]]}
          style={StyleSheet.absoluteFill}
        />
        {children}
        <View style={styles.accentEdge} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    ...shadows.md,
    shadowColor: 'rgba(20, 40, 0, 0.5)',
  },
  container: {
    overflow: 'hidden',
    backgroundColor: colors.forest[900],
  },
  accentEdge: {
    position: 'absolute',
    bottom: 0,
    left: spacing.lg,
    right: spacing.lg,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent.neonGreen,
    opacity: 0.35,
  },
});
