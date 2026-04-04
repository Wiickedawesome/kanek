import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { TopographicBg } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { formatBZD, safeGoBack } from '@/lib/helpers';
import { showAlert } from '@/lib/alert';
import {
  useCreatePaymentMutation,
  useGetPaymentStatusQuery,
} from '@/store/api/ekyashApi';

/**
 * E-Kyash payment screen:
 * 1. Creates invoice via edge function
 * 2. Shows QR code (qrUrl) for in-person scan
 * 3. "Open E-Kyash" button (paymentLink deep link)
 * 4. Polls for payment status
 */
export default function EkyashPayModal() {
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

  const [createPayment, { data: payment, isLoading, error }] =
    useCreatePaymentMutation();

  // Poll for status once we have an orderId
  const { data: statusData } = useGetPaymentStatusQuery(
    payment?.orderId ?? '',
    {
      skip: !payment?.orderId,
      pollingInterval: 5000,
    },
  );

  // Create invoice on mount
  useEffect(() => {
    if (contractId && payerId && payeeId && amount > 0) {
      createPayment({
        contractId,
        payerId,
        payeeId,
        amountCents: amount,
        description: description ?? '',
        payerPhone: payerPhone ?? '',
      });
    }
  }, [contractId, payerId, payeeId, amount, description, payerPhone, createPayment]);

  // Handle status changes
  useEffect(() => {
    if (statusData?.status === 'approved') {
      showAlert('Payment Successful', 'Your E-Kyash payment has been confirmed!');
      router.dismiss();
    } else if (statusData?.status === 'cancelled') {
      showAlert('Payment Cancelled', 'This payment was declined or cancelled.');
      router.back();
    }
  }, [statusData?.status]);

  const handleOpenEkyash = async () => {
    if (!payment?.paymentLink) return;
    const canOpen = await Linking.canOpenURL(payment.paymentLink);
    if (canOpen) {
      await Linking.openURL(payment.paymentLink);
    } else {
      showAlert(
        'E-Kyash Not Found',
        'Please install the E-Kyash app to pay via deep link, or scan the QR code.',
      );
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent.green} />
          <Text style={styles.loadingText}>Creating invoice…</Text>
        </View>
      );
    }

    if (error || !payment) {
      return (
        <View style={styles.centered}>
          <Icon name="alert-triangle" size={48} color={colors.error} />
          <Text style={styles.errorText}>
            Could not create invoice. Please try again.
          </Text>
          <Button title="Go Back" onPress={() => safeGoBack('/(tabs)/activity/')} variant="outline" />
        </View>
      );
    }

    return (
      <View style={styles.payContent}>
        {/* QR Code */}
        <View style={styles.qrContainer}>
          <Image
            source={{ uri: payment.qrUrl }}
            style={styles.qrImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.scanText}>Scan with E-Kyash app to pay</Text>

        {/* Amount breakdown */}
        <View style={styles.breakdown}>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Amount</Text>
            <Text style={styles.breakdownValue}>
              {formatBZD(payment.amountCents)}
            </Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Platform fee (3%)</Text>
            <Text style={styles.breakdownValue}>
              {formatBZD(payment.platformFeeCents)}
            </Text>
          </View>
          {payment.donationCents > 0 && (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Community donation</Text>
              <Text style={styles.breakdownValue}>
                {formatBZD(payment.donationCents)}
              </Text>
            </View>
          )}
          <View style={[styles.breakdownRow, styles.breakdownTotal]}>
            <Text style={styles.breakdownTotalLabel}>Total</Text>
            <Text style={styles.breakdownTotalValue}>
              {formatBZD(
                payment.amountCents +
                  payment.platformFeeCents +
                  payment.donationCents,
              )}
            </Text>
          </View>
        </View>

        {/* Open E-Kyash deep link */}
        {payment.paymentLink && (
          <Button
            title="Open E-Kyash App"
            onPress={handleOpenEkyash}
            size="lg"
          />
        )}

        {/* Waiting indicator */}
        <View style={styles.waitingRow}>
          <ActivityIndicator size="small" color={colors.accent.green} />
          <Text style={styles.waitingText}>Waiting for payment…</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopographicBg />
      <LinearGradient colors={[colors.forest[900], colors.forest[700]]} style={styles.header}>
        <Pressable onPress={() => safeGoBack('/(tabs)/activity/')} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>E-Kyash Payment</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body1,
    color: colors.neutral[500],
  },
  errorText: {
    ...typography.body1,
    color: colors.error,
    textAlign: 'center',
  },
  payContent: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xl,
  },
  qrContainer: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  scanText: {
    ...typography.body2,
    color: colors.neutral[500],
  },
  breakdown: {
    width: '100%',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    ...typography.body2,
    color: colors.neutral[500],
  },
  breakdownValue: {
    ...typography.body2,
    color: colors.forest[900],
  },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  breakdownTotalLabel: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  breakdownTotalValue: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 'auto' as unknown as number,
    paddingBottom: spacing.lg,
  },
  waitingText: {
    ...typography.body2,
    color: colors.accent.green,
  },
});
