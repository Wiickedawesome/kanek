import React from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  View,
  type ViewStyle,
  type StyleProp,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, useTheme } from '@/theme';

interface ScreenHeaderProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * Unified header shell. Theme-aware, flat against the screen surface, with
 * a subtle bottom accent edge. No heavy forest-green gradient.
 *
 * Pass per-screen layout styles (padding, flex, etc.) via the `style` prop.
 * Do NOT set backgroundColor in the passed style — this component owns that.
 */
export function ScreenHeader({ children, style, onLayout }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { c, isDark } = useTheme();
  const topInset = Platform.OS === 'android'
    ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
    : insets.top;
  const safeAreaStyle = topInset > 0
    ? { marginTop: -topInset, paddingTop: topInset }
    : null;

  return (
    <View
      style={[
        styles.outer,
        { backgroundColor: c.bg },
        safeAreaStyle && { marginTop: safeAreaStyle.marginTop },
      ]}
      onLayout={onLayout}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: c.bg },
          safeAreaStyle && { paddingTop: safeAreaStyle.paddingTop },
        ]}
      >
        <View style={style}>{children}</View>
        <View
          style={[
            styles.accentEdge,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(20,40,0,0.08)' },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {},
  container: { overflow: 'hidden' },
  accentEdge: {
    position: 'absolute',
    bottom: 0,
    left: spacing.lg,
    right: spacing.lg,
    height: 1,
    borderRadius: 0.5,
  },
});
