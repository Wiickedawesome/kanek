import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { Icon } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatBZD } from '@/lib/helpers';
import type { PostWithAuthor } from '@/store/api/postsApi';

const ACCENT_COLORS: Record<string, string> = {
  errand: colors.warning,
  package: '#9c27b0',
};

interface ErrandCardProps {
  post: PostWithAuthor;
  onPress?: () => void;
}

export const ErrandCard = React.memo(function ErrandCard({ post, onPress }: ErrandCardProps) {
  const authorName = post.author
    ? `${post.author.first_name ?? ''} ${(post.author.last_name ?? '')[0] ?? ''}.`.trim()
    : 'Unknown';

  const accent = ACCENT_COLORS[post.type] ?? colors.warning;

  return (
    <Card onPress={onPress} style={styles.card}>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <PostTypeBadge type={post.type === 'package' ? 'package' : 'errand'} />
          {post.errand_category && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText}>
                {post.errand_category.charAt(0).toUpperCase() + post.errand_category.slice(1)}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={1}>{post.title}</Text>

        {(post.origin_address || post.dest_address) && (
          <View style={styles.locationRow}>
            <Icon name="map-pin" size={13} color={colors.neutral[400]} />
            <Text style={styles.location} numberOfLines={1}>
              {[post.origin_address, post.dest_address].filter(Boolean).join(' → ')}
            </Text>
          </View>
        )}

        {post.description && (
          <Text style={styles.description} numberOfLines={2}>{post.description}</Text>
        )}

        {/* Price chips row */}
        <View style={styles.priceRow}>
          {post.type === 'package' && post.price_cents != null ? (
            <View style={[styles.priceBadge, { backgroundColor: accent }]}>
              <Text style={styles.priceBadgeText}>Delivery: {formatBZD(post.price_cents)}</Text>
            </View>
          ) : post.errand_fee_cents != null ? (
            <View style={[styles.priceBadge, { backgroundColor: accent }]}>
              <Text style={styles.priceBadgeText}>Fee: {formatBZD(post.errand_fee_cents)}</Text>
            </View>
          ) : null}
          {post.item_cost_cents != null && (
            <View style={styles.itemCostChip}>
              <Text style={styles.itemCostText}>Items ~{formatBZD(post.item_cost_cents)}</Text>
            </View>
          )}
        </View>

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
    color: colors.forest[500],
    fontWeight: '600',
    fontSize: 11,
  },
  title: {
    ...typography.body1Bold,
    color: colors.forest[900],
    fontSize: 15,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  location: {
    ...typography.body2,
    color: colors.forest[500],
    flex: 1,
    fontSize: 13,
  },
  description: {
    ...typography.body2,
    color: colors.forest[500],
    fontSize: 13,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  priceBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  priceBadgeText: {
    ...typography.caption,
    color: colors.neutral[0],
    fontWeight: '700',
    fontSize: 12,
  },
  itemCostChip: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  itemCostText: {
    ...typography.caption,
    color: colors.forest[500],
    fontSize: 11,
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
    backgroundColor: colors.neutral[100],
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
