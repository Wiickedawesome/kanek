import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput } from '@/components/ui';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { FormField } from './FormField';
import { Text } from '@/components/ui/Text';

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
  const { c } = useTheme();
  const styles = createStyles(c);
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

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
  },
  prefix: { ...type.body.bold, color: c.textMuted },
  suffix: { ...type.caption.regular, color: c.textMuted },
  input: {
    flex: 1,
    borderWidth: 0,
    paddingHorizontal: 0,
  },
});
