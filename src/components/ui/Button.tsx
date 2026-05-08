import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { colors, type, borderRadius, spacing, shadows, useTheme } from '@/theme';
import { hapticLight } from '@/lib/haptics';

const SPRING_CONFIG = { damping: 15, stiffness: 350 };

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
}: ButtonProps) {
  const { c, isDark } = useTheme();
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (!isDisabled) {
      hapticLight();
      onPress();
    }
  };

  // Theme-aware variant colours
  const primaryBg = isDark ? colors.accent.neonGreen : colors.forest[600];
  const primaryFg = isDark ? colors.forest[900] : colors.neutral[0];
  const accentFg = isDark ? colors.accent.neonGreen : colors.forest[600];

  const variantBg: Record<ButtonVariant, ViewStyle> = {
    primary: {
      backgroundColor: primaryBg,
      shadowColor: colors.forest[900],
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    secondary: {
      backgroundColor: c.surfaceElevated,
      ...shadows.sm,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: accentFg,
    },
    ghost: { backgroundColor: 'transparent' },
  };

  const variantFg: Record<ButtonVariant, TextStyle> = {
    primary: { color: primaryFg },
    secondary: { color: c.text },
    outline: { color: accentFg },
    ghost: { color: accentFg },
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      onPressIn={() => {
        if (!isDisabled) scale.value = withSpring(0.96, SPRING_CONFIG);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SPRING_CONFIG);
      }}
    >
      <Animated.View
        style={[
          styles.base,
          sizeStyles[size],
          variantBg[variant],
          isDisabled && styles.disabled,
          style,
          animatedStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? primaryFg : accentFg}
          />
        ) : (
          <>
            {icon}
            <Text
              style={[
                styles.text,
                sizeTextStyles[size],
                variantFg[variant],
                isDisabled && styles.disabledText,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.pill,
    gap: spacing.sm,
  },
  text: {
    ...type.body.bold,
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.7,
  },
});

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  lg: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xxl },
};

const sizeTextStyles: Record<ButtonSize, TextStyle> = {
  sm: { ...type.bodySm.bold },
  md: { ...type.body.bold },
  lg: { ...type.body.bold },
};
