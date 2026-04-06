import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { Icon } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatBZD, formatDeparture } from '@/lib/helpers';
import type { PostWithAuthor } from '@/store/api/postsApi';

interface RouteRequestCardProps {
  post: PostWithAuthor;
  onPress?: () => void;
}

export function RouteRequestCard({ post, onPress }: RouteRequestCardProps) {
  const authorName = post.author
    ? `${post.author.first_name ?? ''} ${(post.author.last_name ?? '')[0] ?? ''}.`.trim()
    : 'Unknown';

  const departure = post.departure_at
    ? formatDeparture(post.departure_at)
    : null;

  return (
    <Card onPress={onPress} style={styles.card}>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <PostTypeBadge type="route_request" />
          <View style={styles.needDriverChip}>
            <Text style={styles.needDriverText}>Need a driver</Text>
          </View>
        </View>

        {/* Route path */}
        <View style={styles.routePath}>
          <View style={styles.pathDot}>
            <View style={[styles.dot, { backgroundColor: colors.accent.blue }]} />
          </View>
          <View style={styles.pathInfo}>
            <Text style={styles.placeName} numberOfLines={1}>
              {post.origin_address ?? 'Origin'}
            </Text>
          </View>
        </View>
        <View style={styles.pathConnector}>
          <View style={styles.pathLine} />
        </View>
        <View style={styles.routePath}>
          <View style={styles.pathDot}>
            <View style={[styles.dot, { backgroundColor: colors.error }]} />
          </View>
          <View style={styles.pathInfo}>
            <Text style={styles.placeName} numberOfLines={1}>
              {post.dest_address ?? 'Destination'}
            </Text>
          </View>
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          {departure && (
            <View style={styles.metaItem}>
              <Icon name="clock" size={13} color={colors.forest[400]} />
              <Text style={styles.metaText}>{departure}</Text>
            </View>
          )}
          {post.price_cents != null && (
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>
                Offering {formatBZD(post.price_cents)}/seat
              </Text>
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
          <View style={styles.stats}>
            {post.author && (
              <>
                <View style={styles.statChip}>
                  <Icon name="star" size={12} color={colors.accent.green} />
                  <Text style={styles.statText}>{(post.author.rating_avg ?? 0).toFixed(1)}</Text>
                </View>
                <View style={styles.statChip}>
                  <Icon name="clock" size={12} color={colors.forest[400]} />
                  <Text style={styles.statText}>{post.author.punctuality_pct}%</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  needDriverChip: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  needDriverText: {
    ...typography.caption,
    color: colors.accent.blue,
    fontWeight: '700',
    fontSize: 11,
  },
  routePath: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pathDot: {
    width: 18,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pathLine: {
    width: 1.5,
    height: 12,
    backgroundColor: colors.neutral[300],
  },
  pathConnector: {
    paddingLeft: 8,
    alignItems: 'flex-start',
  },
  pathInfo: {
    flex: 1,
  },
  placeName: {
    ...typography.body1Bold,
    color: colors.forest[900],
    fontSize: 15,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.body2,
    color: colors.neutral[500],
    fontSize: 13,
  },
  priceBadge: {
    backgroundColor: colors.accent.blue,
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
  divider: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginVertical: spacing.xs,
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
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
