import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui';
import { RouteInfoCard } from '@/components/cards/RouteInfoCard';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useGetPostByIdQuery, useDeletePostMutation } from '@/store/api/postsApi';
import { buildRouteMapUrl } from '@/lib/mapbox';
import { formatBZD, formatDeparture, getTimeAgo } from '@/lib/helpers';
import type { RootState } from '@/store';

const MAP_HEIGHT = 200;
const MAP_PIXEL_WIDTH = 800; // retina
const MAP_PIXEL_HEIGHT = MAP_HEIGHT * 2;

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: post, isLoading, error } = useGetPostByIdQuery(postId ?? '', {
    skip: !postId,
  });
  const [deletePost] = useDeletePostMutation();

  const hasCoords =
    post != null &&
    post.origin_lat != null &&
    post.origin_lng != null &&
    post.dest_lat != null &&
    post.dest_lng != null;

  const mapUri = useMemo(() => {
    if (!hasCoords || !post) return null;
    const geo = post.route_geometry as { type: string; coordinates: [number, number][] } | null;
    return buildRouteMapUrl(
      post.origin_lat!,
      post.origin_lng!,
      post.dest_lat!,
      post.dest_lng!,
      { width: MAP_PIXEL_WIDTH, height: MAP_PIXEL_HEIGHT, routeGeometry: geo, padding: 60 },
    );
  }, [hasCoords, post]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.centered}>
        <Icon name="alert-triangle" size={48} color={colors.neutral[400]} />
        <Text style={styles.errorText}>Post not found</Text>
        <Button title="Go Back" variant="outline" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const authorName = post.author
    ? `${post.author.first_name ?? ''} ${post.author.last_name ?? ''}`.trim()
    : 'Unknown';
  const isOwner = userId === post.author_id;
  const isRoute = post.type === 'route_offer' || post.type === 'route_request';
  const isErrand = post.type === 'errand' || post.type === 'package';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Post Details
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Type badge + status */}
        <View style={styles.badgeRow}>
          <PostTypeBadge type={post.type} />
          <View style={[styles.statusBadge, post.status === 'open' && styles.statusOpen]}>
            <Text style={[styles.statusText, post.status === 'open' && styles.statusTextOpen]}>
              {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{post.title}</Text>

        {/* Route map */}
        {mapUri && (
          <View style={styles.mapContainer}>
            <Image source={{ uri: mapUri }} style={styles.mapImage} resizeMode="cover" />
          </View>
        )}

        {/* Route info */}
        {(post.origin_address || post.dest_address) && (
          <View style={styles.section}>
            <View style={styles.routeRow}>
              <View style={styles.routeDot}>
                <View style={styles.dotGreen} />
                <View style={styles.routeLine} />
                <View style={styles.dotRed} />
              </View>
              <View style={styles.routeAddresses}>
                <Text style={styles.address}>{post.origin_address ?? 'Not specified'}</Text>
                <Text style={styles.address}>{post.dest_address ?? 'Not specified'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Route calculation summary */}
        {post.route_distance_km != null && post.route_duration_min != null && post.route_fuel_cost_cents != null && (
          <RouteInfoCard
            distanceKm={post.route_distance_km}
            durationMinutes={post.route_duration_min}
            fuelCostCents={post.route_fuel_cost_cents}
          />
        )}

        {/* Departure */}
        {post.departure_at && (
          <View style={styles.infoRow}>
            <Icon name="clock" size={18} color={colors.forest[400]} />
            <Text style={styles.infoText}>{formatDeparture(post.departure_at)}</Text>
          </View>
        )}

        {/* Price */}
        {isRoute && post.price_cents != null && (
          <View style={styles.infoRow}>
            <Icon name="receipt" size={18} color={colors.forest[400]} />
            <Text style={styles.infoText}>
              {formatBZD(post.price_cents)}{post.type === 'route_offer' ? '/seat' : ' offered'}
            </Text>
          </View>
        )}

        {/* Seats (route_offer) */}
        {post.type === 'route_offer' && post.seats_total != null && (
          <View style={styles.infoRow}>
            <Icon name="user" size={18} color={colors.forest[400]} />
            <Text style={styles.infoText}>
              {post.seats_filled}/{post.seats_total} seats filled
              {post.min_riders != null ? ` · Min ${post.min_riders} to go` : ''}
            </Text>
          </View>
        )}

        {/* Pickup style */}
        {post.pickup_style && (
          <View style={styles.infoRow}>
            <Icon name="map-pin" size={18} color={colors.forest[400]} />
            <Text style={styles.infoText}>
              {post.pickup_style === 'single' ? 'Single pickup point' : 'Multi-stop pickups'}
            </Text>
          </View>
        )}

        {/* Errand-specific */}
        {isErrand && (
          <>
            {post.errand_category && (
              <View style={styles.infoRow}>
                <Icon name="package" size={18} color={colors.forest[400]} />
                <Text style={styles.infoText}>
                  {post.errand_category.charAt(0).toUpperCase() + post.errand_category.slice(1)}
                </Text>
              </View>
            )}
            {post.errand_fee_cents != null && (
              <View style={styles.infoRow}>
                <Icon name="receipt" size={18} color={colors.forest[400]} />
                <Text style={styles.infoText}>
                  Errand fee: {formatBZD(post.errand_fee_cents)}
                </Text>
              </View>
            )}
            {post.item_cost_cents != null && (
              <View style={styles.infoRow}>
                <Icon name="receipt" size={18} color={colors.neutral[400]} />
                <Text style={styles.infoMuted}>
                  Est. item cost: ~{formatBZD(post.item_cost_cents)} (separate)
                </Text>
              </View>
            )}
          </>
        )}

        {/* Job price */}
        {post.type === 'job' && post.price_cents != null && (
          <View style={styles.infoRow}>
            <Icon name="receipt" size={18} color={colors.forest[400]} />
            <Text style={styles.infoText}>Pay: {formatBZD(post.price_cents)}</Text>
          </View>
        )}

        {/* Description */}
        {post.description && (
          <View style={styles.descSection}>
            <Text style={styles.sectionLabel}>Description</Text>
            <Text style={styles.description}>{post.description}</Text>
          </View>
        )}

        {/* Author card */}
        <View style={styles.authorCard}>
          <Text style={styles.sectionLabel}>Posted by</Text>
          <View style={styles.authorRow}>
            <Avatar
              uri={post.author?.avatar_url}
              name={authorName}
              size="md"
            />
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{authorName}</Text>
              {post.author && (
                <View style={styles.authorStats}>
                  <View style={styles.stat}>
                    <Icon name="star" size={14} color={colors.accent.green} />
                    <Text style={styles.statText}>
                      {post.author.rating_avg.toFixed(1)}
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Icon name="clock" size={14} color={colors.forest[400]} />
                    <Text style={styles.statText}>
                      {post.author.punctuality_pct}% on time
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Posted time */}
        <Text style={styles.postedAt}>
          Posted {getTimeAgo(post.created_at)}
        </Text>
      </ScrollView>

      {/* Bottom action */}
      {isOwner ? (
        <View style={styles.bottomBar}>
          <Button
            title="Delete Post"
            variant="outline"
            onPress={async () => {
              const confirmed = Platform.OS === 'web'
                ? window.confirm(`Are you sure you want to delete "${post.title}"?`)
                : await new Promise<boolean>((resolve) =>
                    Alert.alert(
                      'Delete Post',
                      `Are you sure you want to delete "${post.title}"?`,
                      [
                        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
                      ],
                    ),
                  );

              if (!confirmed) return;

              try {
                await deletePost(post.id).unwrap();
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/activity');
                }
              } catch (e: any) {
                const msg = e?.data?.error ?? e?.error ?? e?.message ?? 'Failed to delete post.';
                if (Platform.OS === 'web') {
                  window.alert(msg);
                } else {
                  Alert.alert('Error', msg);
                }
              }
            }}
            size="lg"
            style={styles.actionButton}
          />
        </View>
      ) : post.status === 'open' ? (
        <View style={styles.bottomBar}>
          <Button
            title={getActionLabel(post.type)}
            onPress={() =>
              Alert.alert(
                'Coming Soon',
                'Booking and messaging will be available in the next update.',
              )
            }
            size="lg"
            style={styles.actionButton}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function getActionLabel(type: string): string {
  switch (type) {
    case 'route_offer': return 'Book Seat';
    case 'route_request': return 'Offer to Drive';
    case 'errand': return 'Accept Errand';
    case 'package': return 'Deliver Package';
    case 'job': return 'Apply for Job';
    default: return 'Respond';
  }
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    gap: spacing.lg,
  },
  errorText: {
    ...typography.body1,
    color: colors.neutral[400],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.forest[900],
  },
  headerTitle: {
    ...typography.h3,
    color: colors.neutral[0],
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.neutral[200],
  },
  statusOpen: {
    backgroundColor: '#e8f5e9',
  },
  statusText: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  statusTextOpen: {
    color: colors.forest[600],
  },
  title: {
    ...typography.h2,
    color: colors.forest[900],
  },
  mapContainer: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  mapImage: {
    width: '100%',
    height: MAP_HEIGHT,
  },
  section: {
    gap: spacing.sm,
  },
  routeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  routeDot: {
    alignItems: 'center',
    paddingTop: 4,
    width: 16,
  },
  dotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent.green,
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.neutral[300],
    marginVertical: 4,
  },
  dotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
  },
  routeAddresses: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
    gap: spacing.lg,
  },
  address: {
    ...typography.body1,
    color: colors.forest[900],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoText: {
    ...typography.body1,
    color: colors.forest[900],
  },
  infoMuted: {
    ...typography.body2,
    color: colors.neutral[500],
  },
  descSection: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  sectionLabel: {
    ...typography.body2Bold,
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    ...typography.body1,
    color: colors.forest[800],
    lineHeight: 24,
  },
  authorCard: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  authorInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  authorName: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  authorStats: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statText: {
    ...typography.body2,
    color: colors.forest[500],
  },
  postedAt: {
    ...typography.caption,
    color: colors.neutral[400],
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  actionButton: {
    width: '100%',
  },
});
