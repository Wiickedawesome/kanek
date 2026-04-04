import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography, borderRadius, spacing } from '@/theme';

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export function FilterChip({ label, selected = false, onPress, style }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  selected: {
    backgroundColor: colors.forest[600],
    borderColor: colors.forest[600],
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
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
