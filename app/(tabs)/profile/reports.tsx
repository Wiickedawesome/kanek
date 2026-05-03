import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { Card, EmptyState, ScreenHeader } from '@/components/ui';
import { getTimeAgo, safeGoBack } from '@/lib/helpers';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useGetGasPricesQuery } from '@/store/api/reportsApi';
import type { RootState } from '@/store';
import type { Database } from '@/types/database';

type GasPriceRow = Database['public']['Tables']['gas_prices']['Row'];

type ReportItem = { type: 'gas'; data: GasPriceRow };

export default function ReportsScreen() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  const {
    data: gasPrices,
    isLoading,
    refetch,
    isFetching,
  } = useGetGasPricesQuery();

  const myGasPrices = (gasPrices ?? []).filter((g) => g.reporter_id === userId);

  const sections = myGasPrices.length > 0
    ? [{ title: 'Gas Price Reports', data: myGasPrices.map((g) => ({ type: 'gas' as const, data: g })) }]
    : [];

  const renderItem = useCallback(({ item }: { item: ReportItem }) => {
    const g = item.data;
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Icon name="fuel" size={18} color={colors.forest[400]} />
          <Text style={styles.reportType}>{g.station_name}</Text>
          {(g.verified_count ?? 0) > 0 && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
        {g.regular_cents != null && (
          <Text style={styles.priceText}>Regular: ${(g.regular_cents / 100).toFixed(2)} BZD/Belize gal</Text>
        )}
        {g.premium_cents != null && (
          <Text style={styles.priceText}>Premium: ${(g.premium_cents / 100).toFixed(2)} BZD/Belize gal</Text>
        )}
        {g.diesel_cents != null && (
          <Text style={styles.priceText}>Diesel: ${(g.diesel_cents / 100).toFixed(2)} BZD/Belize gal</Text>
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.footerDate}>{getTimeAgo(g.reported_at)}</Text>
        </View>
      </Card>
    );
  }, []);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader style={styles.header}>
        <Pressable onPress={() => safeGoBack('/(tabs)/profile/')} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>My Fuel Reports</Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent.green} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="fuel"
            title="No reports yet"
            message="Your gas price reports will appear here."
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          keyExtractor={(item) => item.data.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={onRefresh}
              tintColor={colors.accent.green}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[100] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.h3, color: colors.neutral[0], flex: 1, textAlign: 'center' },

  list: { padding: spacing.lg, paddingBottom: spacing.lg },
  separator: { height: spacing.md },

  sectionHeader: {
    ...typography.body1Bold,
    color: colors.forest[400],
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },

  card: { padding: spacing.lg, gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reportType: { ...typography.body1Bold, color: colors.forest[900], flex: 1 },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  footerDate: { ...typography.caption, color: colors.neutral[500] },

  priceText: { ...typography.body1Bold, color: colors.forest[900] },

  verifiedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
    backgroundColor: '#e8f5e9',
  },
  verifiedText: { ...typography.caption, color: colors.accent.green, fontWeight: '600' },
});
