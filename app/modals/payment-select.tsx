import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/icons';
import { ScreenHeader } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { formatBZD, safeGoBack } from '@/lib/helpers';
import { showAlert } from '@/lib/alert';
import { ENABLE_EKYASH, EKYASH_COMING_SOON_MESSAGE } from '@/lib/constants';

/**
 * Payment method selection: Cash vs E-Kyash.
 * "Cash is always the answer. E-Kyash is optional."
 */
export default function PaymentSelectModal() {
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
      <ScreenHeader style={styles.header}>
        <Pressable onPress={() => safeGoBack('/(tabs)/explore/')} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Pay</Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

      <View style={styles.content}>
        <Text style={styles.amount}>{formatBZD(amount)}</Text>
        <Text style={styles.subtitle}>Choose how to pay</Text>

        <View style={styles.options}>
          {/* Cash option */}
          <Pressable style={styles.option} onPress={handleCash}>
            <View style={styles.optionIcon}>
              <Icon name="receipt" size={32} color={colors.forest[900]} />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Cash</Text>
              <Text style={styles.optionDesc}>
                Pay the driver directly in person.
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.neutral[400]} />
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
            <Icon name="chevron-right" size={20} color={colors.neutral[400]} />
          </Pressable>
        </View>

        <Text style={styles.note}>
          {ENABLE_EKYASH ? 'Cash is always accepted. E-Kyash is optional.' : 'Cash is available now. E-Kyash is coming soon.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.neutral[0],
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xl,
  },
  amount: {
    ...typography.h1,
    color: colors.forest[900],
    marginTop: spacing.xxl,
  },
  subtitle: {
    ...typography.body1,
    color: colors.neutral[500],
  },
  options: {
    width: '100%',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconEkyash: {
    backgroundColor: '#e8f5e9',
  },
  optionText: {
    flex: 1,
    gap: spacing.xs,
  },
  optionTitle: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  optionDesc: {
    ...typography.body2,
    color: colors.neutral[500],
  },
  note: {
    ...typography.body2,
    color: colors.neutral[400],
    textAlign: 'center',
    marginTop: 'auto' as unknown as number,
    paddingBottom: spacing.xl,
  },
});
