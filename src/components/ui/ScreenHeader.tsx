import React from 'react';
import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  type ViewStyle,
  type StyleProp,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, useTheme } from '@/theme';
import { Icon } from '@/components/icons';
import { Text } from '@/components/ui/Text';

interface ScreenHeaderProps {
  /**
   * Convenience API: when `title` is provided, ScreenHeader renders a standard
   * back-chevron + centered title + right-slot row. The right slot defaults to
   * a 24-width spacer so the title stays centered.
   */
  title?: string;
  /** Callback for the back chevron. Required when using the convenience API. */
  onBack?: () => void;
  /** Custom right-side element (icon button, etc.). Falls back to a spacer. */
  right?: React.ReactNode;
  /**
   * Legacy / custom API: render arbitrary header content. Only used when
   * `title` is not provided.
   */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * Unified header shell. Theme-aware, flat against the screen surface, with
 * a subtle bottom accent edge. No heavy forest-green gradient.
 *
 * Two ways to use:
 *   1. Convenience: `<ScreenHeader title="..." onBack={...} />`
 *   2. Custom:     `<ScreenHeader style={...}>{custom row}</ScreenHeader>`
 *
 * Pass per-screen layout styles (padding, flex, etc.) via the `style` prop.
 * Do NOT set backgroundColor in the passed style — this component owns that.
 */
export function ScreenHeader({
  title,
  onBack,
  right,
  children,
  style,
  onLayout,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { c, isDark } = useTheme();
  const topInset = Platform.OS === 'android'
    ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
    : insets.top;
  const safeAreaStyle = topInset > 0
    ? { marginTop: -topInset, paddingTop: topInset }
    : null;

  const usingConvenience = title !== undefined;
  const rowStyle: StyleProp<ViewStyle> = usingConvenience
    ? [styles.standardRow, style]
    : style;

  const rowChildren = usingConvenience ? (
    <>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
      <Text variant="h3" weight="bold" style={styles.title}>
        {title}
      </Text>
      {right ?? <View style={styles.spacer} />}
    </>
  ) : (
    children
  );

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
        <View style={rowStyle}>{rowChildren}</View>
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
  standardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  spacer: {
    width: 24,
  },
  accentEdge: {
    position: 'absolute',
    bottom: 0,
    left: spacing.lg,
    right: spacing.lg,
    height: 1,
    borderRadius: 0.5,
  },
});
