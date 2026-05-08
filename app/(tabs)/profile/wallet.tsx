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
import { Card, EmptyState, ScreenHeader, useFloatingTabBarPad } from '@/components/ui';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { useGetPaymentHistoryQuery } from '@/store/api/ekyashApi';
import { formatBZD, formatDate, safeGoBack } from '@/lib/helpers';
import { ENABLE_EKYASH, EKYASH_COMING_SOON_MESSAGE } from '@/lib/constants';
import type { RootState } from '@/store';
import type { Database } from '@/types/database';

type EkyashTxnRow = Database['public']['Tables']['ekyash_transactions']['Row'];

export default function WalletScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const tabBarPad = useFloatingTabBarPad();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: transactions, isLoading, refetch, isFetching } = useGetPaymentHistoryQuery(
    userId ?? '',
    { skip: !userId || !ENABLE_EKYASH },
  );

  const renderTransaction = useCallback(
    ({ item }: { item: EkyashTxnRow }) => {
      const isSender = item.payer_id === userId;
      const statusConfig = TXN_STATUS[item.status] ?? TXN_STATUS.pending;

      return (
        <Card style={styles.txnCard}>
          <View style={styles.txnHeader}>
            <View style={[styles.directionBadge, { backgroundColor: isSender ? 'rgba(211, 47, 47, 0.22)' : 'rgba(81, 193, 82, 0.18)' }]}>
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader style={styles.header}>
        <Pressable
          onPress={() => safeGoBack('/(tabs)/profile/')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle}>E-Kyash Wallet</Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <Icon name="receipt" size={32} color={colors.neutral[0]} />
        <View>
          <Text style={styles.summaryLabel}>Total Transactions</Text>
          <Text style={styles.summaryValue}>{transactions?.length ?? 0}</Text>
        </View>
      </View>

      {!ENABLE_EKYASH ? (
        <View style={styles.list}>
          <EmptyState
            icon="receipt"
            title="E-Kyash is coming soon"
            message={EKYASH_COMING_SOON_MESSAGE}
          />
        </View>
      ) : isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent.green} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarPad }]}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
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
  cancelled: { label: 'Cancelled', color: colors.neutral[500] },
  refunded: { label: 'Refunded', color: colors.neutral[500] },
};


const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...type.h3.bold, color: c.text, flex: 1, textAlign: 'center' },

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
  summaryLabel: { ...type.caption.regular, color: colors.neutral[200] },
  summaryValue: { ...type.h2.bold, color: c.textInverse },

  list: { padding: spacing.lg, paddingBottom: spacing.lg },
  separator: { height: spacing.md },

  txnCard: { padding: spacing.lg, gap: spacing.sm },
  txnHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  directionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  directionText: { ...type.caption.regular, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 'auto' },
  statusText: { ...type.caption.regular },

  txnBody: { gap: spacing.xs },
  amount: { ...type.h3.bold, color: c.text },
  feeText: { ...type.caption.regular, color: c.textMuted },

  txnFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  txnId: { ...type.caption.regular, color: c.textMuted, flex: 1, marginRight: spacing.md },
  txnDate: { ...type.caption.regular, color: c.textMuted },
});
