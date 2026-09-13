import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Button, ScreenHeader, ScreenLoader, useFloatingTabBarPad } from '@/components/ui';
import { LiveTrackingMap } from '@/components/map';
import { TripProgressTimeline, TripActionButtons } from '@/components/trip';
import { isSequenceComplete, getEventLabel } from '@/lib/tripEvents';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import {
  useGetContractByIdQuery,
  useCompleteBookingMutation,
} from '@/store/api/bookingsApi';
import {
  useGetContractEventsQuery,
  useCreateContractEventMutation,
} from '@/store/api/contractEventsApi';
import { useGetMessagesQuery } from '@/store/api/messagesApi';
import { useCheckHasRatedQuery } from '@/store/api/ratingsApi';
import { useRealtime } from '@/hooks/useRealtime';
import { useDriverTracking } from '@/hooks/useDriverTracking';
import { useSOS } from '@/hooks/useSOS';
import { formatBZD, formatDeparture, openInMaps, safeGoBack } from '@/lib/helpers';
import { showAlert, showConfirm } from '@/lib/alert';
import { ENABLE_EKYASH, EKYASH_COMING_SOON_MESSAGE } from '@/lib/constants';
import type { RootState } from '@/store';
import type { ContractStatus } from '@/types/database';
import type { DriverLocationUpdate } from '@/store/slices/locationSlice';
import { Text } from '@/components/ui/Text';

