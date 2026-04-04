import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
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
  useCompleteBookingMutation,
} from '@/store/api/bookingsApi';
import { useGetMessagesQuery, useSendMessageMutation } from '@/store/api/messagesApi';
import type { MessageWithSender } from '@/store/api/messagesApi';
import { useCheckHasRatedQuery } from '@/store/api/ratingsApi';
import { useRealtime } from '@/hooks/useRealtime';
import { useDriverTracking } from '@/hooks/useDriverTracking';
import { useSOS } from '@/hooks/useSOS';
import { formatBZD, formatDeparture, openInMaps, safeGoBack } from '@/lib/helpers';
import { showAlert, showConfirm } from '@/lib/alert';
import type { RootState } from '@/store';
import type { ContractStatus } from '@/types/database';
import type { DriverLocationUpdate } from '@/store/slices/locationSlice';

export default function ContractDetailScreen() {
  const { contractId } = useLocalSearchParams<{ contractId: string }>();
  const authUser = useSelector((state: RootState) => state.auth.user);
  const userId = authUser?.id;
  const payerPhone = authUser?.phone ?? '';
  const { data: contract, isLoading } = useGetContractByIdQuery(contractId ?? '', {
    skip: !contractId,
  });
  const [completeBooking, { isLoading: isCompleting }] = useCompleteBookingMutation();
  const { subscribeToTracking, subscribeToMessages } = useRealtime();
  const { startTracking, stopTracking, isTracking: isDriverTracking } = useDriverTracking();
  const { triggerSOS, isSending: isSOSSending } = useSOS();

  const [driverLocation, setDriverLocation] = useState<DriverLocationUpdate | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [messageText, setMessageText] = useState('');
  const chatListRef = useRef<FlatList<MessageWithSender>>(null);

  // Chat queries
  const { data: messages = [] } = useGetMessagesQuery(contractId ?? '', { skip: !contractId });
  const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();

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

  // Subscribe to real-time chat messages
  useEffect(() => {
    if (!contractId) return;
    const unsubscribe = subscribeToMessages(contractId);
    return unsubscribe;
  }, [contractId, subscribeToMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

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

    // Determine the other party to rate
    const otherPartyId = contract.parties.find((p) => p !== userId);

    const confirmed = await showConfirm(
      'Complete Trip',
      'Mark this contract as completed? You\'ll be prompted to rate the other party.',
    );
    if (!confirmed) return;

    try {
      // Complete the booking — DB trigger cascades to contract + post + notifications
      const bookingId = contract.booking?.id;
      if (!bookingId) {
        showAlert('Error', 'No booking found for this contract.');
        return;
      }
      await completeBooking(bookingId).unwrap();
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
      showAlert('Error', 'Could not complete the trip. Please try again.');
    }
  }, [contractId, contract, userId, completeBooking]);

  const handlePayment = useCallback(() => {
    if (!contract || !payerId || !payeeId) return;
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

  const handleSend = useCallback(async () => {
    if (!contractId || !userId || !messageText.trim()) return;
    try {
      await sendMessage({ contractId, senderId: userId, body: messageText }).unwrap();
      setMessageText('');
    } catch {
      showAlert('Error', 'Could not send message.');
    }
  }, [contractId, userId, messageText, sendMessage]);

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
        <Button title="Go Back" variant="outline" onPress={() => safeGoBack('/(tabs)/activity/')} />
      </SafeAreaView>
    );
  }

  const isActive = contract.status === 'active';
  const isParty = contract.parties.includes(userId ?? '');
  const statusColor = STATUS_COLORS[contract.status];
  const showPaymentAction = contract.booking?.payment_method === 'ekyash' && isPayer;
  const showRateAction = isParty && contract.status === 'completed' && !hasRated && !!otherPartyId;

  const renderMessage = ({ item }: { item: MessageWithSender }) => {
    const isMe = item.sender_id === userId;
    const senderName = item.sender
      ? `${item.sender.first_name ?? ''} ${item.sender.last_name ?? ''}`.trim()
      : 'Unknown';
    const time = new Date(item.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
        {!isMe && <Text style={styles.senderName}>{senderName}</Text>}
        <Text style={[styles.messageText, isMe && styles.myMessageText]}>{item.body}</Text>
        <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>{time}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack('/(tabs)/activity/')} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {contract.post?.title ?? 'Contract'}
        </Text>
        <View style={styles.headerRight}>
          {isActive && (
            <Pressable
              onPress={async () => {
                const confirmed = await showConfirm(
                  'Emergency SOS',
                  'This will send your GPS location to your emergency contact via SMS. Continue?',
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
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Trip details header — collapsible */}
        <Pressable
          style={[styles.tripHeader, { backgroundColor: statusColor.bg }]}
          onPress={() => setDetailsExpanded((prev) => !prev)}
        >
          <View style={styles.tripHeaderRow}>
            <View style={styles.tripHeaderLeft}>
              {contract.post && <PostTypeBadge type={contract.post.type} />}
              <Text style={[styles.statusChip, { color: statusColor.fg }]}>
                {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
              </Text>
            </View>
            <Icon
              name={detailsExpanded ? 'chevron-left' : 'chevron-right'}
              size={18}
              color={colors.forest[400]}
              style={detailsExpanded ? styles.chevronDown : styles.chevronRight}
            />
          </View>
          {/* Always-visible summary row */}
          <View style={styles.tripSummary}>
            {contract.origin_address && (
              <Text style={styles.tripSummaryText} numberOfLines={1}>
                {contract.origin_address} → {contract.dest_address ?? '…'}
              </Text>
            )}
            <Text style={styles.tripSummaryPrice}>
              {formatBZD(contract.agreed_price_cents)}
            </Text>
          </View>
        </Pressable>

        {/* Expanded trip details */}
        {detailsExpanded && (
          <ScrollView style={styles.detailsPanel} contentContainerStyle={styles.detailsContent}>
            {/* View original post */}
            {contract.post?.id && (
              <Pressable
                style={styles.viewPostLink}
                onPress={() => router.push(`/(tabs)/activity/post/${contract.post!.id}`)}
              >
                <Icon name="external-link" size={16} color={colors.accent.green} />
                <Text style={styles.viewPostText}>View Original Post</Text>
              </Pressable>
            )}

            {/* Route */}
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
                      <Icon name="external-link" size={14} color={colors.forest[400]} />
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

            {/* Departure */}
            {contract.departure_at && (
              <View style={styles.infoRow}>
                <Icon name="clock" size={18} color={colors.forest[400]} />
                <Text style={styles.infoText}>{formatDeparture(contract.departure_at)}</Text>
              </View>
            )}

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
                  <Icon name="user" size={18} color={colors.forest[400]} />
                  <Text style={styles.checkinText}>Selfie Check-in</Text>
                </Pressable>
              </View>
            )}

            {/* Action buttons in expanded details */}
            {isParty && isActive && (
              <View style={styles.detailActions}>
                {showPaymentAction && (
                  <Button
                    title="Pay with E-Kyash"
                    variant="outline"
                    onPress={handlePayment}
                    style={styles.detailActionBtn}
                  />
                )}
                <Button
                  title={isCompleting ? 'Completing...' : 'Complete Trip'}
                  onPress={handleComplete}
                  disabled={isCompleting}
                  style={styles.detailActionBtn}
                />
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
                style={styles.detailActionBtn}
              />
            )}
          </ScrollView>
        )}

        {/* Chat messages */}
        <FlatList
          ref={chatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.chatList}
          contentContainerStyle={styles.chatContent}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Icon name="clipboard-list" size={40} color={colors.neutral[300]} />
              <Text style={styles.emptyChatText}>No messages yet</Text>
              <Text style={styles.emptyChatSubText}>
                Send a message to coordinate with your contact
              </Text>
            </View>
          }
        />

        {/* Message input */}
        {isParty && (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type a message…"
              placeholderTextColor={colors.neutral[400]}
              multiline
              maxLength={2000}
            />
            <Pressable
              style={[styles.sendButton, (!messageText.trim() || isSending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!messageText.trim() || isSending}
              hitSlop={8}
            >
              <Icon
                name="send"
                size={20}
                color={messageText.trim() && !isSending ? colors.neutral[0] : colors.neutral[400]}
              />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
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
  flex: { flex: 1 },
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
  headerRight: { width: 24, alignItems: 'flex-end' },

  // Trip header (collapsible)
  tripHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  tripHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusChip: { ...typography.body2Bold },
  chevronDown: { transform: [{ rotate: '-90deg' }] },
  chevronRight: {},
  tripSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  tripSummaryText: { ...typography.body2, color: colors.forest[500], flex: 1, marginRight: spacing.sm },
  tripSummaryPrice: { ...typography.body1Bold, color: colors.forest[900] },

  // Expanded details panel
  detailsPanel: { maxHeight: 400, borderBottomWidth: 1, borderBottomColor: colors.neutral[200] },
  detailsContent: { padding: spacing.lg },
  detailActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  detailActionBtn: { flex: 1 },

  // Shared detail styles
  section: { marginBottom: spacing.xl },
  sectionLabel: { ...typography.body2Bold, color: colors.forest[400], marginBottom: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openMapsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openMapsText: { ...typography.caption, color: colors.forest[400], fontWeight: '600' },
  viewPostLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  viewPostText: {
    ...typography.body2Bold,
    color: colors.accent.green,
  },
  routeRow: { flexDirection: 'row', gap: spacing.md },
  routeDots: { alignItems: 'center', paddingVertical: 2 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent.green },
  routeLine: { width: 2, flex: 1, backgroundColor: colors.neutral[300], marginVertical: 2 },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error },
  routeAddresses: { flex: 1, justifyContent: 'space-between', gap: spacing.lg },
  address: { ...typography.body1, color: colors.forest[900] },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  infoText: { ...typography.body1, color: colors.forest[900] },
  mapContainer: { height: 200, borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing.lg },
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
  trackingToggleActive: { backgroundColor: colors.accent.green, borderColor: colors.accent.green },
  trackingToggleText: { ...typography.body1Bold, color: colors.accent.green },
  trackingToggleTextActive: { color: colors.neutral[0] },
  checkinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  checkinText: { ...typography.body1Bold, color: colors.forest[500] },

  // Chat
  chatList: { flex: 1 },
  chatContent: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexGrow: 1, justifyContent: 'flex-end' },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyChatText: { ...typography.body1Bold, color: colors.neutral[400] },
  emptyChatSubText: { ...typography.body2, color: colors.neutral[400] },

  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent.green,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.neutral[0],
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  senderName: { ...typography.caption, color: colors.forest[400], fontWeight: '600', marginBottom: 2 },
  messageText: { ...typography.body1, color: colors.forest[900] },
  myMessageText: { color: colors.neutral[0] },
  messageTime: { ...typography.caption, color: colors.forest[400], marginTop: 2, alignSelf: 'flex-end' },
  myMessageTime: { color: 'rgba(255,255,255,0.7)' },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    ...typography.body1,
    color: colors.forest[900],
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.neutral[200],
  },
});
