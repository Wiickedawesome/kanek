import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Icon } from '@/components/icons';
import { Card } from '@/components/ui';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { formatBZD, formatDate } from '@/lib/helpers';
import type { Database } from '@/types/database';
import { Text } from '@/components/ui/Text';

type EkyashTxnRow = Database['public']['Tables']['ekyash_transactions']['Row'];

interface TransactionReceiptProps {
  transaction: EkyashTxnRow;
  /** Whether current user is the payer */
  isSender: boolean;
}

export function TransactionReceipt({ transaction, isSender }: TransactionReceiptProps) {
  const { c } = useTheme();
  const styles = createStyles(c);
  const statusColor = STATUS_COLORS[transaction.status] ?? '#6b7264';

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <Icon name="receipt" size={24} color={c.textMuted} />
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
  cancelled: '#6b7264',
  refunded: '#525a4c',
};

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerTitle: { ...type.body.bold, color: c.text },
    divider: { height: 1, backgroundColor: c.border },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    label: { ...type.bodySm.regular, color: c.textMuted },
    value: { ...type.bodySm.regular, color: c.text, maxWidth: '50%' },
    amount: { ...type.h3.bold, color: c.text },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.pill,
    },
    statusText: { ...type.caption.regular, fontWeight: '600' },
  });
