import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { Card, EmptyState } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useGetPaymentHistoryQuery } from '@/store/api/ekyashApi';
import { formatBZD, formatDate, safeGoBack } from '@/lib/helpers';
import type { RootState } from '@/store';
import type { Database } from '@/types/database';

type EkyashTxnRow = Database['public']['Tables']['ekyash_transactions']['Row'];

export default function WalletScreen() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: transactions, isLoading, refetch, isFetching } = useGetPaymentHistoryQuery(
    userId ?? '',
    { skip: !userId },
  );

  const renderTransaction = useCallback(
    ({ item }: { item: EkyashTxnRow }) => {
      const isSender = item.payer_id === userId;
      const statusConfig = TXN_STATUS[item.status] ?? TXN_STATUS.pending;

      return (
        <Card style={styles.txnCard}>
          <View style={styles.txnHeader}>
            <View style={[styles.directionBadge, { backgroundColor: isSender ? '#ffebee' : '#e8f5e9' }]}>
              <Text style={[styles.directionText, { color: isSender ? colors.error : colors.accent.green }]}>
                {isSender ? 'Sent' : 'Received'}
              </Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>

          <View style={styles.txnBody}>
            <Text style={styles.amount}>
              {isSender ? '-' : '+'}{formatBZD(item.amount_cents)}
            </Text>
            {item.platform_fee_cents > 0 && (
              <Text style={styles.feeText}>
                Fee: {formatBZD(item.platform_fee_cents)}
                {item.donation_cents > 0 ? ` · Donation: ${formatBZD(item.donation_cents)}` : ''}
              </Text>
            )}
          </View>

          <View style={styles.txnFooter}>
            {item.transaction_id && (
              <Text style={styles.txnId} numberOfLines={1}>
                Txn: {item.transaction_id}
              </Text>
            )}
            <Text style={styles.txnDate}>{formatDate(item.created_at)}</Text>
          </View>
        </Card>
      );
    },
    [userId],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack('/(tabs)/profile/')} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>E-Kyash Wallet</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <Icon name="receipt" size={32} color={colors.neutral[0]} />
        <View>
          <Text style={styles.summaryLabel}>Total Transactions</Text>
          <Text style={styles.summaryValue}>{transactions?.length ?? 0}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent.green} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onRefresh={refetch}
          refreshing={isFetching && !isLoading}
          ListEmptyComponent={
            <EmptyState
              icon="receipt"
              title="No transactions yet"
              message="Your E-Kyash payment history will appear here."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const TXN_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: colors.warning },
  approved: { label: 'Approved', color: colors.accent.green },
  cancelled: { label: 'Cancelled', color: colors.neutral[400] },
  refunded: { label: 'Refunded', color: colors.forest[400] },
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.forest[900],
  },
  headerTitle: { ...typography.h3, color: colors.neutral[0], flex: 1, textAlign: 'center' },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    margin: spacing.lg,
    marginBottom: 0,
    padding: spacing.xl,
    borderRadius: borderRadius.md,
    backgroundColor: colors.forest[600],
  },
  summaryLabel: { ...typography.caption, color: colors.neutral[200] },
  summaryValue: { ...typography.h2, color: colors.neutral[0] },

  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  separator: { height: spacing.md },

  txnCard: { padding: spacing.lg, gap: spacing.sm },
  txnHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  directionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  directionText: { ...typography.caption, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 'auto' },
  statusText: { ...typography.caption },

  txnBody: { gap: spacing.xs },
  amount: { ...typography.h3, color: colors.forest[900] },
  feeText: { ...typography.caption, color: colors.neutral[400] },

  txnFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  txnId: { ...typography.caption, color: colors.neutral[400], flex: 1, marginRight: spacing.md },
  txnDate: { ...typography.caption, color: colors.neutral[500] },
});
