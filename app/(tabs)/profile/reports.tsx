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
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { Card, EmptyState } from '@/components/ui';
import { getTimeAgo } from '@/lib/helpers';
import { colors, typography, spacing, borderRadius } from '@/theme';
import {
  useGetRoadReportsQuery,
  useGetGasPricesQuery,
} from '@/store/api/reportsApi';
import type { RootState } from '@/store';
import type { Database } from '@/types/database';

type RoadReportRow = Database['public']['Tables']['road_reports']['Row'];
type GasPriceRow = Database['public']['Tables']['gas_prices']['Row'];

type ReportItem =
  | { type: 'road'; data: RoadReportRow }
  | { type: 'gas'; data: GasPriceRow };

export default function ReportsScreen() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  const {
    data: roadReports,
    isLoading: roadLoading,
    refetch: refetchRoad,
    isFetching: roadFetching,
  } = useGetRoadReportsQuery();
  const {
    data: gasPrices,
    isLoading: gasLoading,
    refetch: refetchGas,
    isFetching: gasFetching,
  } = useGetGasPricesQuery();

  const isLoading = roadLoading || gasLoading;
  const isFetching = roadFetching || gasFetching;

  // Filter to current user's reports
  const myRoadReports = (roadReports ?? []).filter((r) => r.reporter_id === userId);
  const myGasPrices = (gasPrices ?? []).filter((g) => g.reporter_id === userId);

  const sections = [
    ...(myRoadReports.length > 0
      ? [{ title: 'Road Reports', data: myRoadReports.map((r) => ({ type: 'road' as const, data: r })) }]
      : []),
    ...(myGasPrices.length > 0
      ? [{ title: 'Gas Price Reports', data: myGasPrices.map((g) => ({ type: 'gas' as const, data: g })) }]
      : []),
  ];

  const renderItem = useCallback(({ item }: { item: ReportItem }) => {
    if (item.type === 'road') {
      const r = item.data;
      return (
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="construction" size={18} color={colors.forest[400]} />
            <Text style={styles.reportType}>{formatReportType(r.type)}</Text>
          </View>
          {r.description && (
            <Text style={styles.description} numberOfLines={2}>
              {r.description}
            </Text>
          )}
          <View style={styles.cardFooter}>
            <View style={styles.footerInfo}>
              <Icon name="map-pin" size={14} color={colors.neutral[400]} />
              <Text style={styles.footerText}>
                {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
              </Text>
            </View>
            <Text style={styles.footerDate}>{getTimeAgo(r.created_at)}</Text>
          </View>
          <View style={styles.statRow}>
            <Icon name="star" size={14} color={colors.forest[400]} />
            <Text style={styles.statText}>{r.upvotes} upvotes</Text>
          </View>
        </Card>
      );
    }

    const g = item.data;
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Icon name="fuel" size={18} color={colors.forest[400]} />
          <Text style={styles.reportType}>{g.station_name}</Text>
          {g.verified_count > 0 && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
        {g.regular_cents != null && (
          <Text style={styles.priceText}>Regular: ${(g.regular_cents / 100).toFixed(2)} BZD/gal</Text>
        )}
        {g.premium_cents != null && (
          <Text style={styles.priceText}>Premium: ${(g.premium_cents / 100).toFixed(2)} BZD/gal</Text>
        )}
        {g.diesel_cents != null && (
          <Text style={styles.priceText}>Diesel: ${(g.diesel_cents / 100).toFixed(2)} BZD/gal</Text>
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.footerDate}>{getTimeAgo(g.reported_at)}</Text>
        </View>
      </Card>
    );
  }, []);

  const onRefresh = useCallback(() => {
    refetchRoad();
    refetchGas();
  }, [refetchRoad, refetchGas]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="navigation" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>My Reports</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent.green} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="construction"
            title="No reports yet"
            message="Your road and gas price reports will appear here."
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

function formatReportType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}


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

  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
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
  description: { ...typography.body2, color: colors.forest[500] },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  footerInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  footerText: { ...typography.caption, color: colors.neutral[400] },
  footerDate: { ...typography.caption, color: colors.neutral[500] },

  statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statText: { ...typography.caption, color: colors.forest[400] },

  priceText: { ...typography.body1Bold, color: colors.forest[900] },

  verifiedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
    backgroundColor: '#e8f5e9',
  },
  verifiedText: { ...typography.caption, color: colors.accent.green, fontWeight: '600' },
});
