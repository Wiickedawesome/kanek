import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing, colors, useTheme } from '@/theme';
import { Icon } from '@/components/icons';
import { PostCardShell } from './PostCardShell';
import { HeroGradient } from './HeroGradient';
import { HeroMap } from './HeroMap';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { PriceBadge } from './PriceBadge';
import { MetaItem } from './MetaItem';
import type { PostWithAuthor } from '@/store/api/postsApi';

interface JobCardProps {
  post: PostWithAuthor;
  onPress?: () => void;
}

export const JobCard = React.memo(function JobCard({ post, onPress }: JobCardProps) {
  const { c } = useTheme();
  const authorName = post.author
    ? `${post.author.first_name ?? ''} ${(post.author.last_name ?? '')[0] ?? ''}.`.trim()
    : 'Unknown';

  const hero = post.origin_lat != null && post.origin_lng != null
    ? <HeroMap origin={{ lat: post.origin_lat, lng: post.origin_lng }} fallbackType="job" />
    : <HeroGradient type="job" />;

  return (
    <PostCardShell
      hero={hero}
      heroOverlayLeft={<PostTypeBadge type="job" variant="overlay" />}
      onPress={onPress}
    >
      <Text variant="body" weight="bold" numberOfLines={1}>{post.title}</Text>

      {post.origin_address && (
        <View style={styles.locationRow}>
          <Icon name="map-pin" size={12} color={c.textMuted} />
          <Text variant="bodySm" tone="muted" numberOfLines={1} style={styles.locationText}>
            {post.origin_address}
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
        {post.pay_rate_cents != null && (
          <PriceBadge
            cents={post.pay_rate_cents}
            color={colors.accent.yellow}
            textColor={'#3a2f00'}
            suffix={post.pay_type === 'hourly' ? '/hr' : ''}
          />
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.authorRow}>
          <Avatar uri={post.author?.avatar_url} name={authorName} size="sm" />
          <Text variant="bodySm" weight="bold" numberOfLines={1} style={styles.authorName}>
            {authorName}
          </Text>
        </View>
      </View>
    </PostCardShell>
  );
});

const styles = StyleSheet.create({
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  locationText: {
    flex: 1,
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
  authorName: {
    flex: 1,
  },
});
