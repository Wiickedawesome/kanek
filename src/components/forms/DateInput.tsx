import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput as RNTextInput } from 'react-native';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';

interface DateInputProps {
  label: string;
  value: string; // stored as "YYYY-MM-DD" for backend
  onChangeText: (text: string) => void;
  error?: string;
}

/**
 * Date input with separate DD / MM / YYYY fields.
 * Stores value as ISO "YYYY-MM-DD" string for backend compatibility.
 */
export function DateInput({ label, value, onChangeText, error }: DateInputProps) {
  const { c } = useTheme();
  const styles = createStyles(c);
  const parsed = parseISO(value);
  const [day, setDay] = useState(parsed.day);
  const [month, setMonth] = useState(parsed.month);
  const [year, setYear] = useState(parsed.year);

  const emit = useCallback(
    (d: string, m: string, y: string) => {
      const dNum = parseInt(d, 10);
      const mNum = parseInt(m, 10);
      const yNum = parseInt(y, 10);
      if (isNaN(dNum) || isNaN(mNum) || isNaN(yNum) || y.length < 4) {
        onChangeText('');
        return;
      }
      onChangeText(
        `${String(yNum).padStart(4, '0')}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`,
      );
    },
    [onChangeText],
  );

  const handleDayChange = useCallback(
    (text: string) => {
      const clean = text.replace(/\D/g, '').slice(0, 2);
      setDay(clean);
      emit(clean, month, year);
    },
    [month, year, emit],
  );

  const handleMonthChange = useCallback(
    (text: string) => {
      const clean = text.replace(/\D/g, '').slice(0, 2);
      setMonth(clean);
      emit(day, clean, year);
    },
    [day, year, emit],
  );

  const handleYearChange = useCallback(
    (text: string) => {
      const clean = text.replace(/\D/g, '').slice(0, 4);
      setYear(clean);
      emit(day, month, clean);
    },
    [day, month, emit],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error ? styles.errorBorder : undefined]}>
        <RNTextInput
          style={styles.field}
          placeholder="DD"
          placeholderTextColor={c.textMuted}
          value={day}
          onChangeText={handleDayChange}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
        />
        <Text style={styles.separator}>/</Text>
        <RNTextInput
          style={styles.field}
          placeholder="MM"
          placeholderTextColor={c.textMuted}
          value={month}
          onChangeText={handleMonthChange}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
        />
        <Text style={styles.separator}>/</Text>
        <RNTextInput
          style={styles.yearField}
          placeholder="YYYY"
          placeholderTextColor={c.textMuted}
          value={year}
          onChangeText={handleYearChange}
          keyboardType="number-pad"
          maxLength={4}
          selectTextOnFocus
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** Parse a "YYYY-MM-DD" string into display parts */
function parseISO(value: string): { day: string; month: string; year: string } {
  if (!value || !value.includes('-')) return { day: '', month: '', year: '' };
  const [y, m, d] = value.split('-');
  return { day: d ?? '', month: m ?? '', year: y ?? '' };
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    ...type.bodySm.bold,
    color: c.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  errorBorder: {
    borderColor: colors.error,
  },
  field: {
    ...type.body.regular,
    color: c.text,
    textAlign: 'center',
    width: 32,
  },
  yearField: {
    ...type.body.regular,
    color: c.text,
    textAlign: 'center',
    width: 52,
  },
  separator: {
    ...type.body.regular,
    color: c.textMuted,
  },
  error: {
    ...type.caption.regular,
    color: colors.error,
  },
});
