import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui';
import { LiveTrackingMap } from '@/components/map';
import { colors, typography, spacing, borderRadius } from '@/theme';
import {
  useGetContractByIdQuery,
  useCompleteContractMutation,
} from '@/store/api/bookingsApi';
import { useCheckHasRatedQuery } from '@/store/api/ratingsApi';
import { useRealtime } from '@/hooks/useRealtime';
import { useDriverTracking } from '@/hooks/useDriverTracking';
import { useSOS } from '@/hooks/useSOS';
import { formatBZD, formatDeparture, formatDate } from '@/lib/helpers';
import type { RootState } from '@/store';
import type { ContractStatus } from '@/types/database';
import type { DriverLocationUpdate } from '@/store/slices/locationSlice';

export default function ContractDetailScreen() {
  const { contractId } = useLocalSearchParams<{ contractId: string }>();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: contract, isLoading } = useGetContractByIdQuery(contractId ?? '', {
    skip: !contractId,
  });
  const [completeContract, { isLoading: isCompleting }] = useCompleteContractMutation();
  const { subscribeToTracking } = useRealtime();
  const { startTracking, stopTracking, isTracking: isDriverTracking } = useDriverTracking();
  const { triggerSOS, isSending: isSOSSending } = useSOS();

  const [driverLocation, setDriverLocation] = useState<DriverLocationUpdate | null>(null);

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

  // Driver: start/stop tracking
  const handleToggleTracking = useCallback(() => {
    if (!contractId) return;
    if (isDriverTracking) {
      Alert.alert('Stop Tracking', 'Stop broadcasting your location to riders?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: () => stopTracking() },
      ]);
    } else {
      startTracking(contractId);
    }
  }, [contractId, isDriverTracking, startTracking, stopTracking]);

  const handleComplete = useCallback(() => {
    if (!contractId || !contract || !userId) return;

    // Determine the other party to rate
    const otherPartyId = contract.parties.find((p) => p !== userId);

    Alert.alert(
      'Complete Trip',
      'Mark this contract as completed? You\'ll be prompted to rate the other party.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await completeContract(contractId).unwrap();
              if (otherPartyId) {
                router.push({
                  pathname: '/modals/rate',
                  params: {
                    contractId,
                    ratedId: otherPartyId,
                  },
                });
              }
            } catch {
              Alert.alert('Error', 'Could not complete the contract. Please try again.');
            }
          },
        },
      ],
    );
  }, [contractId, contract, userId, completeContract]);

  const handlePayment = useCallback(() => {
    if (!contract) return;
    router.push({
      pathname: '/modals/payment-select',
      params: {
        contractId: contract.id,
        amount: String(contract.agreed_price_cents),
      },
    });
  }, [contract]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </SafeAreaView>
    );
  }

  if (!contract) {
    return (
      <SafeAreaView style={styles.centered}>
        <Icon name="alert-triangle" size={48} color={colors.neutral[400]} />
        <Text style={styles.errorText}>Contract not found</Text>
        <Button title="Go Back" variant="outline" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const isActive = contract.status === 'active';
  const isParty = contract.parties.includes(userId ?? '');
  const statusColor = STATUS_COLORS[contract.status];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Contract</Text>
        {isActive && (
          <Pressable onPress={triggerSOS} hitSlop={12} disabled={isSOSSending}>
            <Icon name="shield-alert" size={24} color={colors.error} />
          </Pressable>
        )}
        {!isActive && <View style={{ width: 24 }} />}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.statusLabel, { color: statusColor.fg }]}>
            {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
          </Text>
          {isActive && driverLocation && (
            <Text style={styles.liveText}>
              Live tracking active
            </Text>
          )}
        </View>

        {/* Post info */}
        {contract.post && (
          <View style={styles.section}>
            <PostTypeBadge type={contract.post.type} />
            <Text style={styles.postTitle}>{contract.post.title}</Text>
          </View>
        )}

        {/* Route */}
        {(contract.origin_address || contract.dest_address) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Route</Text>
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

        {/* Departure */}
        {contract.departure_at && (
          <View style={styles.infoRow}>
            <Icon name="clock" size={18} color={colors.forest[400]} />
            <Text style={styles.infoText}>{formatDeparture(contract.departure_at)}</Text>
          </View>
        )}

        {/* Price */}
        <View style={styles.infoRow}>
          <Icon name="receipt" size={18} color={colors.forest[400]} />
          <Text style={styles.infoText}>
            Agreed price: {formatBZD(contract.agreed_price_cents)}
          </Text>
        </View>

        {/* Payment method */}
        {contract.booking?.payment_method && (
          <View style={styles.infoRow}>
            <Icon name="receipt" size={18} color={colors.forest[400]} />
            <Text style={styles.infoText}>
              Payment: {contract.booking.payment_method === 'ekyash' ? 'E-Kyash' : 'Cash'}
            </Text>
          </View>
        )}

        {/* Seats */}
        {contract.booking && contract.booking.seats_booked > 0 && (
          <View style={styles.infoRow}>
            <Icon name="user" size={18} color={colors.forest[400]} />
            <Text style={styles.infoText}>
              {contract.booking.seats_booked} seat{contract.booking.seats_booked !== 1 ? 's' : ''} booked
            </Text>
          </View>
        )}

        {/* Terms */}
        {contract.terms && Object.keys(contract.terms).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Terms</Text>
            {Object.entries(contract.terms).map(([key, value]) => (
              <Text key={key} style={styles.termRow}>
                {key}: {String(value)}
              </Text>
            ))}
          </View>
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
        )}

        {/* Timestamps */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Timeline</Text>
          <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>Created</Text>
            <Text style={styles.timelineValue}>{formatDate(contract.created_at)}</Text>
          </View>
          {contract.completed_at && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Completed</Text>
              <Text style={styles.timelineValue}>{formatDate(contract.completed_at)}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom actions */}
      {isParty && isActive && (
        <View style={styles.bottomBar}>
          {contract.booking?.payment_method === 'ekyash' && (
            <Button
              title="Pay with E-Kyash"
              variant="outline"
              onPress={handlePayment}
              style={styles.payButton}
            />
          )}
          <Button
            title={isCompleting ? 'Completing...' : 'Complete Trip'}
            onPress={handleComplete}
            disabled={isCompleting}
            style={styles.completeButton}
          />
        </View>
      )}

      {/* Rate prompt for completed contracts */}
      {isParty && contract.status === 'completed' && !hasRated && otherPartyId && (
        <View style={styles.bottomBar}>
          <Button
            title="Rate Trip"
            onPress={() =>
              router.push({
                pathname: '/modals/rate',
                params: { contractId, ratedId: otherPartyId },
              })
            }
            style={styles.completeButton}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const STATUS_COLORS: Record<ContractStatus, { bg: string; fg: string }> = {
  active: { bg: '#e8f5e9', fg: colors.accent.green },
  completed: { bg: colors.neutral[100], fg: colors.forest[500] },
  disputed: { bg: '#fff8e1', fg: colors.warning },
  cancelled: { bg: '#ffebee', fg: colors.error },
};



const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.neutral[50] },
  errorText: { ...typography.body1, color: colors.neutral[400], marginVertical: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.forest[900],
  },
  headerTitle: { ...typography.h3, color: colors.neutral[0], flex: 1, textAlign: 'center' },
  scrollContent: { padding: spacing.lg, paddingBottom: 120 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  statusLabel: { ...typography.body1Bold },
  liveText: { ...typography.caption, color: colors.accent.green },

  section: { marginBottom: spacing.xl },
  sectionLabel: { ...typography.body2Bold, color: colors.forest[400], marginBottom: spacing.sm },
  postTitle: { ...typography.h3, color: colors.forest[900], marginTop: spacing.xs },

  routeRow: { flexDirection: 'row', gap: spacing.md },
  routeDots: { alignItems: 'center', paddingVertical: 2 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent.green },
  routeLine: { width: 2, flex: 1, backgroundColor: colors.neutral[300], marginVertical: 2 },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  routeAddresses: { flex: 1, justifyContent: 'space-between', gap: spacing.lg },
  address: { ...typography.body1, color: colors.forest[900] },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  infoText: { ...typography.body1, color: colors.forest[900] },

  termRow: { ...typography.body2, color: colors.forest[500], marginBottom: spacing.xs },

  trackingCard: {
    backgroundColor: colors.neutral[100],
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.accent.green,
  },
  trackingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  trackingTitle: { ...typography.body1Bold, color: colors.accent.green },
  trackingCoords: { ...typography.body2, color: colors.forest[500] },
  trackingTime: { ...typography.caption, color: colors.neutral[400], marginTop: spacing.xs },

  mapContainer: {
    height: 280,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
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
    marginBottom: spacing.xl,
  },
  trackingToggleActive: {
    backgroundColor: colors.accent.green,
    borderColor: colors.accent.green,
  },
  trackingToggleText: {
    ...typography.body1Bold,
    color: colors.accent.green,
  },
  trackingToggleTextActive: {
    color: colors.neutral[0],
  },

  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  timelineLabel: { ...typography.body2, color: colors.forest[400] },
  timelineValue: { ...typography.body2, color: colors.forest[900] },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  payButton: { flex: 1 },
  completeButton: { flex: 1 },
});
