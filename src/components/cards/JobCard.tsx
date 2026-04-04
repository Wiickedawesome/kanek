import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/theme';
import { Icon } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatBZD } from '@/lib/helpers';
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

export function JobCard({ post, onPress }: JobCardProps) {
  const authorName = post.author
    ? `${post.author.first_name ?? ''} ${(post.author.last_name ?? '')[0] ?? ''}.`.trim()
    : 'Unknown';

  const payLabel = post.pay_rate_cents
    ? `${formatBZD(post.pay_rate_cents)}${post.pay_type === 'hourly' ? '/hr' : ' fixed'}`
    : null;

  return (
    <Card onPress={onPress} style={styles.card} variant="glass">
      <View style={styles.headerRow}>
        <PostTypeBadge type="job" />
        {post.job_category && (
          <Text style={styles.category}>
            {CATEGORY_LABELS[post.job_category] ?? post.job_category}
          </Text>
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>{post.title}</Text>

      {post.description && (
        <Text style={styles.description} numberOfLines={2}>{post.description}</Text>
      )}

      <View style={styles.detailsRow}>
        {payLabel && (
          <View style={styles.detail}>
            <Icon name="receipt" size={14} color={colors.forest[600]} />
            <Text style={styles.payText}>{payLabel}</Text>
          </View>
        )}
        {post.job_timeline && (
          <View style={styles.detail}>
            <Icon name="clock" size={14} color={colors.neutral[400]} />
            <Text style={styles.detailText}>
              {TIMELINE_LABELS[post.job_timeline] ?? post.job_timeline}
            </Text>
          </View>
        )}
      </View>

      {post.origin_address && (
        <View style={styles.locationRow}>
          <Icon name="map-pin" size={14} color={colors.neutral[400]} />
          <Text style={styles.location} numberOfLines={1}>{post.origin_address}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.authorRow}>
          <Avatar uri={post.author?.avatar_url} name={authorName} size="sm" />
          <Text style={styles.authorName}>{authorName}</Text>
        </View>
        {post.author && (
          <View style={styles.stat}>
            <Icon name="star" size={14} color={colors.accent.green} />
            <Text style={styles.statText}>{(post.author.rating_avg ?? 0).toFixed(1)}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  category: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  title: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  description: {
    ...typography.body2,
    color: colors.forest[500],
  },
  detailsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  payText: {
    ...typography.body2Bold,
    color: colors.forest[600],
  },
  detailText: {
    ...typography.body2,
    color: colors.neutral[500],
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
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  authorName: {
    ...typography.body2,
    color: colors.forest[900],
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    ...typography.caption,
    color: colors.forest[900],
  },
});
