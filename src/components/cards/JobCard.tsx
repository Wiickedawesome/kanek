import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { Icon } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatBZD, formatDeparture } from '@/lib/helpers';
import type { PostWithAuthor } from '@/store/api/postsApi';

const TIMELINE_LABELS: Record<string, string> = {
  asap: 'ASAP',
  today: 'Today',
  this_week: 'This Week',
  flexible: 'Flexible',
};

const CATEGORY_LABELS: Record<string, string> = {
  skilled_trade: 'Skilled Trade',
  cleaning: 'Cleaning',
  delivery: 'Delivery',
  handyman: 'Handyman',
  landscaping: 'Landscaping',
  moving: 'Moving',
  tutoring: 'Tutoring',
  tech: 'Tech',
  other: 'Other',
};

interface JobCardProps {
  post: PostWithAuthor;
  onPress?: () => void;
}

export const JobCard = React.memo(function JobCard({ post, onPress }: JobCardProps) {
  const authorName = post.author
    ? `${post.author.first_name ?? ''} ${(post.author.last_name ?? '')[0] ?? ''}.`.trim()
    : 'Unknown';

  const payLabel = post.pay_rate_cents
    ? `${formatBZD(post.pay_rate_cents)}${post.pay_type === 'hourly' ? '/hr' : ' fixed'}`
    : null;
  const scheduledAt = post.departure_at ? formatDeparture(post.departure_at) : null;

  return (
    <Card onPress={onPress} style={styles.card}>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <PostTypeBadge type="job" />
          {post.job_category && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText}>
                {CATEGORY_LABELS[post.job_category] ?? post.job_category}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={1}>{post.title}</Text>

        {post.description && (
          <Text style={styles.description} numberOfLines={2}>{post.description}</Text>
        )}

        {/* Details row: pay + timeline chips */}
        <View style={styles.detailsRow}>
          {payLabel && (
            <View style={styles.payBadge}>
              <Icon name="receipt" size={12} color={colors.neutral[0]} />
              <Text style={styles.payBadgeText}>{payLabel}</Text>
            </View>
          )}
          {scheduledAt && (
            <View style={styles.timelineChip}>
              <Icon name="clock" size={12} color={colors.forest[400]} />
              <Text style={styles.timelineText}>{scheduledAt}</Text>
            </View>
          )}
          {post.job_timeline && (
            <View style={styles.timelineChip}>
              <Icon name="clock" size={12} color={colors.forest[400]} />
              <Text style={styles.timelineText}>
                {TIMELINE_LABELS[post.job_timeline] ?? post.job_timeline}
              </Text>
            </View>
          )}
        </View>

        {post.origin_address && (
          <View style={styles.locationRow}>
            <Icon name="map-pin" size={13} color={colors.neutral[400]} />
            <Text style={styles.location} numberOfLines={1}>{post.origin_address}</Text>
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.authorRow}>
            <Avatar uri={post.author?.avatar_url} name={authorName} size="sm" />
            <Text style={styles.authorName}>{authorName}</Text>
          </View>
          {post.author && (
            <View style={styles.statChip}>
              <Icon name="star" size={12} color={colors.accent.green} />
              <Text style={styles.statText}>{(post.author.rating_avg ?? 0).toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 0,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryChip: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  categoryText: {
    ...typography.caption,
    color: colors.neutral[500],
    fontWeight: '600',
    fontSize: 11,
  },
  title: {
    ...typography.body1Bold,
    color: colors.forest[900],
    fontSize: 15,
  },
  description: {
    ...typography.body2,
    color: colors.forest[500],
    fontSize: 13,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  payBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.forest[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  payBadgeText: {
    ...typography.caption,
    color: colors.neutral[0],
    fontWeight: '700',
    fontSize: 12,
  },
  timelineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  timelineText: {
    ...typography.caption,
    color: colors.neutral[500],
    fontWeight: '600',
    fontSize: 11,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  location: {
    ...typography.body2,
    color: colors.neutral[500],
    flex: 1,
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginVertical: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  authorName: {
    ...typography.body2,
    color: colors.forest[900],
    fontWeight: '600',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.neutral[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  statText: {
    ...typography.caption,
    color: colors.forest[900],
    fontWeight: '600',
    fontSize: 11,
  },
});
