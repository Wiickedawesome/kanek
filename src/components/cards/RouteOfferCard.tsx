import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/theme';
import { Icon } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatBZD, formatDeparture } from '@/lib/helpers';
import type { PostWithAuthor } from '@/store/api/postsApi';

interface RouteOfferCardProps {
  post: PostWithAuthor;
  onPress?: () => void;
}

export function RouteOfferCard({ post, onPress }: RouteOfferCardProps) {
  const authorName = post.author
    ? `${post.author.first_name ?? ''} ${(post.author.last_name ?? '')[0] ?? ''}.`.trim()
    : 'Unknown';

  const departure = post.departure_at
    ? formatDeparture(post.departure_at)
    : null;

  return (
    <Card onPress={onPress} style={styles.card}>
      <PostTypeBadge type="route_offer" />

      <View style={styles.routeRow}>
        <View style={styles.routeInfo}>
          <Text style={styles.route} numberOfLines={1}>
            {post.origin_address ?? 'Origin'} {'>'} {post.dest_address ?? 'Destination'}
          </Text>
          {departure && (
            <Text style={styles.meta}>{departure}</Text>
          )}
          {post.price_cents != null && (
            <Text style={styles.price}>
              {formatBZD(post.price_cents)}/seat
            </Text>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.authorRow}>
          <Avatar uri={post.author?.avatar_url} name={authorName} size="sm" />
          <Text style={styles.authorName}>{authorName}</Text>
        </View>
        <View style={styles.stats}>
          {post.author && (
            <>
              <View style={styles.stat}>
                <Icon name="star" size={14} color={colors.accent.green} />
                <Text style={styles.statText}>
                  {post.author.rating_avg.toFixed(1)}
                </Text>
              </View>
              <View style={styles.stat}>
                <Icon name="clock" size={14} color={colors.forest[400]} />
                <Text style={styles.statText}>
                  {post.author.punctuality_pct}%
                </Text>
              </View>
            </>
          )}
          {post.seats_total != null && (
            <Text style={styles.seats}>
              {post.seats_filled}/{post.seats_total}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}


const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  routeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  routeInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  route: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  meta: {
    ...typography.body2,
    color: colors.neutral[500],
  },
  price: {
    ...typography.body1Bold,
    color: colors.forest[600],
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
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  seats: {
    ...typography.body2Bold,
    color: colors.forest[600],
  },
});
