import React, { useEffect, useState, useRef } from 'react';
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
import { Button, ScreenHeader } from '@/components/ui';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { formatBZD, safeGoBack } from '@/lib/helpers';
import { showAlert } from '@/lib/alert';
import { ENABLE_EKYASH, EKYASH_COMING_SOON_MESSAGE } from '@/lib/constants';
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
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [createPayment, { data: payment, isLoading, error }] =
    useCreatePaymentMutation();

  // Poll for status once we have an orderId (stop after 10min timeout)
  const { data: statusData } = useGetPaymentStatusQuery(
    payment?.orderId ?? '',
    {
      skip: !ENABLE_EKYASH || !payment?.orderId || pollingTimedOut,
      pollingInterval: 5000,
    },
  );

  // M-11: 10-minute polling timeout
  useEffect(() => {
    if (!ENABLE_EKYASH) return;
    if (payment?.orderId && !pollingTimedOut) {
      timeoutRef.current = setTimeout(() => {
        setPollingTimedOut(true);
      }, 10 * 60 * 1000);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [payment?.orderId, pollingTimedOut]);

  // Create invoice on mount
  useEffect(() => {
    if (!ENABLE_EKYASH) return;
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
    if (!ENABLE_EKYASH) return;
    if (statusData?.status === 'approved') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      showAlert('Payment Successful', 'Your E-Kyash payment has been confirmed!');
      router.dismiss();
    } else if (statusData?.status === 'cancelled') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      showAlert('Payment Cancelled', 'This payment was declined or cancelled.');
      router.back();
    }
  }, [statusData?.status]);

  // Handle polling timeout
  useEffect(() => {
    if (!ENABLE_EKYASH) return;
    if (pollingTimedOut) {
      showAlert(
        'Payment Not Confirmed',
        'We did not receive confirmation within 10 minutes. Check your E-Kyash app or try again.',
      );
    }
  }, [pollingTimedOut]);

  const handleOpenEkyash = async () => {
    if (!ENABLE_EKYASH) {
      showAlert('Coming Soon', EKYASH_COMING_SOON_MESSAGE);
      return;
    }
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
    if (!ENABLE_EKYASH) {
      return (
        <View style={styles.centered}>
          <Icon name="receipt" size={48} color={c.textMuted} />
          <Text style={styles.loadingText}>E-Kyash is coming soon.</Text>
          <Text style={styles.errorText}>{EKYASH_COMING_SOON_MESSAGE}</Text>
          <Button title="Go Back" onPress={() => safeGoBack('/(tabs)/activity/')} variant="outline" />
        </View>
      );
    }

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
          {pollingTimedOut ? (
            <Text style={styles.timeoutText}>Payment confirmation timed out.</Text>
          ) : (
            <>
              <ActivityIndicator size="small" color={colors.accent.green} />
              <Text style={styles.waitingText}>Waiting for payment…</Text>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader style={styles.header}>
        <Pressable
          onPress={() => safeGoBack('/(tabs)/activity/')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle}>E-Kyash Payment</Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

      {renderContent()}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  loadingText: {
    ...type.body.regular,
    color: c.textMuted,
  },
  errorText: {
    ...type.body.regular,
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
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  scanText: {
    ...type.bodySm.regular,
    color: c.textMuted,
  },
  breakdown: {
    width: '100%',
    backgroundColor: c.surface,
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
    ...type.bodySm.regular,
    color: c.textMuted,
  },
  breakdownValue: {
    ...type.bodySm.regular,
    color: c.text,
  },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  breakdownTotalLabel: {
    ...type.body.bold,
    color: c.text,
  },
  breakdownTotalValue: {
    ...type.body.bold,
    color: c.text,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 'auto' as unknown as number,
    paddingBottom: spacing.lg,
  },
  waitingText: {
    ...type.bodySm.regular,
    color: colors.accent.green,
  },
  timeoutText: {
    ...type.bodySm.regular,
    color: colors.error,
  },
});
