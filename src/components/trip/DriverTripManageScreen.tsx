/**
 * Driver-side "Manage Trip" screen.
 *
 * Shown for a `route_offer` post that has at least one active contract. The
 * driver advances the trip through its stages once and the event is recorded
 * against every confirmed rider's contract simultaneously. Each rider still
 * sees their own per-contract timeline update on their side.
 *
 * Not for riders — riders continue to use `/(tabs)/activity/[contractId]`.
 */
import React, { useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/icons';
import { Button, ScreenHeader, useFloatingTabBarPad } from '@/components/ui';
import { TripProgressTimeline } from '@/components/trip/TripProgressTimeline';
import { LiveTrackingMap } from '@/components/map';
import { RouteInfoCard } from '@/components/cards/RouteInfoCard';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { useGetPostByIdQuery } from '@/store/api/postsApi';
import {
  useGetPostTripContractsQuery,
  useBulkCreateContractEventForPostMutation,
} from '@/store/api/contractEventsApi';
import { useCompleteBookingMutation } from '@/store/api/bookingsApi';
import {
  getNextEvent,
  isSequenceComplete,
} from '@/lib/tripEvents';
import { formatDeparture, openInMaps, safeGoBack } from '@/lib/helpers';
import { showAlert, showConfirm } from '@/lib/alert';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import type { ContractEvent } from '@/store/api/contractEventsApi';
import { Text } from '@/components/ui/Text';

interface Props {
  backFallback: string;
}

export default function DriverTripManageScreen({ backFallback }: Props) {
  const { c } = useTheme();
  const styles = createStyles(c);
  const tabBarPad = useFloatingTabBarPad();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const userId = useSelector((s: RootState) => s.auth.user?.id);

  const { data: post, isLoading: postLoading } = useGetPostByIdQuery(postId ?? '', {
    skip: !postId,
  });
  const {
    data: tripContracts,
    isLoading: contractsLoading,
    refetch: refetchContracts,
  } = useGetPostTripContractsQuery(postId ?? '', { skip: !postId });

  const [bulkCreateEvent, { isLoading: isAdvancing }] =
    useBulkCreateContractEventForPostMutation();
  const [completeBooking] = useCompleteBookingMutation();

  const isDriver = !!userId && !!post && post.author_id === userId;
  const isRouteOffer = post?.type === 'route_offer';

  /**
   * Aggregate completion — an event counts as "completed for the trip" only
   * when every active rider has it recorded on their contract. This means
   * the driver can't skip ahead on a subset of riders.
   */
  const aggregateCompletedTypes = useMemo((): string[] => {
    if (!tripContracts || tripContracts.length === 0) return [];
    const counts = new Map<string, number>();
    for (const c of tripContracts) {
      for (const t of c.completedEventTypes) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    const total = tripContracts.length;
    return Array.from(counts.entries())
      .filter(([, n]) => n >= total)
      .map(([t]) => t);
  }, [tripContracts]);

  const nextEvent = useMemo(
    () => (isRouteOffer ? getNextEvent('route_offer', aggregateCompletedTypes) : null),
    [aggregateCompletedTypes, isRouteOffer],
  );
  const allEventsDone = isRouteOffer
    ? isSequenceComplete('route_offer', aggregateCompletedTypes)
    : false;

  // Fake events list to feed TripProgressTimeline (it only reads event_type).
  const timelineEvents = useMemo((): ContractEvent[] => {
    return aggregateCompletedTypes.map<ContractEvent>((type) => ({
      id: `agg-${type}`,
      contract_id: postId ?? '',
      actor_id: userId ?? '',
      event_type: type,
      note: null,
      created_at: new Date().toISOString(),
    }));
  }, [aggregateCompletedTypes, postId, userId]);

  const handleAdvance = useCallback(async () => {
    if (!post || !userId || !nextEvent || !isRouteOffer) return;

    // Guardrail: starting a trip far ahead of its scheduled departure is
    // almost always a mis-tap. Warn (but don't hard block) when the first
    // event is fired more than 30 min before the scheduled `departure_at`.
    const EARLY_START_GRACE_MIN = 30;
    const isFirstEvent = aggregateCompletedTypes.length === 0;
    if (isFirstEvent && post.departure_at) {
      const departureMs = new Date(post.departure_at).getTime();
      const diffMin = (departureMs - Date.now()) / 60_000;
      if (diffMin > EARLY_START_GRACE_MIN) {
        const startEarly = await showConfirm(
          'Start trip early?',
          `This trip is scheduled for ${formatDeparture(post.departure_at)}. Are you sure you want to start it now?`,
        );
        if (!startEarly) return;
      }
    }

    const confirmed = await showConfirm(
      nextEvent.label,
      `Mark "${nextEvent.label}" for all ${tripContracts?.length ?? 0} rider(s)? Everyone will be notified.`,
    );
    if (!confirmed) return;
    try {
      await bulkCreateEvent({
        postId: post.id,
        actorId: userId,
        eventType: nextEvent.type,
        postType: 'route_offer',
      }).unwrap();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'error' in e
          ? String((e as { error: string }).error)
          : 'Could not advance trip. Try again.';
      showAlert('Error', msg);
    }
  }, [post, userId, nextEvent, isRouteOffer, tripContracts, bulkCreateEvent, aggregateCompletedTypes]);

  const handleCompleteTrip = useCallback(async () => {
    if (!tripContracts || tripContracts.length === 0) return;
    const confirmed = await showConfirm(
      'Complete Trip',
      `Mark the trip complete for all ${tripContracts.length} rider(s)? Each rider will be prompted to rate you.`,
    );
    if (!confirmed) return;

    try {
      for (const c of tripContracts) {
        await completeBooking(c.bookingId).unwrap();
      }
      await refetchContracts();
      showAlert('Trip Completed', 'All bookings marked complete.');
      safeGoBack(backFallback);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'error' in e
          ? String((e as { error: string }).error)
          : 'Could not complete trip.';
      showAlert('Error', msg);
    }
  }, [tripContracts, completeBooking, refetchContracts, backFallback]);

  if (postLoading || contractsLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.centered}>
        <Icon name="alert-triangle" size={40} color={c.textMuted} />
        <Text style={styles.errorText}>Trip not found</Text>
        <Button title="Go Back" variant="outline" onPress={() => safeGoBack(backFallback)} />
      </SafeAreaView>
    );
  }

  if (!isDriver || !isRouteOffer) {
    // Not the driver of a route_offer — punt to the single-contract screen.
    return (
      <SafeAreaView style={styles.centered}>
        <Icon name="alert-triangle" size={40} color={c.textMuted} />
        <Text style={styles.errorText}>
          This screen is only available to the driver of a route offer.
        </Text>
        <Button title="Go Back" variant="outline" onPress={() => safeGoBack(backFallback)} />
      </SafeAreaView>
    );
  }

  const riders = tripContracts ?? [];
  const totalSeats = riders.reduce((s, r) => s + r.seatsBooked, 0);

  // Map coordinates — fall back gracefully when lat/lng missing.
  const origin: [number, number] | null =
    post.origin_lng != null && post.origin_lat != null
      ? [post.origin_lng, post.origin_lat]
      : null;
  const destination: [number, number] | null =
    post.dest_lng != null && post.dest_lat != null
      ? [post.dest_lng, post.dest_lat]
      : null;

  // Pull the polyline out of the stored `route_geometry` JSON. Supports both
  // the Mapbox Directions shape ({ routes: [{ geometry: { coordinates } }] })
  // and the flat GeoJSON LineString shape ({ coordinates }).
  const routeCoordinates = ((): [number, number][] | undefined => {
    const geom = post.route_geometry as unknown;
    if (!geom || typeof geom !== 'object') return undefined;
    const directions = (geom as { routes?: { geometry?: { coordinates?: [number, number][] } }[] }).routes?.[0]?.geometry?.coordinates;
    if (directions) return directions;
    const flat = (geom as { coordinates?: [number, number][] }).coordinates;
    return flat ?? undefined;
  })();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader style={styles.header}>
        <Pressable onPress={() => safeGoBack(backFallback)} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Manage Trip</Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarPad }]}>
        {/* Route summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle} numberOfLines={2}>{post.title}</Text>
          {post.origin_address && post.dest_address && (
            <View style={styles.summaryRow}>
              <Icon name="map-pin" size={14} color={c.textMuted} />
              <Text style={styles.summaryText} numberOfLines={2}>
                {post.origin_address} → {post.dest_address}
              </Text>
            </View>
          )}
          {post.departure_at && (
            <View style={styles.summaryRow}>
              <Icon name="clock" size={14} color={c.textMuted} />
              <Text style={styles.summaryText}>{formatDeparture(post.departure_at)}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Icon name="user" size={14} color={c.textMuted} />
            <Text style={styles.summaryText}>
              {riders.length} rider{riders.length === 1 ? '' : 's'} · {totalSeats} seat{totalSeats === 1 ? '' : 's'}
            </Text>
          </View>
          {post.origin_lat != null && post.origin_lng != null && post.dest_lat != null && post.dest_lng != null && (
            <Pressable
              style={styles.mapsBtn}
              onPress={() =>
                openInMaps(
                  { lat: post.origin_lat!, lng: post.origin_lng!, label: post.origin_address ?? undefined },
                  { lat: post.dest_lat!, lng: post.dest_lng!, label: post.dest_address ?? undefined },
                )
              }
            >
              <Icon name="navigation" size={14} color={colors.accent.green} />
              <Text style={styles.mapsBtnText}>Open in Maps</Text>
            </Pressable>
          )}
        </View>

        {/* Trip stats — distance / drive time / est. gas */}
        {post.route_distance_km != null &&
          post.route_duration_min != null &&
          post.route_fuel_cost_cents != null && (
            <RouteInfoCard
              distanceKm={post.route_distance_km}
              durationMinutes={post.route_duration_min}
              fuelCostCents={post.route_fuel_cost_cents}
            />
          )}

        {/* Live map preview with route + pickup/drop pins */}
        {origin && destination && (
          <View style={styles.mapWrap}>
            <LiveTrackingMap
              driverLocation={null}
              origin={origin}
              destination={destination}
              routeCoordinates={routeCoordinates}
              isDriver
              style={styles.map}
            />
          </View>
        )}

        {/* Aggregate stepper */}
        <TripProgressTimeline postType="route_offer" events={timelineEvents} />

        {/* Advance / Complete button */}
        {!allEventsDone && nextEvent && (
          <Button
            title={isAdvancing ? 'Updating…' : nextEvent.label}
            onPress={handleAdvance}
            disabled={isAdvancing || riders.length === 0}
            style={styles.advanceBtn}
          />
        )}
        {allEventsDone && (
          <Button
            title="Complete Trip for All Riders"
            onPress={handleCompleteTrip}
            style={styles.advanceBtn}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...type.h3.bold,
    color: c.text,
    flex: 1,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: c.bg,
  },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  errorText: {
    ...type.body.regular,
    color: c.textMuted,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  summaryTitle: {
    ...type.h3.bold,
    color: c.text,
    marginBottom: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryText: {
    ...type.bodySm.regular,
    color: c.textMuted,
    flex: 1,
  },
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  mapsBtnText: {
    ...type.bodySm.bold,
    color: colors.accent.green,
  },
  advanceBtn: { marginBottom: spacing.lg },
  mapWrap: {
    height: 220,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    backgroundColor: c.bg,
  },
  map: { flex: 1 },
});
