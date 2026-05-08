import React from 'react';
import { Pressable, StyleSheet, ViewStyle, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { borderRadius, spacing, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { Text } from '@/components/ui/Text';
import { hapticSelection } from '@/lib/haptics';

const SPRING_CONFIG = { damping: 14, stiffness: 300 };

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export function FilterChip({ label, selected = false, onPress, style }: FilterChipProps) {
  const { c } = useTheme();
  const styles = createStyles(c);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    hapticSelection();
    scale.value = withSpring(1.05, SPRING_CONFIG);
    setTimeout(() => {
      scale.value = withSpring(1, SPRING_CONFIG);
    }, 80);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => { scale.value = withSpring(0.94, SPRING_CONFIG); }}
      onPressOut={() => { scale.value = withSpring(1, SPRING_CONFIG); }}
    >
      <Animated.View
        style={[
          styles.chip,
          selected && styles.selected,
          style,
          animatedStyle,
        ]}
      >
        <Text
          variant="bodySm"
          weight={selected ? 'bold' : 'regular'}
          style={selected ? { color: c.chipSelectedText } : undefined}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
    chip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.pill,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      ...(Platform.OS === 'web'
        ? ({ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as any)
        : {}),
    },
    selected: {
      backgroundColor: c.chipSelectedBg,
      borderColor: c.chipSelectedBg,
    },
  });
