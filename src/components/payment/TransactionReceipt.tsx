import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '@/components/icons';
import { Card } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { formatBZD, formatDate } from '@/lib/helpers';
import type { Database } from '@/types/database';

type EkyashTxnRow = Database['public']['Tables']['ekyash_transactions']['Row'];

interface TransactionReceiptProps {
  transaction: EkyashTxnRow;
  /** Whether current user is the payer */
  isSender: boolean;
}

export function TransactionReceipt({ transaction, isSender }: TransactionReceiptProps) {
  const statusColor = STATUS_COLORS[transaction.status] ?? colors.neutral[400];

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <Icon name="receipt" size={24} color={colors.forest[400]} />
        <Text style={styles.headerTitle}>Transaction Receipt</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.label}>Amount</Text>
        <Text style={styles.amount}>
          {isSender ? '-' : '+'}{formatBZD(transaction.amount_cents)}
        </Text>
      </View>

      {transaction.platform_fee_cents > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>Platform Fee</Text>
          <Text style={styles.value}>{formatBZD(transaction.platform_fee_cents)}</Text>
        </View>
      )}

      {transaction.donation_cents > 0 && (
        <View style={styles.row}>
          <Text style={styles.label}>MHAB Donation</Text>
          <Text style={styles.value}>{formatBZD(transaction.donation_cents)}</Text>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.label}>Status</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
          </Text>
        </View>
      </View>

      {transaction.transaction_id && (
        <View style={styles.row}>
          <Text style={styles.label}>Transaction ID</Text>
          <Text style={styles.value} numberOfLines={1}>
            {transaction.transaction_id}
          </Text>
        </View>
      )}

      <View style={styles.row}>
        <Text style={styles.label}>Date</Text>
        <Text style={styles.value}>
          {formatDate(transaction.created_at)}
        </Text>
      </View>
    </Card>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: colors.warning,
  completed: colors.accent.green,
  failed: colors.error,
  cancelled: colors.neutral[400],
  refunded: colors.forest[400],
};

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { ...typography.body1Bold, color: colors.forest[900] },
  divider: { height: 1, backgroundColor: colors.neutral[200] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { ...typography.body2, color: colors.forest[400] },
  value: { ...typography.body2, color: colors.forest[900], maxWidth: '50%' },
  amount: { ...typography.h3, color: colors.forest[900] },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  statusText: { ...typography.caption, fontWeight: '600' },
});
