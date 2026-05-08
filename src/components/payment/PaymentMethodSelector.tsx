import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, type, spacing, borderRadius } from '@/theme';
import { Text } from '@/components/ui/Text';

type PaymentMethod = 'cash' | 'ekyash';

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}

export function PaymentMethodSelector({ selected, onSelect }: PaymentMethodSelectorProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.option, selected === 'cash' && styles.optionSelected]}
        onPress={() => onSelect('cash')}
      >
        <Icon name="receipt" size={24} color={selected === 'cash' ? colors.accent.green : colors.neutral[400]} />
        <Text style={[styles.optionLabel, selected === 'cash' && styles.optionLabelSelected]}>
          Cash
        </Text>
        <Text style={styles.optionHint}>Pay the driver directly</Text>
      </Pressable>

      <Pressable
        style={[styles.option, selected === 'ekyash' && styles.optionSelected]}
        onPress={() => onSelect('ekyash')}
      >
        <Icon name="qr-code" size={24} color={selected === 'ekyash' ? colors.accent.green : colors.neutral[400]} />
        <Text style={[styles.optionLabel, selected === 'ekyash' && styles.optionLabelSelected]}>
          E-Kyash
        </Text>
        <Text style={styles.optionHint}>Pay via QR code</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: spacing.md },
  option: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  optionSelected: {
    borderColor: colors.accent.green,
    backgroundColor: 'rgba(81, 193, 82, 0.18)',
  },
  optionLabel: { ...type.body.bold, color: colors.neutral[500] },
  optionLabelSelected: { color: colors.accent.green },
  optionHint: { ...type.caption.regular, color: colors.neutral[400], textAlign: 'center' },
});
