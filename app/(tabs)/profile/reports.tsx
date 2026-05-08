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
import { Card, EmptyState, ScreenHeader, useFloatingTabBarPad } from '@/components/ui';
import { getTimeAgo, safeGoBack } from '@/lib/helpers';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { useGetGasPricesQuery } from '@/store/api/reportsApi';
import type { RootState } from '@/store';
import type { Database } from '@/types/database';

type GasPriceRow = Database['public']['Tables']['gas_prices']['Row'];

type ReportItem = { type: 'gas'; data: GasPriceRow };

export default function ReportsScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const tabBarPad = useFloatingTabBarPad();
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
          <Icon name="fuel" size={18} color={c.textMuted} />
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
        <Pressable
          onPress={() => safeGoBack('/(tabs)/profile/')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={24} color={c.text} />
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
          contentContainerStyle={[styles.list, { paddingBottom: tabBarPad }]}
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

  list: { padding: spacing.lg, paddingBottom: spacing.lg },
  separator: { height: spacing.md },

  sectionHeader: {
    ...type.body.bold,
    color: c.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },

  card: { padding: spacing.lg, gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reportType: { ...type.body.bold, color: c.text, flex: 1 },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  footerDate: { ...type.caption.regular, color: c.textMuted },

  priceText: { ...type.body.bold, color: c.text },

  verifiedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(81, 193, 82, 0.18)',
  },
  verifiedText: { ...type.caption.regular, color: colors.accent.green, fontWeight: '600' },
});
