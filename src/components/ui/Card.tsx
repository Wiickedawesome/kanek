import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable, StyleProp, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { spacing, shadows, useTheme } from '@/theme';
import { hapticLight } from '@/lib/haptics';

const SPRING_CONFIG = { damping: 15, stiffness: 300 };

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export function Card({ children, onPress, style, padded = true }: CardProps) {
  const { c } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const themed: ViewStyle = {
    backgroundColor: c.surface,
    borderColor: c.border,
  };

  const content = (
    <View style={[styles.card, themed, padded && styles.padded, style]}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          hapticLight();
          onPress();
        }}
        onPressIn={() => { scale.value = withSpring(0.97, SPRING_CONFIG); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING_CONFIG); }}
      >
        <Animated.View style={animatedStyle}>
          {content}
        </Animated.View>
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    ...shadows.sm,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } as object) : {}),
  },
  padded: {
    padding: spacing.lg,
  },
});
