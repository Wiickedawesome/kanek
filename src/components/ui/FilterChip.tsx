import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { colors, typography, borderRadius, spacing } from '@/theme';
import { hapticSelection } from '@/lib/haptics';

const SPRING_CONFIG = { damping: 14, stiffness: 300 };

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export function FilterChip({ label, selected = false, onPress, style }: FilterChipProps) {
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
        <Text style={[styles.label, selected && styles.selectedLabel]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as any : {}),
  },
  selected: {
    backgroundColor: colors.forest[900],
    borderColor: colors.forest[900],
  },
  label: {
    ...typography.body2,
    color: colors.forest[900],
  },
  selectedLabel: {
    ...typography.body2Bold,
    color: colors.neutral[0],
  },
});
