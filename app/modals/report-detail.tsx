import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { Icon } from '@/components/icons';
import { GlassView } from '@/components/ui/GlassView';
import { getTimeAgo, safeGoBack } from '@/lib/helpers';
import { MAPBOX_ACCESS_TOKEN } from '@/lib/mapbox';
import {
  useGetRoadReportsQuery,
  useUpvoteRoadReportMutation,
  useReportGoneMutation,
} from '@/store/api/reportsApi';

const safeBack = () => safeGoBack('/(tabs)/profile/reports');

const REPORT_TYPE_LABELS: Record<string, string> = {
  accident: 'Accident',
  checkpoint: 'Checkpoint',
  traffic: 'Traffic',
  flooding: 'Flooding',
  construction: 'Construction',
  road_damage: 'Road Damage',
};

export default function ReportDetailModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: reports } = useGetRoadReportsQuery();
  const [upvote, { isLoading: upvoting }] = useUpvoteRoadReportMutation();
  const [reportGone, { isLoading: reporting }] = useReportGoneMutation();

  const report = reports?.find((r) => r.id === id);

  if (!report) {
    return (
      <SafeAreaView style={styles.container}>
        <GlassView tint="dark" intensity={80} style={styles.header}>
          <Pressable onPress={safeBack} hitSlop={12}>
            <Icon name="x" size={24} color={colors.neutral[0]} />
          </Pressable>
          <Text style={styles.headerTitle}>Report</Text>
          <View style={{ width: 24 }} />
        </GlassView>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Report not found or has been removed.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const age = getTimeAgo(report.created_at);
  const goneCount = report.gone_count ?? 0;

  const staticMapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+e8a838(${report.lng},${report.lat})/${report.lng},${report.lat},14,0/600x300@2x?access_token=${MAPBOX_ACCESS_TOKEN}`;

  const handleStillHere = async () => {
    try {
      await upvote(report.id).unwrap();
      showAlert('Thanks!', 'Your confirmation has been recorded.');
    } catch {
      showAlert('Error', 'Could not confirm the report.');
    }
  };

  const handleGone = async () => {
    try {
      await reportGone(report.id).unwrap();
      showAlert('Thanks!', 'Your feedback has been recorded.');
      safeBack();
    } catch {
      showAlert('Error', 'Could not submit your feedback.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <GlassView tint="dark" intensity={80} style={styles.header}>
        <Pressable onPress={safeBack} hitSlop={12}>
          <Icon name="x" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Report Detail</Text>
        <View style={{ width: 24 }} />
      </GlassView>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Static map */}
        <View style={styles.mapContainer}>
          <Image
            source={{ uri: staticMapUrl }}
            style={styles.mapImage}
            resizeMode="cover"
          />
        </View>

        {/* Type badge */}
        <View style={styles.typeBadge}>
          <Icon name="alert-triangle" size={20} color={colors.warning} />
          <Text style={styles.typeText}>
            {REPORT_TYPE_LABELS[report.type] ?? report.type}
          </Text>
        </View>

        {/* Description */}
        {report.description ? (
          <Text style={styles.description}>{report.description}</Text>
        ) : (
          <Text style={styles.noDescription}>No additional details provided.</Text>
        )}

        {/* Meta */}
        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <Icon name="clock" size={16} color={colors.neutral[400]} />
            <Text style={styles.metaText}>Reported {age}</Text>
          </View>
          <View style={styles.metaRow}>
            <Icon name="map-pin" size={16} color={colors.neutral[400]} />
            <Text style={styles.metaText}>
              {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Icon name="user" size={16} color={colors.neutral[400]} />
            <Text style={styles.metaText}>
              Confirmed by {report.upvotes} {report.upvotes === 1 ? 'user' : 'users'}
            </Text>
          </View>
          {goneCount > 0 && (
            <View style={styles.metaRow}>
              <Icon name="alert-triangle" size={16} color={colors.neutral[400]} />
              <Text style={styles.metaText}>
                Reported gone by {goneCount} {goneCount === 1 ? 'user' : 'users'}
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.spacer} />
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, styles.stillHereBtn]}
            onPress={handleStillHere}
            disabled={upvoting || reporting}
          >
            <Icon name="star" size={20} color={colors.neutral[0]} />
            <Text style={styles.actionBtnText}>Still There</Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.goneBtn]}
            onPress={handleGone}
            disabled={upvoting || reporting}
          >
            <Icon name="x" size={20} color={colors.neutral[0]} />
            <Text style={styles.actionBtnText}>It&apos;s Gone</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyText: { ...typography.body1, color: colors.neutral[500], textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.h3, color: colors.neutral[0], flex: 1, textAlign: 'center' },

  content: {
    flex: 1,
  },
  contentInner: {
    padding: spacing.lg,
    gap: spacing.lg,
    flexGrow: 1,
  },
  mapContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  mapImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
  },
  spacer: {
    flex: 1,
  },

  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  typeText: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },

  description: {
    ...typography.body1,
    color: colors.forest[700],
  },
  noDescription: {
    ...typography.body2,
    color: colors.neutral[400],
    fontStyle: 'italic',
  },

  metaSection: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: {
    ...typography.body2,
    color: colors.neutral[500],
  },

  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  stillHereBtn: {
    backgroundColor: colors.accent.green,
  },
  goneBtn: {
    backgroundColor: colors.warning,
  },
  actionBtnText: {
    ...typography.body1Bold,
    color: colors.neutral[0],
  },
});
