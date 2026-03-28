import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/theme';
import { Icon } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatBZD } from '@/lib/helpers';
import type { PostWithAuthor } from '@/store/api/postsApi';

interface ErrandCardProps {
  post: PostWithAuthor;
  onPress?: () => void;
}

export function ErrandCard({ post, onPress }: ErrandCardProps) {
  const authorName = post.author
    ? `${post.author.first_name ?? ''} ${(post.author.last_name ?? '')[0] ?? ''}.`.trim()
    : 'Unknown';

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.headerRow}>
        <PostTypeBadge type={post.type === 'package' ? 'package' : 'errand'} />
        {post.errand_category && (
          <Text style={styles.category}>
            {post.errand_category.charAt(0).toUpperCase() + post.errand_category.slice(1)}
          </Text>
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>{post.title}</Text>

      {(post.origin_address || post.dest_address) && (
        <View style={styles.locationRow}>
          <Icon name="map-pin" size={14} color={colors.neutral[400]} />
          <Text style={styles.location} numberOfLines={1}>
            {[post.origin_address, post.dest_address].filter(Boolean).join(' > ')}
          </Text>
        </View>
      )}

      {post.description && (
        <Text style={styles.description} numberOfLines={2}>{post.description}</Text>
      )}

      <View style={styles.priceRow}>
        {post.errand_fee_cents != null && (
          <Text style={styles.fee}>Errand fee: {formatBZD(post.errand_fee_cents)}</Text>
        )}
        {post.item_cost_cents != null && (
          <Text style={styles.itemCost}>Item cost: ~{formatBZD(post.item_cost_cents)}</Text>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.authorRow}>
          <Avatar uri={post.author?.avatar_url} name={authorName} size="sm" />
          <Text style={styles.authorName}>{authorName}</Text>
        </View>
        {post.author && (
          <View style={styles.stat}>
            <Icon name="star" size={14} color={colors.accent.green} />
            <Text style={styles.statText}>{post.author.rating_avg.toFixed(1)}</Text>
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
  description: {
    ...typography.body2,
    color: colors.forest[500],
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  fee: {
    ...typography.body2Bold,
    color: colors.forest[600],
  },
  itemCost: {
    ...typography.body2,
    color: colors.neutral[500],
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
