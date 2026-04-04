import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image } from 'react-native';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { Icon } from '@/components/icons';
import { GlassView } from '@/components/ui/GlassView';
import { buildRouteMapUrl } from '@/lib/mapbox';
import { formatBZD, formatDeparture } from '@/lib/helpers';
import type { PostWithAuthor } from '@/store/api/postsApi';

const CARD_WIDTH = 280;
const IMAGE_HEIGHT = 150;
const IMAGE_PIXEL_WIDTH = CARD_WIDTH * 2; // retina
const IMAGE_PIXEL_HEIGHT = IMAGE_HEIGHT * 2;

interface TopRoutesSectionProps {
  routes: PostWithAuthor[];
  onPressRoute: (id: string) => void;
}

export function TopRoutesSection({ routes, onPressRoute }: TopRoutesSectionProps) {
  if (routes.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Top routes nearby</Text>
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

  const mapUri = useMemo(() => {
    if (!hasCoords) return null;
    const geo = route.route_geometry as { type: string; coordinates: [number, number][] } | null;
    return buildRouteMapUrl(
      route.origin_lat!,
      route.origin_lng!,
      route.dest_lat!,
      route.dest_lng!,
      { width: IMAGE_PIXEL_WIDTH, height: IMAGE_PIXEL_HEIGHT, routeGeometry: geo, padding: 40 },
    );
  }, [hasCoords, route.origin_lat, route.origin_lng, route.dest_lat, route.dest_lng, route.route_geometry]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Map image showing the route */}
      {mapUri ? (
        <Image
          source={{ uri: mapUri }}
          style={styles.mapImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.mapImage, styles.mapFallback]}>
          <Icon name="navigation" size={40} color="rgba(255,255,255,0.15)" />
        </View>
      )}

      {/* Type badge overlaid on map */}
      <GlassView tint="dark" intensity={50} style={styles.typeBadge}>
        <Text style={styles.typeBadgeText}>
          {isOffer ? 'Ride offered' : 'Ride wanted'}
        </Text>
      </GlassView>

      {/* Info area below — glass overlay */}
      <GlassView intensity={70} style={styles.infoArea}>
        <Text style={styles.title} numberOfLines={1}>
          {origin} to {dest}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {fullOrigin}
        </Text>

        <View style={styles.statsRow}>
          {route.price_cents != null && (
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>{formatBZD(route.price_cents)}</Text>
            </View>
          )}

          {rating > 0 && (
            <View style={styles.ratingRow}>
              <Icon name="star" size={13} color={colors.accent.green} />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
            </View>
          )}

          {departure && (
            <Text style={styles.departureText} numberOfLines={1}>
              {departure}
            </Text>
          )}
        </View>
      </GlassView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.md,
  },
  heading: {
    ...typography.h3,
    color: colors.forest[900],
    marginBottom: spacing.sm,
  },
  scroll: {
    gap: spacing.md,
  },

  // Card container — white card like AllTrails
  card: {
    width: CARD_WIDTH,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[0],
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.92,
  },

  // Map image area
  mapImage: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
  },
  mapFallback: {
    backgroundColor: colors.forest[700],
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Type badge overlaid on map top-left
  typeBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    ...typography.caption,
    color: colors.neutral[0],
    fontSize: 11,
    fontWeight: '600',
  },

  // Bottom info area — white
  infoArea: {
    padding: spacing.md,
  },
  title: {
    ...typography.body1Bold,
    color: colors.forest[900],
    fontSize: 15,
    marginBottom: 2,
  },
  subtitle: {
    ...typography.body2,
    color: colors.neutral[500],
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  priceBadge: {
    backgroundColor: colors.accent.green,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  priceBadgeText: {
    ...typography.caption,
    color: colors.neutral[0],
    fontSize: 12,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    ...typography.body2Bold,
    color: colors.forest[900],
    fontSize: 13,
  },
  departureText: {
    ...typography.body2,
    color: colors.neutral[400],
    fontSize: 12,
    flexShrink: 1,
  },
});
