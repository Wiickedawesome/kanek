import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/icons';
import { ScreenHeader } from '@/components/ui';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { formatBZD, safeGoBack } from '@/lib/helpers';
import { showAlert } from '@/lib/alert';
import { ENABLE_EKYASH, EKYASH_COMING_SOON_MESSAGE } from '@/lib/constants';
import { Text } from '@/components/ui/Text';

/**
 * Payment method selection: Cash vs E-Kyash.
 * "Cash is always the answer. E-Kyash is optional."
 */
export default function PaymentSelectModal() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const { contractId, payerId, payeeId, amountCents, description, payerPhone } =
    useLocalSearchParams<{
      contractId: string;
      payerId: string;
      payeeId: string;
      amountCents: string;
      description: string;
      payerPhone: string;
    }>();

  const amount = Number(amountCents) || 0;

  const handleCash = () => {
    // Cash — just close modal; booking already confirmed
    router.back();
  };

  const handleEkyash = () => {
    if (!ENABLE_EKYASH) {
      showAlert('Coming Soon', EKYASH_COMING_SOON_MESSAGE);
      return;
    }
    router.push({
      pathname: '/modals/ekyash-pay',
      params: { contractId, payerId, payeeId, amountCents, description, payerPhone },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Pay" onBack={() => safeGoBack('/(tabs)/explore/')} />

      <View style={styles.content}>
        <Text style={styles.amount}>{formatBZD(amount)}</Text>
        <Text style={styles.subtitle}>Choose how to pay</Text>

        <View style={styles.options}>
          {/* Cash option */}
          <Pressable style={styles.option} onPress={handleCash}>
            <View style={styles.optionIcon}>
              <Icon name="receipt" size={32} color={c.text} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Cash</Text>
              <Text style={styles.optionDesc}>
                Pay the driver directly in person.
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={c.textMuted} />
          </Pressable>

          {/* E-Kyash option */}
          <Pressable style={styles.option} onPress={handleEkyash}>
            <View style={[styles.optionIcon, styles.optionIconEkyash]}>
              <Icon name="qr-code" size={32} color={colors.accent.green} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>E-Kyash</Text>
              <Text style={styles.optionDesc}>
                {ENABLE_EKYASH ? 'Pay instantly via QR code or deep link.' : 'Coming soon for a later launch.'}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={c.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.note}>
          {ENABLE_EKYASH ? 'Cash is always accepted. E-Kyash is optional.' : 'Cash is available now. E-Kyash is coming soon.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...type.h3.bold,
    color: c.text,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xl,
  },
  amount: {
    ...type.h1.bold,
    color: c.text,
    marginTop: spacing.xxl,
  },
  subtitle: {
    ...type.body.regular,
    color: c.textMuted,
  },
  options: {
    width: '100%',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconEkyash: {
    backgroundColor: 'rgba(81, 193, 82, 0.18)',
  },
  optionText: {
    flex: 1,
    gap: spacing.xs,
  },
  optionTitle: {
    ...type.body.bold,
    color: c.text,
  },
  optionDesc: {
    ...type.bodySm.regular,
    color: c.textMuted,
  },
  note: {
    ...type.bodySm.regular,
    color: c.textMuted,
    textAlign: 'center',
    marginTop: 'auto' as unknown as number,
    paddingBottom: spacing.xl,
  },
});
