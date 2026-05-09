import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, TextInput as RNTextInput } from 'react-native';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { Text } from '@/components/ui/Text';

interface TimeInputProps {
  label: string;
  value: string; // stored as "HH:MM" 24-hour for backend
  onChangeText: (text: string) => void;
  error?: string;
}

/**
 * Time input with separate hour/minute fields and AM/PM toggle.
 * Stores value as 24-hour "HH:MM" string for backend compatibility.
 */
export function TimeInput({ label, value, onChangeText, error }: TimeInputProps) {
  const { c } = useTheme();
  const styles = createStyles(c);
  // Parse current value into display parts
  const parsed = parse24(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.period);

  const emit = useCallback(
    (h: string, m: string, p: 'AM' | 'PM') => {
      const hNum = parseInt(h, 10);
      const mNum = parseInt(m, 10);
      if (isNaN(hNum) || isNaN(mNum)) {
        onChangeText('');
        return;
      }
      // Convert 12-hour to 24-hour
      let h24 = hNum % 12;
      if (p === 'PM') h24 += 12;
      onChangeText(`${String(h24).padStart(2, '0')}:${String(mNum).padStart(2, '0')}`);
    },
    [onChangeText],
  );

  const handleHourChange = useCallback(
    (text: string) => {
      const clean = text.replace(/\D/g, '').slice(0, 2);
      setHour(clean);
      emit(clean, minute, period);
    },
    [minute, period, emit],
  );

  const handleMinuteChange = useCallback(
    (text: string) => {
      const clean = text.replace(/\D/g, '').slice(0, 2);
      setMinute(clean);
      emit(hour, clean, period);
    },
    [hour, period, emit],
  );

  const togglePeriod = useCallback(
    (p: 'AM' | 'PM') => {
      setPeriod(p);
      emit(hour, minute, p);
    },
    [hour, minute, emit],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.row, styles.rowCompact]}>
        <View style={[styles.inputRow, error ? styles.errorBorder : undefined]}>
          <RNTextInput
            style={styles.timeField}
            placeholder="hh"
            placeholderTextColor={c.textMuted}
            value={hour}
            onChangeText={handleHourChange}
            keyboardType="number-pad"
            maxLength={2}
            selectTextOnFocus
          />
          <Text style={styles.colon}>:</Text>
          <RNTextInput
            style={styles.timeField}
            placeholder="mm"
            placeholderTextColor={c.textMuted}
            value={minute}
            onChangeText={handleMinuteChange}
            keyboardType="number-pad"
            maxLength={2}
            selectTextOnFocus
          />
        </View>
        <View style={[styles.toggleTrack, styles.toggleTrackCompact]}>
          <Pressable
            style={[styles.toggleSeg, styles.toggleSegCompact, period === 'AM' && styles.toggleSegActive]}
            onPress={() => togglePeriod('AM')}
          >
            <Text style={[styles.toggleText, period === 'AM' && styles.toggleTextActive]}>
              AM
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleSeg, styles.toggleSegCompact, period === 'PM' && styles.toggleSegActive]}
            onPress={() => togglePeriod('PM')}
          >
            <Text style={[styles.toggleText, period === 'PM' && styles.toggleTextActive]}>
              PM
            </Text>
          </Pressable>
        </View>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** Parse a "HH:MM" 24-hour string into 12-hour display parts */
function parse24(value: string): { hour: string; minute: string; period: 'AM' | 'PM' } {
  if (!value || !value.includes(':')) return { hour: '', minute: '', period: 'AM' };
  const [hStr, mStr] = value.split(':');
  let h = parseInt(hStr, 10);
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { hour: String(h), minute: mStr, period };
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
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
  timeField: {
    ...type.body.regular,
    color: c.text,
    textAlign: 'center',
    width: 32,
  },
  colon: {
    ...type.body.regular,
    color: c.text,
    fontWeight: '600',
  },
  toggleTrack: {
    flexDirection: 'row',
    backgroundColor: c.border,
    borderRadius: borderRadius.pill,
    padding: 3,
  },
  toggleTrackCompact: {
    width: '100%',
  },
  toggleSeg: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleSegCompact: {
    flex: 1,
  },
  toggleSegActive: {
    // Bright accent green so the active segment is visible on both light
    // and dark tracks. Paired with a fixed-dark text colour below.
    backgroundColor: colors.accent.green,
  },
  toggleText: {
    ...type.caption.regular,
    fontWeight: '700',
    color: c.textMuted,
  },
  toggleTextActive: {
    // Always dark — sits on the always-bright green active pill.
    color: colors.forest[900],
  },
  error: {
    ...type.caption.regular,
    color: colors.error,
  },
});
