import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TextInput } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { FormField } from './FormField';

interface PriceInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  required?: boolean;
  hint?: string;
}

export function PriceInput({
  label = 'Price (BZD)',
  value,
  onChangeText,
  error,
  required,
  hint,
}: PriceInputProps) {
  return (
    <FormField label={label} error={error} required={required} hint={hint}>
      <View style={styles.inputRow}>
        <Text style={styles.prefix}>$</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="0.00"
          keyboardType="decimal-pad"
          style={styles.input}
        />
        <Text style={styles.suffix}>BZD</Text>
      </View>
    </FormField>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    paddingHorizontal: spacing.md,
  },
  prefix: { ...typography.body1Bold, color: colors.forest[400] },
  suffix: { ...typography.caption, color: colors.neutral[400] },
  input: {
    flex: 1,
    borderWidth: 0,
    paddingHorizontal: 0,
  },
});
