import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing, borderRadius, colors, useTheme } from '@/theme';
import { Icon } from '@/components/icons';
import { PostCardShell } from './PostCardShell';
import { HeroMap } from './HeroMap';
import { HeroGradient } from './HeroGradient';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { formatBZD, formatDeparture } from '@/lib/helpers';
import type { PostWithAuthor } from '@/store/api/postsApi';

interface RouteOfferCardProps {
  post: PostWithAuthor;
  onPress?: () => void;
}

export const RouteOfferCard = React.memo(function RouteOfferCard({ post, onPress }: RouteOfferCardProps) {
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
      fallbackType="route_offer"
    />
  ) : (
    <HeroGradient type="route_offer" />
  );

  return (
    <PostCardShell
      hero={hero}
      heroOverlayLeft={<PostTypeBadge type="route_offer" variant="overlay" />}
      onPress={onPress}
    >
      <Text variant="body" weight="bold" numberOfLines={1}>
        {post.origin_address ?? 'Origin'} → {post.dest_address ?? 'Destination'}
      </Text>

      <View style={styles.metaRow}>
        {departure && (
          <View style={styles.metaItem}>
            <Icon name="clock" size={12} color={c.textMuted} />
            <Text variant="bodySm" tone="muted">{departure}</Text>
          </View>
        )}
        {post.author?.rating_avg != null && (
          <View style={styles.metaItem}>
            <Icon name="star" size={12} color={colors.accent.green} />
            <Text variant="bodySm" tone="muted">
              {post.author.rating_avg.toFixed(1)}
            </Text>
          </View>
        )}
        {post.price_cents != null && (
          <View style={styles.priceBadge}>
            <Text variant="caption" weight="semibold" tone="inverse">
              {formatBZD(post.price_cents)}/seat
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.authorRow}>
          <Avatar uri={post.author?.avatar_url} name={authorName} size="sm" />
          <Text variant="bodySm" weight="bold" numberOfLines={1} style={styles.flex1}>
            {authorName}
          </Text>
        </View>
        {post.seats_total != null && (
          <View style={[styles.seatsChip, { backgroundColor: c.surfaceMuted }]}>
            <Text variant="caption" weight="semibold">
              {post.seats_filled}/{post.seats_total} seats
            </Text>
          </View>
        )}
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
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  priceBadge: {
    backgroundColor: colors.accent.green,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
    marginLeft: 'auto',
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
  seatsChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
});
