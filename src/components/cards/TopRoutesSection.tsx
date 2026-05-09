import React from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, shadows, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { Icon } from '@/components/icons';
import { Text } from '@/components/ui/Text';
import { PostTypeBadge } from '@/components/ui/Badge';
import { HeroMap } from './HeroMap';
import { HeroGradient } from './HeroGradient';
import { PriceBadge } from './PriceBadge';
import { formatDeparture } from '@/lib/helpers';
import type { PostWithAuthor } from '@/store/api/postsApi';

const CARD_WIDTH = 280;
const IMAGE_HEIGHT = 150;

interface TopRoutesSectionProps {
  routes: PostWithAuthor[];
  onPressRoute: (id: string) => void;
}

export function TopRoutesSection({ routes, onPressRoute }: TopRoutesSectionProps) {
  const { c } = useTheme();
  const styles = createStyles(c);
  if (routes.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="h3" style={styles.heading}>Top routes nearby</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {routes.map((route) => (
          <RouteCardCompact
            key={route.id}
            route={route}
            onPress={() => onPressRoute(route.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/** Short city/town name from a full address like "San Ignacio, Cayo, Belize" */
function shortPlace(address: string | null): string {
  if (!address) return 'Unknown';
  return address.split(',')[0].trim();
}

function RouteCardCompact({
  route,
  onPress,
}: {
  route: PostWithAuthor;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const styles = createStyles(c);
  const origin = shortPlace(route.origin_address);
  const dest = shortPlace(route.dest_address);
  const fullOrigin = route.origin_address ?? 'Origin';
  const departure = route.departure_at ? formatDeparture(route.departure_at) : null;
  const rating = route.author?.rating_avg ?? 0;
  const isOffer = route.type === 'route_offer';

  const hasCoords =
    route.origin_lat != null &&
    route.origin_lng != null &&
    route.dest_lat != null &&
    route.dest_lng != null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Map hero — uses the shared HeroMap so the in-card route preview
       *  matches the main feed card visuals (real driving geometry when
       *  available, straight-line fallback, gradient placeholder). */}
      <View style={styles.mapWrap}>
        {hasCoords ? (
          <HeroMap
            origin={{ lat: route.origin_lat as number, lng: route.origin_lng as number }}
            destination={{ lat: route.dest_lat as number, lng: route.dest_lng as number }}
            routeGeometry={route.route_geometry as { type: string; coordinates: [number, number][] } | null}
            fallbackType={isOffer ? 'route_offer' : 'route_request'}
            height={IMAGE_HEIGHT}
            width={CARD_WIDTH}
          />
        ) : (
          <HeroGradient type={isOffer ? 'route_offer' : 'route_request'} height={IMAGE_HEIGHT} />
        )}
      </View>

      {/* Type badge overlaid on map — shared component for consistency */}
      <View style={styles.typeBadgeWrap}>
        <PostTypeBadge type={isOffer ? 'route_offer' : 'route_request'} variant="overlay" />
      </View>

      {/* Info area below — white, like AllTrails */}
      <View style={styles.infoArea}>
        <Text variant="body" weight="bold" numberOfLines={1} style={styles.title}>
          {origin} to {dest}
        </Text>
        <Text variant="bodySm" tone="muted" numberOfLines={1} style={styles.subtitle}>
          {fullOrigin}
        </Text>

        <View style={styles.statsRow}>
          {route.price_cents != null && (
            <PriceBadge cents={route.price_cents} style={styles.priceBadgeReset} />
          )}

          {rating > 0 && (
            <View style={styles.ratingRow}>
              <Icon name="star" size={13} color={colors.accent.green} />
              <Text variant="bodySm" weight="bold">{rating.toFixed(1)}</Text>
            </View>
          )}

          {departure && (
            <Text variant="bodySm" tone="muted" numberOfLines={1} style={styles.flexShrink}>
              {departure}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
    section: {
      marginBottom: spacing.md,
    },
    heading: {
      marginBottom: spacing.sm,
    },
    scroll: {
      gap: spacing.md,
    },
    card: {
      width: CARD_WIDTH,
      borderRadius: 8,
      backgroundColor: c.surface,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.border,
      ...shadows.sm,
    },
    cardPressed: {
      opacity: 0.92,
    },
    mapWrap: {
      width: CARD_WIDTH,
      height: IMAGE_HEIGHT,
    },
    typeBadgeWrap: {
      position: 'absolute',
      top: spacing.sm,
      left: spacing.sm,
    },
    infoArea: {
      padding: spacing.md,
    },
    title: {
      marginBottom: 2,
    },
    subtitle: {
      marginBottom: spacing.sm,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    priceBadgeReset: {
      marginLeft: 0,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    flexShrink: {
      flexShrink: 1,
    },
  });
