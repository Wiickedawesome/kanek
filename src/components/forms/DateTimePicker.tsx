import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput } from '@/components/ui';
import { Icon } from '@/components/icons';
import { colors, spacing, borderRadius } from '@/theme';
import { FormField } from './FormField';

interface DateTimePickerProps {
  dateLabel?: string;
  timeLabel?: string;
  dateValue: string;
  timeValue: string;
  onDateChange: (text: string) => void;
  onTimeChange: (text: string) => void;
  dateError?: string;
  timeError?: string;
  required?: boolean;
}

/**
 * Side-by-side date and time text inputs.
 * Uses plain text entry (YYYY-MM-DD / HH:MM format).
 * A native DateTimePicker can replace these inputs in a future iteration.
 */
export function DateTimePicker({
  dateLabel = 'Date',
  timeLabel = 'Time',
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  dateError,
  timeError,
  required,
}: DateTimePickerProps) {
  return (
    <View style={styles.row}>
      <View style={styles.half}>
        <FormField label={dateLabel} error={dateError} required={required}>
          <View style={styles.inputRow}>
            <Icon name="clock" size={16} color={colors.forest[400]} />
            <TextInput
              value={dateValue}
              onChangeText={onDateChange}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              style={styles.input}
            />
          </View>
        </FormField>
      </View>
      <View style={styles.half}>
        <FormField label={timeLabel} error={timeError} required={required}>
          <View style={styles.inputRow}>
            <Icon name="clock" size={16} color={colors.forest[400]} />
            <TextInput
              value={timeValue}
              onChangeText={onTimeChange}
              placeholder="hh:mm AM/PM"
              keyboardType="numbers-and-punctuation"
              style={styles.input}
            />
          </View>
        </FormField>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
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
  input: {
    flex: 1,
    borderWidth: 0,
    paddingHorizontal: 0,
  },
});
