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
          <View style={styles.metaItem}>
            <Icon name="star" size={12} color={colors.accent.green} />
            <Text variant="bodySm" tone="muted">
              {post.author.rating_avg.toFixed(1)}
            </Text>
          </View>
        )}
        {post.type === 'package' && post.price_cents != null ? (
          <View style={[styles.priceBadge, { backgroundColor: accent }]}>
            <Text variant="caption" weight="semibold" tone="inverse">
              Delivery {formatBZD(post.price_cents)}
            </Text>
          </View>
        ) : post.errand_fee_cents != null ? (
          <View style={[styles.priceBadge, { backgroundColor: accent }]}>
            <Text variant="caption" weight="semibold" tone="inverse">
              Fee {formatBZD(post.errand_fee_cents)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.authorRow}>
          <Avatar uri={post.author?.avatar_url} name={authorName} size="sm" />
          <Text variant="bodySm" weight="bold" numberOfLines={1} style={styles.flex1}>
            {authorName}
          </Text>
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
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  priceBadge: {
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
  itemChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
});
