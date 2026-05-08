import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Icon } from '@/components/icons';
import { spacing, borderRadius, shadows, useTheme } from '@/theme';
import { Text } from '@/components/ui/Text';
import { hapticLight } from '@/lib/haptics';
import { FLOATING_TAB_BAR_HEIGHT, FLOATING_TAB_BAR_MARGIN } from './FloatingTabBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SPRING = { damping: 16, stiffness: 320 };

interface MapFabProps {
  onPress: () => void;
  label?: string;
}

/**
 * Bottom-center "Map" pill button. Sits above the floating tab bar.
 * Mirrors the AllTrails layout where Map is the primary feed action.
 */
export function MapFab({ onPress, label = 'Map' }: MapFabProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bottom =
    (Platform.OS === 'web' ? FLOATING_TAB_BAR_MARGIN : Math.max(insets.bottom, 8)) +
    FLOATING_TAB_BAR_HEIGHT +
    FLOATING_TAB_BAR_MARGIN;

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          hapticLight();
          onPress();
        }}
        onPressIn={() => { scale.value = withSpring(0.94, SPRING); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING); }}
      >
        <Animated.View style={[styles.pill, { backgroundColor: c.fabBg }, animated]}>
          <Icon name="map" size={18} color={c.fabFg} />
          <Text variant="bodySm" weight="bold" style={{ color: c.fabFg }}>{label}</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.pill,
    ...shadows.lg,
  },
});
