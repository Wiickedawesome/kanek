import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing, borderRadius, colors, useTheme } from '@/theme';
import { Icon } from '@/components/icons';
import { PostCardShell } from './PostCardShell';
import { HeroGradient } from './HeroGradient';
import { HeroMap } from './HeroMap';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { formatBZD } from '@/lib/helpers';
import { PriceBadge } from './PriceBadge';
import { MetaItem } from './MetaItem';
import { TaxiVerifiedBadge } from '@/components/profile';
import type { PostWithAuthor } from '@/store/api/postsApi';

const ACCENT_BG: Record<string, string> = {
  errand: colors.warning,
  package: '#9c27b0',
};

interface ErrandCardProps {
  post: PostWithAuthor;
  onPress?: () => void;
}

export const ErrandCard = React.memo(function ErrandCard({ post, onPress }: ErrandCardProps) {
  const { c } = useTheme();
  const authorName = post.author
    ? `${post.author.first_name ?? ''} ${(post.author.last_name ?? '')[0] ?? ''}.`.trim()
    : 'Unknown';

  const accent = ACCENT_BG[post.type] ?? colors.warning;
  const badgeType = post.type === 'package' ? 'package' : 'errand';

  const hero = post.origin_lat != null && post.origin_lng != null
    ? (
      <HeroMap
        origin={{ lat: post.origin_lat, lng: post.origin_lng }}
        destination={post.dest_lat != null && post.dest_lng != null ? { lat: post.dest_lat, lng: post.dest_lng } : null}
        routeGeometry={post.route_geometry as { type: string; coordinates: [number, number][] } | null}
        fallbackType={badgeType}
      />
    )
    : <HeroGradient type={badgeType} />;

  return (
    <PostCardShell
      hero={hero}
      heroOverlayLeft={<PostTypeBadge type={badgeType} variant="overlay" />}
      onPress={onPress}
    >
      <Text variant="body" weight="bold" numberOfLines={1}>{post.title}</Text>

      {(post.origin_address || post.dest_address) && (
        <View style={styles.locationRow}>
          <Icon name="map-pin" size={12} color={c.textMuted} />
          <Text variant="bodySm" tone="muted" numberOfLines={1} style={styles.flex1}>
            {[post.origin_address, post.dest_address].filter(Boolean).join(' → ')}
          </Text>
        </View>
      )}

      {post.description && (
        <Text variant="bodySm" tone="muted" numberOfLines={2}>
          {post.description}
        </Text>
      )}

      <View style={styles.metaRow}>
        {post.author?.rating_avg != null && (
          <MetaItem iconName="star" iconColor={colors.accent.green}>
            {post.author.rating_avg.toFixed(1)}
          </MetaItem>
        )}
        {post.type === 'package' && post.price_cents != null ? (
          <PriceBadge cents={post.price_cents} color={accent} prefix="Delivery" />
        ) : post.errand_fee_cents != null ? (
          <PriceBadge cents={post.errand_fee_cents} color={accent} prefix="Fee" />
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.authorRow}>
          <Avatar uri={post.author?.avatar_url} name={authorName} size="sm" />
          <Text variant="bodySm" weight="bold" numberOfLines={1}>
            {authorName}
          </Text>
          {post.author?.taxi_association_verified && (
            <TaxiVerifiedBadge
              variant="compact"
              associationName={post.author.taxi_association_name}
            />
          )}
        </View>
        {post.item_cost_cents != null && (
          <View style={[styles.itemChip, { backgroundColor: c.surfaceMuted }]}>
            <Text variant="caption" weight="semibold">
              Items ~{formatBZD(post.item_cost_cents)}
            </Text>
          </View>
        )}
      </View>
    </PostCardShell>
  );
});

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
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
  itemChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
});
