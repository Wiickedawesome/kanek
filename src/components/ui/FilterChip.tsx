import React from 'react';
import { Pressable, Text, StyleSheet, View, ViewStyle } from 'react-native';
import { GlassView } from '@/components/ui/GlassView';
import { colors, typography, borderRadius, spacing } from '@/theme';

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export function FilterChip({ label, selected = false, onPress, style }: FilterChipProps) {
  const Wrapper = selected ? View : GlassView;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed, style]}
    >
      <Wrapper style={[styles.chip, selected && styles.selected]}>
        <Text style={[styles.label, selected && styles.selectedLabel]}>
          {label}
        </Text>
      </Wrapper>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
  },
  selected: {
    backgroundColor: colors.forest[600],
    borderColor: colors.forest[600],
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.8,
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