export default function ContractDetailScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const tabBarPad = useFloatingTabBarPad();
  const { contractId } = useLocalSearchParams<{ contractId: string }>();
  const authUser = useSelector((state: RootState) => state.auth.user);
  const userId = authUser?.id;
  const payerPhone = authUser?.phone ?? '';

  const { data: contract, isLoading } = useGetContractByIdQuery(contractId ?? '', {
    skip: !contractId,
  });
  const [completeBooking, { isLoading: isCompleting }] = useCompleteBookingMutation();
  const { subscribeToTracking } = useRealtime();
  const { startTracking, stopTracking, isTracking: isDriverTracking } = useDriverTracking();
  const { triggerSOS, isSending: isSOSSending } = useSOS();

  const [driverLocation, setDriverLocation] = useState<DriverLocationUpdate | null>(null);

  // Contract events
  const { data: events = [] } = useGetContractEventsQuery(contractId ?? '', {
    skip: !contractId,
  });
  const [createEvent, { isLoading: isCreatingEvent }] = useCreateContractEventMutation();
  const completedEventTypes = useMemo(
    () => events.map((e) => e.event_type),
    [events],
  );

  // Messages — just the count for the preview strip
  const { data: messages = [] } = useGetMessagesQuery(contractId ?? '', { skip: !contractId });

  // Check if user has already rated this contract
  const otherPartyId = contract?.parties.find((p) => p !== userId);
  const { data: hasRated } = useCheckHasRatedQuery(
    { contractId: contractId ?? '', raterId: userId ?? '' },
    { skip: !contractId || !userId || contract?.status !== 'completed' },
  );

  // Determine if current user is the driver on this contract
  const isDriver = contract?.booking?.role === 'driver'
    ? contract.booking.user_id === userId
    : contract?.post?.author_id === userId;

  // Determine if current user is the "doer" who triggers trip progress events.
  // route_offer → the poster (driver) triggers events.
  // All other types → the booker (worker/helper/deliverer) triggers events.
  const isEventActor = useMemo(() => {
    if (!contract?.post || !contract?.booking || !userId) return false;
    if (contract.post.type === 'route_offer') {
      return contract.post.author_id === userId;
    }
    return contract.booking.user_id === userId;
  }, [contract, userId]);

  // Subscribe to live tracking when contract is active (rider side)
  useEffect(() => {
    if (!contractId || contract?.status !== 'active') return;
    const unsubscribe = subscribeToTracking(contractId, (loc) => {
      setDriverLocation({
        userId: loc.userId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        heading: loc.heading,
        speed: null,
        timestamp: loc.timestamp,
      });
    });
    return unsubscribe;
  }, [contractId, contract?.status, subscribeToTracking]);

  // Extract route coordinates from post geometry
  const routeCoordinates = useMemo((): [number, number][] | undefined => {
    const geom = contract?.post?.route_geometry;
    if (!geom || typeof geom !== 'object') return undefined;
    const geometry = (geom as any)?.routes?.[0]?.geometry;
    if (geometry?.coordinates) return geometry.coordinates;
    if ((geom as any)?.coordinates) return (geom as any).coordinates;
    return undefined;
  }, [contract?.post?.route_geometry]);

  // Origin/destination coordinates
  const origin: [number, number] | null =
    contract?.post?.origin_lng != null && contract?.post?.origin_lat != null
      ? [contract.post.origin_lng, contract.post.origin_lat]
      : null;
  const destination: [number, number] | null =
    contract?.post?.dest_lng != null && contract?.post?.dest_lat != null
      ? [contract.post.dest_lng, contract.post.dest_lat]
      : null;

  const payerId = useMemo(() => {
    if (!contract?.post || !contract?.booking) return null;
    return contract.post.type === 'route_offer'
      ? contract.booking.user_id
      : contract.post.author_id;
  }, [contract]);

  const payeeId = useMemo(() => {
    if (!contract?.post || !contract?.booking) return null;
    return contract.post.type === 'route_offer'
      ? contract.post.author_id
      : contract.booking.user_id;
  }, [contract]);

  const isPayer = !!userId && payerId === userId;

  // Driver: start/stop tracking
  const handleToggleTracking = useCallback(async () => {
    if (!contractId) return;
    if (isDriverTracking) {
      const confirmed = await showConfirm(
        'Stop Tracking',
        'Stop broadcasting your location to riders?',
      );
      if (confirmed) stopTracking();
    } else {
      startTracking(contractId);
    }
  }, [contractId, isDriverTracking, startTracking, stopTracking]);

  const handleComplete = useCallback(async () => {
    if (!contractId || !contract || !userId) return;
    if (contract.status !== 'active') return;

    const otherPartyId = contract.parties.find((p) => p !== userId);

    const isRoute = contract.post?.type === 'route_offer' || contract.post?.type === 'route_request';
    const completeLabel = isRoute ? 'Complete Trip' : 'Mark Complete';

    const confirmed = await showConfirm(
      completeLabel,
      `Mark this as completed? You'll be prompted to rate the other party.`,
    );
    if (!confirmed) return;

    try {
      const bookingId = contract.booking?.id;
      if (!bookingId) {
        showAlert('Error', 'No booking found for this contract.');
        return;
      }
      await completeBooking(bookingId).unwrap();
      if (otherPartyId) {
        router.push({
          pathname: '/modals/rate',
          params: { contractId, ratedId: otherPartyId },
        });
      }
    } catch {
      showAlert('Error', 'Could not complete. Please try again.');
    }
  }, [contractId, contract, userId, completeBooking]);

  const handlePayment = useCallback(() => {
    if (!contract || !payerId || !payeeId) return;
    if (!ENABLE_EKYASH) {
      showAlert('Coming Soon', EKYASH_COMING_SOON_MESSAGE);
      return;
    }
    router.push({
      pathname: '/modals/ekyash-pay',
      params: {
        contractId: contract.id,
        payerId,
        payeeId,
        amountCents: String(contract.agreed_price_cents),
        description: contract.post?.title ?? 'Kanek payment',
        payerPhone,
      },
    });
  }, [contract, payeeId, payerId, payerPhone]);

  const handleTriggerEvent = useCallback(async (eventType: string) => {
    if (!contractId || !userId) return;
    try {
      await createEvent({ contractId, actorId: userId, eventType }).unwrap();
      // Marking en_route implies the rider needs live location — start
      // broadcasting automatically instead of relying on a manual toggle.
      if (eventType === 'en_route' && !isDriverTracking) {
        startTracking(contractId);
      }
      showAlert('Updated', getEventLabel(eventType));
    } catch (err: any) {
      const msg = err?.data ?? err?.error ?? 'Could not update trip status.';
      showAlert('Error', typeof msg === 'string' ? msg : 'Could not update trip status.');
    }
  }, [contractId, userId, createEvent, isDriverTracking, startTracking]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <ScreenLoader />
      </SafeAreaView>
    );
  }

  if (!contract) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <Icon name="alert-triangle" size={48} color={c.textMuted} />
        <Text style={styles.errorText}>Contract not found</Text>
        <Button title="Go Back" variant="outline" onPress={() => safeGoBack('/(tabs)/activity/')} />
      </SafeAreaView>
    );
  }

  const isActive = contract.status === 'active';
  const isParty = contract.parties.includes(userId ?? '');
  const statusColor = STATUS_COLORS[contract.status];
  const showPaymentAction = ENABLE_EKYASH && contract.booking?.payment_method === 'ekyash' && isPayer;
  const showRateAction = isParty && contract.status === 'completed' && !hasRated && !!otherPartyId;
  const postType = contract.post?.type;

  // Last message preview
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastMessagePreview = lastMessage
    ? `${lastMessage.sender?.first_name ?? 'Someone'}: ${lastMessage.body}`.slice(0, 60)
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <ScreenHeader style={styles.header}>
        <Pressable
          onPress={() => safeGoBack('/(tabs)/activity/')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {contract.post?.title ?? 'Contract'}
        </Text>
        <View style={styles.headerRight}>
          {isActive && (
            <Pressable
              onPress={async () => {
                const confirmed = await showConfirm(
                  'Emergency SOS',
                  'This will send your GPS location to your emergency contact by email. Continue?',
                );
                if (confirmed) triggerSOS();
              }}
              hitSlop={12}
              disabled={isSOSSending}
            >
              <Icon name="shield-alert" size={24} color={colors.error} />
            </Pressable>
          )}
        </View>
      </ScreenHeader>

      {/* Status bar — tappable to view original post */}
      <Pressable
        style={[styles.statusBar, { backgroundColor: statusColor.bg }]}
        onPress={() => contract.post?.id && router.push(`/(tabs)/activity/post/${contract.post.id}`)}
        disabled={!contract.post?.id}
      >
        <View style={styles.statusBarRow}>
          <View style={styles.statusBarLeft}>
            {postType && <PostTypeBadge type={postType} />}
            <Text style={[styles.statusChip, { color: statusColor.fg }]}>
              {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
            </Text>
          </View>
          <Text style={styles.priceLabel}>
            {formatBZD(contract.agreed_price_cents)}
          </Text>
        </View>
        {contract.origin_address && (
          <Text style={styles.routeSummaryText} numberOfLines={1}>
            {contract.origin_address} → {contract.dest_address ?? '…'}
          </Text>
        )}
      </Pressable>

      {/* Main scrollable content — trip-focused */}
      <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, { paddingBottom: tabBarPad }]}>
        {/* Route visual */}
        {(contract.origin_address || contract.dest_address) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Route</Text>
              {origin && destination && (
                <Pressable
                  style={styles.openMapsBtn}
                  hitSlop={8}
                  onPress={() => openInMaps(
                    { lat: origin[1], lng: origin[0], label: contract.origin_address ?? undefined },
                    { lat: destination[1], lng: destination[0], label: contract.dest_address ?? undefined },
                  )}
                >
                  <Icon name="external-link" size={14} color={c.textMuted} />
                  <Text style={styles.openMapsText}>Open in Maps</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.routeRow}>
              <View style={styles.routeDots}>
                <View style={styles.dotGreen} />
                <View style={styles.routeLine} />
                <View style={styles.dotRed} />
              </View>
              <View style={styles.routeAddresses}>
                <Text style={styles.address}>{contract.origin_address ?? 'Not specified'}</Text>
                <Text style={styles.address}>{contract.dest_address ?? 'Not specified'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Info rows: departure, payment, seats */}
        {contract.departure_at && (
          <View style={styles.infoRow}>
            <Icon name="clock" size={18} color={c.textMuted} />
            <Text style={styles.infoText}>{formatDeparture(contract.departure_at)}</Text>
          </View>
        )}

        {contract.booking?.payment_method && (
          <View style={styles.infoRow}>
            <Icon name="receipt" size={18} color={c.textMuted} />
            <Text style={styles.infoText}>
              Payment: {contract.booking.payment_method === 'ekyash' ? 'E-Kyash' : 'Cash'}
            </Text>
          </View>
        )}

        {contract.post?.type === 'route_offer' && contract.booking && contract.booking.seats_booked > 0 && (
          <View style={styles.infoRow}>
            <Icon name="user" size={18} color={c.textMuted} />
            <Text style={styles.infoText}>
              {contract.booking.seats_booked} seat{contract.booking.seats_booked !== 1 ? 's' : ''} booked
            </Text>
          </View>
        )}

        {/* Trip Progress Timeline */}
        {postType && (
          <TripProgressTimeline
            postType={postType}
            events={events}
          />
        )}

        {/* Next Action Button */}
        {isEventActor && isActive && postType && (
          <TripActionButtons
            postType={postType}
            completedEventTypes={completedEventTypes}
            onTriggerEvent={handleTriggerEvent}
            isLoading={isCreatingEvent}
          />
        )}

        {/* Live tracking map */}
        {isActive && (origin || destination) && (
          <View style={styles.mapContainer}>
            <LiveTrackingMap
              driverLocation={driverLocation}
              origin={origin}
              destination={destination}
              routeCoordinates={routeCoordinates}
              isDriver={!!isDriver}
            />
          </View>
        )}

        {/* Driver tracking controls */}
        {isActive && isDriver && (
          <View style={styles.driverControls}>
            <Pressable
              style={[styles.trackingToggle, isDriverTracking && styles.trackingToggleActive]}
              onPress={handleToggleTracking}
            >
              <Icon
                name="navigation"
                size={18}
                color={isDriverTracking ? colors.neutral[0] : colors.accent.green}
              />
              <Text
                style={[
                  styles.trackingToggleText,
                  isDriverTracking && styles.trackingToggleTextActive,
                ]}
              >
                {isDriverTracking ? 'Stop Broadcasting' : 'Start Broadcasting Location'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.checkinButton}
              onPress={() => router.push({
                pathname: '/modals/selfie-checkin',
                params: { contractId: contractId! },
              })}
            >
              <Icon name="user" size={18} color={c.textMuted} />
              <Text style={styles.checkinText}>Selfie Check-in</Text>
            </Pressable>
          </View>
        )}

        {/* Primary actions: Pay / Complete */}
        {isParty && isActive && (
          <View style={styles.actionRow}>
            {showPaymentAction && (
              <Button
                title="Pay with E-Kyash"
                variant="outline"
                onPress={handlePayment}
                style={styles.actionBtn}
              />
            )}
            {(!postType || isSequenceComplete(postType, completedEventTypes)) && (
              <Button
                title={isCompleting ? 'Completing...' : (contract.post?.type === 'route_offer' || contract.post?.type === 'route_request') ? 'Complete Trip' : 'Mark Complete'}
                onPress={handleComplete}
                disabled={isCompleting}
                style={styles.actionBtn}
              />
            )}
          </View>
        )}

        {/* Rate prompt */}
        {showRateAction && (
          <Button
            title="Rate Trip"
            onPress={() =>
              router.push({
                pathname: '/modals/rate',
                params: { contractId, ratedId: otherPartyId },
              })
            }
            style={styles.actionBtn}
          />
        )}

        {/* Messages strip — navigate to dedicated chat */}
        <Pressable
          style={styles.messagesStrip}
          onPress={() => router.push({
            pathname: '/(tabs)/activity/messages/[contractId]',
            params: { contractId: contractId! },
          })}
        >
          <View style={styles.messagesStripLeft}>
            <Icon name="message-circle" size={20} color={c.textMuted} />
            <Text style={styles.messagesStripTitle}>
              Messages{messages.length > 0 ? ` (${messages.length})` : ''}
            </Text>
          </View>
          <View style={styles.messagesStripRight}>
            {lastMessagePreview ? (
              <Text style={styles.messagesPreview} numberOfLines={1}>
                {lastMessagePreview}
              </Text>
            ) : (
              <Text style={styles.messagesPreviewEmpty}>No messages yet</Text>
            )}
            <Icon name="chevron-right" size={18} color={c.textMuted} />
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const STATUS_COLORS: Record<ContractStatus, { bg: string; fg: string }> = {
  active: { bg: 'rgba(81, 193, 82, 0.18)', fg: colors.accent.green },
  completed: { bg: 'rgba(255, 255, 255, 0.06)', fg: colors.accent.green },
  disputed: { bg: 'rgba(255, 193, 7, 0.18)', fg: colors.warning },
  cancelled: { bg: 'rgba(211, 47, 47, 0.18)', fg: colors.error },
};

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.bg,
  },
  errorText: {
    ...type.body.regular,
    color: c.textMuted,
    marginVertical: spacing.lg,
  },
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
  headerRight: { width: 24, alignItems: 'flex-end' },

  // Status bar (always visible)
  statusBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  statusBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusChip: { ...type.bodySm.bold },
  priceLabel: { ...type.body.bold, color: c.text },
  routeSummaryText: {
    ...type.bodySm.regular,
    color: c.textMuted,
    marginTop: spacing.xs,
  },

  // Body
  body: { flex: 1 },
  bodyContent: { padding: spacing.lg },

  // Sections
  section: { marginBottom: spacing.xl },
  sectionLabel: {
    ...type.bodySm.bold,
    color: c.textMuted,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  openMapsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openMapsText: {
    ...type.caption.regular,
    color: c.textMuted,
    fontWeight: '600',
  },

  routeRow: { flexDirection: 'row', gap: spacing.md },
  routeDots: { alignItems: 'center', paddingVertical: 2 },
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
    marginVertical: 2,
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
    gap: spacing.lg,
  },
  address: { ...type.body.regular, color: c.text },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoText: { ...type.body.regular, color: c.text },

  // Map
  mapContainer: {
    height: 200,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },

  // Driver controls
  driverControls: { gap: spacing.md, marginBottom: spacing.xl },
  trackingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.pill,
    borderWidth: 2,
    borderColor: colors.accent.green,
  },
  trackingToggleActive: {
    backgroundColor: colors.accent.green,
    borderColor: colors.accent.green,
  },
  trackingToggleText: { ...type.body.bold, color: colors.accent.green },
  trackingToggleTextActive: { color: c.textInverse },
  checkinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: c.border,
  },
  checkinText: { ...type.body.bold, color: c.textMuted },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionBtn: { flex: 1 },

  // Messages strip
  messagesStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    marginTop: spacing.md,
  },
  messagesStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  messagesStripTitle: {
    ...type.body.bold,
    color: c.text,
  },
  messagesStripRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    justifyContent: 'flex-end',
  },
  messagesPreview: {
    ...type.bodySm.regular,
    color: c.textMuted,
    flex: 1,
    textAlign: 'right',
  },
  messagesPreviewEmpty: {
    ...type.bodySm.regular,
    color: c.textMuted,
    fontStyle: 'italic',
  },
});
