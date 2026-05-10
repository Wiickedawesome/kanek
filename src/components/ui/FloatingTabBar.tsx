import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { spacing, borderRadius, shadows, useTheme } from '@/theme';
import { Text } from '@/components/ui/Text';
import { hapticSelection } from '@/lib/haptics';

/**
 * Height (excluding bottom safe inset) of the floating pill tab bar.
 * Screens should pad their list/scroll content by this amount + safe inset.
 */
export const FLOATING_TAB_BAR_HEIGHT = 64;
export const FLOATING_TAB_BAR_MARGIN = 12;

/**
 * Approximate height of the MapFab pill (height + clearance) so screens that
 * render a `<MapFab>` can reserve scroll space below their list.
 */
export const MAP_FAB_CLEARANCE = 56;

/**
 * Returns the bottom padding screens should add so content clears the
 * floating tab bar and the home-indicator safe area.
 *
 * Pass `{ withMapFab: true }` on screens that render a `<MapFab>` so the
 * extra pill height is reserved as well.
 */
export function useFloatingTabBarPad(opts?: { withMapFab?: boolean }) {
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === 'web' ? 0 : insets.bottom;
  const base = FLOATING_TAB_BAR_HEIGHT + FLOATING_TAB_BAR_MARGIN * 2 + bottom;
  return opts?.withMapFab ? base + MAP_FAB_CLEARANCE : base;
}

/**
 * Custom bottom tab bar — floating pill, glass background, neon-green
 * active accent. Mirrors the AllTrails pattern.
 */
export function FloatingTabBar(props: BottomTabBarProps) {
  const { state, descriptors, navigation } = props;
  const insets = useSafeAreaInsets();
  const { c, isDark } = useTheme();

  const bottom = Platform.OS === 'web' ? FLOATING_TAB_BAR_MARGIN : Math.max(insets.bottom, 8);

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom }]}>
      <View style={[styles.bar, { backgroundColor: c.tabBarBg, borderColor: c.tabBarBorder }]}>
        {Platform.OS === 'ios' && (
          <BlurView
            intensity={50}
            tint={isDark ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, styles.blur]}
          />
        )}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label = (options.title ?? route.name) as string;
          const renderIcon = options.tabBarIcon;
          const badge = options.tabBarBadge as string | number | undefined;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              hapticSelection();
              (navigation.navigate as (name: string, params?: object) => void)(route.name, route.params as object | undefined);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          const tint = isFocused ? c.tabBarActive : c.tabBarInactive;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
              hitSlop={6}
            >
              <View style={styles.tabInner}>
                {renderIcon ? renderIcon({ focused: isFocused, color: tint, size: 22 }) : null}
                {badge != null && (
                  <View style={styles.badge}>
                    <Text variant="caption" weight="semibold" style={styles.badgeText}>
                      {String(badge)}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                variant="caption"
                weight="medium"
                numberOfLines={1}
                style={[styles.label, { color: tint }]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 520,
    height: FLOATING_TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: borderRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    overflow: 'hidden',
    ...shadows.lg,
  },
  blur: {
    borderRadius: borderRadius.pill,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabInner: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#d32f2f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
