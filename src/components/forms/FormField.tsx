import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, type, spacing, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { Text } from '@/components/ui/Text';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

export function FormField({ label, error, required, hint, children }: FormFieldProps) {
  const { c } = useTheme();
  const styles = createStyles(c);
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {required && <Text style={styles.required}>*</Text>}
      </View>
      {children}
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  label: { ...type.bodySm.bold, color: c.text },
  required: { ...type.bodySm.bold, color: colors.error },
  error: { ...type.caption.regular, color: colors.error },
  hint: { ...type.caption.regular, color: c.textMuted },
});
