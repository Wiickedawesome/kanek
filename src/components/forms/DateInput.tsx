import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput as RNTextInput } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/theme';

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
          placeholderTextColor={colors.neutral[400]}
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
          placeholderTextColor={colors.neutral[400]}
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
          placeholderTextColor={colors.neutral[400]}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    ...typography.body2Bold,
    color: colors.forest[400],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  errorBorder: {
    borderColor: colors.error,
  },
  field: {
    ...typography.body1,
    color: colors.forest[900],
    textAlign: 'center',
    width: 32,
  },
  yearField: {
    ...typography.body1,
    color: colors.forest[900],
    textAlign: 'center',
    width: 52,
  },
  separator: {
    ...typography.body1,
    color: colors.forest[400],
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
});
