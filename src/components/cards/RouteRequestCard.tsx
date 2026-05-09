import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing, borderRadius, colors, useTheme } from '@/theme';
import { PostCardShell } from './PostCardShell';
import { HeroMap } from './HeroMap';
import { HeroGradient } from './HeroGradient';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { formatDeparture } from '@/lib/helpers';
import { PriceBadge } from './PriceBadge';
import { MetaItem } from './MetaItem';
import type { PostWithAuthor } from '@/store/api/postsApi';

interface RouteRequestCardProps {
  post: PostWithAuthor;
  onPress?: () => void;
}

export const RouteRequestCard = React.memo(function RouteRequestCard({ post, onPress }: RouteRequestCardProps) {
  const { c } = useTheme();
  const authorName = post.author
    ? `${post.author.first_name ?? ''} ${(post.author.last_name ?? '')[0] ?? ''}.`.trim()
    : 'Unknown';

  const departure = post.departure_at ? formatDeparture(post.departure_at) : null;

  const hasOrigin = post.origin_lat != null && post.origin_lng != null;
  const hasDest = post.dest_lat != null && post.dest_lng != null;

  const hero = hasOrigin ? (
    <HeroMap
      origin={{ lat: post.origin_lat as number, lng: post.origin_lng as number }}
      destination={hasDest ? { lat: post.dest_lat as number, lng: post.dest_lng as number } : null}
      routeGeometry={post.route_geometry as { type: string; coordinates: [number, number][] } | null}
      fallbackType="route_request"
    />
  ) : (
    <HeroGradient type="route_request" />
  );

  return (
    <PostCardShell
      hero={hero}
      heroOverlayLeft={<PostTypeBadge type="route_request" variant="overlay" />}
      onPress={onPress}
    >
      <Text variant="body" weight="bold" numberOfLines={1}>
        {post.origin_address ?? 'Origin'} → {post.dest_address ?? 'Destination'}
      </Text>

      <View style={styles.metaRow}>
        {departure && <MetaItem iconName="clock">{departure}</MetaItem>}
        {post.author?.rating_avg != null && (
          <MetaItem iconName="star" iconColor={colors.accent.green}>
            {post.author.rating_avg.toFixed(1)}
          </MetaItem>
        )}
        {post.price_cents != null && (
          <PriceBadge cents={post.price_cents} color={colors.accent.blue} prefix="Offering" />
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.authorRow}>
          <Avatar uri={post.author?.avatar_url} name={authorName} size="sm" />
          <Text variant="bodySm" weight="bold" numberOfLines={1} style={styles.flex1}>
            {authorName}
          </Text>
        </View>
        <View style={[styles.needChip, { backgroundColor: c.surfaceMuted }]}>
          <Text variant="caption" weight="semibold">Need a driver</Text>
        </View>
      </View>
    </PostCardShell>
  );
});

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  needChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
});
