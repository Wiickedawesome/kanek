import React from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { shadows, useTheme } from '@/theme';
import { hapticLight } from '@/lib/haptics';

const SPRING = { damping: 15, stiffness: 300 };

interface PostCardShellProps {
  hero?: React.ReactNode;
  /** Overlay row anchored to the hero top — used for type badge. */
  heroOverlayLeft?: React.ReactNode;
  /** Overlay row anchored to the hero top-right — used for actions. */
  heroOverlayRight?: React.ReactNode;
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared card shell for posts in the explore feed. Mirrors the AllTrails
 * card pattern: full-bleed hero (image / map / gradient) on top with
 * 20px rounded corners, body underneath with the post details. Composes
 * onto whichever hero variant the caller wants (HeroMap, HeroGradient,
 * future HeroPhoto).
 */
export function PostCardShell({
  hero,
  heroOverlayLeft,
  heroOverlayRight,
  children,
  onPress,
  style,
}: PostCardShellProps) {
  const { c } = useTheme();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const Body = (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
        },
        animated,
        style,
      ]}
    >
      {hero != null && (
        <View style={styles.heroWrap}>
          {hero}
          {heroOverlayLeft != null && <View style={styles.overlayLeft}>{heroOverlayLeft}</View>}
          {heroOverlayRight != null && <View style={styles.overlayRight}>{heroOverlayRight}</View>}
        </View>
      )}
      <View style={styles.body}>{children}</View>
    </Animated.View>
  );

  if (!onPress) return Body;

  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onPress();
      }}
      onPressIn={() => { scale.value = withSpring(0.98, SPRING); }}
      onPressOut={() => { scale.value = withSpring(1, SPRING); }}
    >
      {Body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...shadows.sm,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } as any : {}),
  },
  heroWrap: {
    position: 'relative',
  },
  overlayLeft: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  overlayRight: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  body: {
    padding: 14,
    gap: 6,
  },
});
