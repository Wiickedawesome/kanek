import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { Button, ScreenHeader, ScreenLoader, useFloatingTabBarPad } from '@/components/ui';
import { Icon } from '@/components/icons';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { TaxiVerifiedBadge } from '@/components/profile';
import { RouteInfoCard } from '@/components/cards/RouteInfoCard';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { useGetPostByIdQuery, useDeletePostMutation, useProceedRouteMutation, useCancelRouteShortMutation, useConfirmRecurringRouteMutation } from '@/store/api/postsApi';
import { useCreateBookingMutation, useGetBookingForPostQuery, useGetPostBookingsQuery, useAcceptApplicantMutation, useRejectApplicantMutation, useLazyGetMyConflictingContractsQuery, useLazyGetApplicantConflictsQuery } from '@/store/api/bookingsApi';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';
import { buildPointMapUrl, buildRouteMapUrl } from '@/lib/mapbox';
import { formatBZD, formatDate, formatDeparture, getEffectivePostStatus, getTimeAgo, isInBelize, openInMaps, safeGoBack } from '@/lib/helpers';
import { showAlert, showConfirm } from '@/lib/alert';
import type { RootState } from '@/store';
import type { PostType } from '@/types/database';
import { Text } from '@/components/ui/Text';

const MAP_HEIGHT = 200;
const MAP_PIXEL_WIDTH = 800; // retina
const MAP_PIXEL_HEIGHT = MAP_HEIGHT * 2;

const JOB_TIMELINE_LABELS: Record<string, string> = {
  asap: 'ASAP',
  today: 'Today',
  this_week: 'This Week',
  flexible: 'Flexible',
};

const JOB_CATEGORY_LABELS: Record<string, string> = {
  skilled_trade: 'Skilled Trade',
  cleaning: 'Cleaning',
  delivery: 'Delivery',
  childcare: 'Childcare',
  agriculture: 'Agriculture',
  construction: 'Construction',
  hospitality: 'Hospitality',
  admin: 'Admin',
  other: 'Other',
};

const REPEAT_DAY_ORDER: { value: number; label: string }[] = [
  { value: 7, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function normalizeRepeatDay(day: number): number | null {
  if (day === 0) return 7;
  if (day >= 1 && day <= 7) return day;
  return null;
}

function formatRepeatDays(days: number[] | null | undefined): string | null {
  if (!days || days.length === 0) return null;
  const normalized = new Set(days.map((day) => normalizeRepeatDay(day)).filter((day): day is number => day != null));
  const labels = REPEAT_DAY_ORDER.filter(({ value }) => normalized.has(value)).map(({ label }) => label);
  return labels.length > 0 ? labels.join(', ') : null;
}

function formatRepeatUntil(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-BZ', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface Props {
  backFallback: string;
}

interface StoredPickupStop {
  address: string;
  lat: number | null;
  lng: number | null;
}

function parsePickupStops(raw: string | null | undefined): StoredPickupStop[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as { stops?: StoredPickupStop[] };
    if (!Array.isArray(parsed.stops)) return [];
    return parsed.stops.filter((stop) => typeof stop.address === 'string' && stop.address.trim().length > 0);
  } catch {
    return [];
  }
}

export default function PostDetailScreen({ backFallback }: Props) {
  const { c } = useTheme();
  const styles = createStyles(c);
  const tabBarPad = useFloatingTabBarPad();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const authUser = useSelector((state: RootState) => state.auth.user);
  const userId = authUser?.id;
  const { data: myProfile } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const isAccountActive = myProfile?.account_status === 'active';
  const { data: post, isLoading, error } = useGetPostByIdQuery(postId ?? '', {
    skip: !postId,
    // List query upserts a partial record into this cache; force a background
    // refetch on mount so the full record (extra fields) gets filled in.
    refetchOnMountOrArgChange: true,
  });
  const [deletePost] = useDeletePostMutation();
  const [proceedRoute] = useProceedRouteMutation();
  const [cancelRouteShort] = useCancelRouteShortMutation();
  const [confirmRecurringRoute, { isLoading: isConfirmingRecurringRoute }] = useConfirmRecurringRouteMutation();
  const [createBooking] = useCreateBookingMutation();
  const [fetchConflicts] = useLazyGetMyConflictingContractsQuery();
  const [fetchApplicantConflicts] = useLazyGetApplicantConflictsQuery();
  const { data: existingBooking } = useGetBookingForPostQuery(
    { postId: postId ?? '', userId: userId ?? '' },
    { skip: !postId || !userId },
  );
  const { data: postBookings } = useGetPostBookingsQuery(
    { postId: postId ?? '' },
    { skip: !postId || !isOwnerCheck(userId, post) },
  );
  const [acceptApplicant] = useAcceptApplicantMutation();
  const [rejectApplicant] = useRejectApplicantMutation();
  const [isBooking, setIsBooking] = useState(false);
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);

  const hasCoords =
    post != null &&
    post.origin_lat != null &&
    post.origin_lng != null &&
    post.dest_lat != null &&
    post.dest_lng != null;

  const pickupStops = useMemo(() => parsePickupStops(post?.pickup_notes), [post?.pickup_notes]);
  const showsRouteLayout = Boolean(
    post &&
    (post.type === 'route_offer' || post.type === 'route_request' || post.type === 'errand' || post.type === 'package') &&
    (post.origin_address || post.origin_lat != null) &&
    (post.dest_address || post.dest_lat != null)
  );

  const pointLocation = useMemo(() => {
    if (!post) return null;

    if (
      post.origin_lat != null &&
      post.origin_lng != null &&
      isInBelize(post.origin_lat, post.origin_lng)
    ) {
      return {
        lat: post.origin_lat,
        lng: post.origin_lng,
        label: post.origin_address ?? undefined,
      };
    }

    if (
      post.dest_lat != null &&
      post.dest_lng != null &&
      isInBelize(post.dest_lat, post.dest_lng)
    ) {
      return {
        lat: post.dest_lat,
        lng: post.dest_lng,
        label: post.dest_address ?? undefined,
      };
    }

    return null;
  }, [post]);

  const mapUri = useMemo(() => {
    if (!post) return null;

    if (showsRouteLayout && hasCoords) {
      const geo = post.route_geometry as { type: string; coordinates: [number, number][] } | null;
      return buildRouteMapUrl(
        post.origin_lat!,
        post.origin_lng!,
        post.dest_lat!,
        post.dest_lng!,
        { width: MAP_PIXEL_WIDTH, height: MAP_PIXEL_HEIGHT, routeGeometry: geo, padding: 60 },
      );
    }

    if (pointLocation) {
      return buildPointMapUrl(pointLocation.lat, pointLocation.lng, {
        width: MAP_PIXEL_WIDTH,
        height: MAP_PIXEL_HEIGHT,
        padding: 80,
      });
    }

    return null;
  }, [hasCoords, pointLocation, post, showsRouteLayout]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ScreenLoader />
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.centered}>
        <Icon name="alert-triangle" size={48} color={c.textMuted} />
        <Text style={styles.errorText}>Post not found</Text>
        <Button title="Go Back" variant="outline" onPress={() => safeGoBack(backFallback)} />
      </SafeAreaView>
    );
  }

  const authorName = post.author
    ? `${post.author.first_name ?? ''} ${post.author.last_name ?? ''}`.trim()
    : 'Unknown';
  const isOwner = userId === post.author_id;
  const effectiveStatus = getEffectivePostStatus(
    post.status,
    post.departure_at,
    post.route_duration_min,
    post.type,
  );
  const isRoute = post.type === 'route_offer' || post.type === 'route_request';
  const isErrand = post.type === 'errand' || post.type === 'package';
  const isPostOpen = effectiveStatus === 'open';
  const isRouteOffer = post.type === 'route_offer';
  const showSeatsInfo = isRouteOffer && post.seats_total != null;
  const showJobPrice = post.type === 'job' && post.pay_rate_cents != null;
  const jobPriceCents = showJobPrice ? post.pay_rate_cents : null;
  const jobPayType = post.type === 'job' ? post.pay_type : null;
  const jobTimeline = post.type === 'job' ? post.job_timeline : null;
  const jobCategory = post.type === 'job' ? post.job_category : null;
  const repeatDaysLabel = formatRepeatDays(post.repeat_days);
  const repeatUntilLabel = formatRepeatUntil(post.repeat_until);
  const isRecurringRoute = isRoute && !!repeatDaysLabel;
  const showOwnerDeleteBar = isOwner && isPostOpen;
  const ownerContractId = isOwner && (effectiveStatus === 'filled' || effectiveStatus === 'in_progress')
    ? (postBookings ?? []).find(b => b.status === 'confirmed' && b.contract?.[0]?.id)?.contract?.[0]?.id ?? null
    : null;
  const showOwnerActiveBar = isOwner && (effectiveStatus === 'filled' || effectiveStatus === 'in_progress') && (isRouteOffer || !!ownerContractId);
  const showExistingBookingBar = !!existingBooking;
  const showOpenBookingBar = isPostOpen && !isOwner && !existingBooking;
  const hasOwnerBookings = (postBookings?.length ?? 0) > 0;
  const showOwnerResponsesSection = isOwner && hasOwnerBookings;
  const confirmedCount = (postBookings ?? []).filter((b) => b.status === 'confirmed').length;
  const bookerRows = (postBookings ?? []).map((b) => {
    const name = b.user
      ? `${b.user.first_name ?? ''} ${b.user.last_name ?? ''}`.trim() || 'Unknown'
      : 'Unknown';
    const isOwnerPending = isOwner && effectiveStatus === 'open' && b.status === 'pending';
    const isAccepted = b.status === 'confirmed';
    const isBusy = actionBookingId === b.id;

    const profilePress = b.user?.id
      ? () => router.push({ pathname: '/modals/user-profile', params: { userId: b.user!.id } })
      : undefined;

    return (
      <View key={b.id} style={styles.bookerRow}>
        <Pressable
          style={styles.bookerProfilePressable}
          onPress={profilePress}
          disabled={!profilePress}
        >
          <Avatar uri={b.user?.avatar_url} name={name} size="sm" />
          <View style={styles.bookerInfo}>
            <Text style={styles.bookerName}>{name}</Text>
            <View style={styles.bookerMetaRow}>
              <Text style={styles.bookerMeta}>
                {b.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                {post.type === 'route_offer' && (b.seats_booked ?? 1) > 1 ? ` · ${b.seats_booked} seats` : ''}
              </Text>
              {b.user?.rating_avg != null && b.user.rating_avg > 0 && (
                <View style={styles.bookerRating}>
                  <Icon name="star" size={12} color={colors.accent.green} />
                  <Text style={styles.bookerRatingText}>{b.user.rating_avg.toFixed(1)}</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
        {isOwnerPending && (
          <View style={styles.applicantActions}>
            <Button
              title={isBusy ? '...' : 'Accept'}
              size="sm"
              disabled={actionBookingId !== null}
              onPress={async () => {
                // Warn if the applicant already has an active contract that
                // overlaps this post's time window. Owner-side mirror of the
                // booker-side check. Skips jobs (open-ended, unreliable
                // duration). Best-effort — any RPC error falls through.
                const CHECKED: PostType[] = [
                  'route_offer',
                  'route_request',
                  'errand',
                  'package',
                ];
                if (post.departure_at && CHECKED.includes(post.type)) {
                  const defaultDuration =
                    post.type === 'errand' || post.type === 'package' ? 90 : 60;
                  try {
                    const conflicts = await fetchApplicantConflicts({
                      applicantId: b.user_id,
                      at: post.departure_at,
                      durationMin: post.route_duration_min ?? defaultDuration,
                    }).unwrap();
                    if (conflicts.length > 0) {
                      const first = conflicts[0];
                      const extra =
                        conflicts.length > 1
                          ? ` (and ${conflicts.length - 1} other)`
                          : '';
                      const proceed = await showConfirm(
                        'Applicant has a conflict',
                        `${name} already committed to "${first.postTitle}" at ${formatDeparture(first.departureAt)}${extra}. Accept anyway?`,
                      );
                      if (!proceed) return;
                    }
                  } catch {
                    // Non-fatal — continue to the normal confirm.
                  }
                }
                const ok = await showConfirm('Accept Applicant', getAcceptConfirmMessage(post.type, name));
                if (!ok) return;
                setActionBookingId(b.id);
                try {
                  await acceptApplicant({
                    bookingId: b.id,
                    postId: post.id,
                    applicantId: b.user_id,
                    postTitle: post.title ?? 'this post',
                    postType: post.type,
                  }).unwrap();
                } catch (e: any) {
                  const msg = e?.data?.error ?? e?.error ?? e?.message ?? 'Failed to accept.';
                  showAlert('Error', msg);
                } finally {
                  setActionBookingId(null);
                }
              }}
              style={styles.acceptButton}
            />
            <Button
              title={isBusy ? '...' : 'Reject'}
              size="sm"
              variant="outline"
              disabled={actionBookingId !== null}
              onPress={async () => {
                const ok = await showConfirm('Reject Applicant', `Remove ${name}'s request?`);
                if (!ok) return;
                setActionBookingId(b.id);
                try {
                  await rejectApplicant({
                    bookingId: b.id,
                    postId: post.id,
                    applicantId: b.user_id,
                    postTitle: post.title ?? 'this post',
                    postType: post.type,
                  }).unwrap();
                } catch (e: any) {
                  const msg = e?.data?.error ?? e?.error ?? e?.message ?? 'Failed to reject.';
                  showAlert('Error', msg);
                } finally {
                  setActionBookingId(null);
                }
              }}
              style={styles.rejectButton}
            />
          </View>
        )}
        {isAccepted && (
          <>
            <View style={styles.acceptedBadge}>
              <Text style={styles.acceptedBadgeText}>Accepted</Text>
            </View>
            {b.contract?.[0]?.id && (
              <Pressable
                onPress={() => router.push(`/(tabs)/activity/messages/${b.contract![0]!.id}`)}
                hitSlop={8}
              >
                <Icon name="message-circle" size={20} color={c.textMuted} />
              </Pressable>
            )}
          </>
        )}
      </View>
    );
  });

  let bottomAction: React.ReactNode;

  if (showOwnerDeleteBar) {
    const showManageTripOnOpen = isRouteOffer && confirmedCount > 0;
    const showStartTripNow = isRouteOffer && confirmedCount > 0;
    const showCancelTrip = isRouteOffer && confirmedCount > 0;
    bottomAction = (
      <View style={styles.bottomBar}>
        {showStartTripNow && (
          <Button
            title="Start trip now"
            onPress={async () => {
              const ok = await showConfirm(
                'Start trip now',
                `Start "${post.title}" with ${confirmedCount} confirmed rider(s)?`,
              );
              if (!ok) return;
              try {
                await proceedRoute(post.id).unwrap();
                router.push(`/(tabs)/activity/trip/${post.id}`);
              } catch (e: any) {
                const msg = e?.data?.error ?? e?.error ?? e?.message ?? 'Failed to start trip.';
                showAlert('Error', msg);
              }
            }}
            size="lg"
            style={styles.actionButton}
          />
        )}
        {showManageTripOnOpen && (
          <Button
            title="Manage Trip"
            variant="outline"
            onPress={() => router.push(`/(tabs)/activity/trip/${post.id}`)}
            size="lg"
            style={styles.actionButtonBelow}
          />
        )}
        {showCancelTrip ? (
          <Button
            title="Cancel trip"
            variant="outline"
            onPress={async () => {
              const ok = await showConfirm(
                'Cancel trip',
                `Cancel "${post.title}"? All ${confirmedCount} confirmed rider(s) will be notified.`,
              );
              if (!ok) return;
              try {
                await cancelRouteShort({ postId: post.id }).unwrap();
                safeGoBack(backFallback);
              } catch (e: any) {
                const msg = e?.data?.error ?? e?.error ?? e?.message ?? 'Failed to cancel trip.';
                showAlert('Error', msg);
              }
            }}
            size="lg"
            style={styles.actionButtonBelow}
          />
        ) : (
          <Button
            title="Delete Post"
            variant="outline"
            onPress={async () => {
              const confirmed = await showConfirm(
                'Delete Post',
                `Are you sure you want to delete "${post.title}"?`,
              );

              if (!confirmed) return;

              try {
                await deletePost(post.id).unwrap();
                safeGoBack(backFallback);
              } catch (e: any) {
                const msg = e?.data?.error ?? e?.error ?? e?.message ?? 'Failed to delete post.';
                showAlert('Error', msg);
              }
            }}
            size="lg"
            style={showManageTripOnOpen ? styles.actionButtonBelow : styles.actionButton}
          />
        )}
      </View>
    );
  } else if (showExistingBookingBar) {
    const isPending = existingBooking?.status === 'pending';
    const isConfirmed = existingBooking?.status === 'confirmed';
    const contractId = existingBooking?.contract?.[0]?.id;
    if (isConfirmed && contractId) {
      bottomAction = (
        <View style={styles.bottomBar}>
          <Text style={styles.bottomSuccessText}>
            {getAcceptedMessage(post.type)}
          </Text>
        </View>
      );
    } else if (isConfirmed) {
      bottomAction = (
        <View style={styles.bottomBar}>
          <Text style={styles.bottomSuccessText}>{getAcceptedMessage(post.type)}</Text>
        </View>
      );
    } else {
      bottomAction = (
        <View style={styles.bottomBar}>
          <Button
            title={isPending ? getPendingLabel(post.type) : getBookedLabel(post.type)}
            disabled
            onPress={() => {}}
            size="lg"
            style={styles.actionButton}
          />
        </View>
      );
    }
  } else if (showOpenBookingBar) {
    const isRiderOnRouteRequest = myProfile?.role === 'rider' && post.type === 'route_request';
    if (isRiderOnRouteRequest) {
      bottomAction = (
        <View style={styles.bottomBar}>
          <Text style={styles.bottomStatusText}>Only drivers can offer to drive</Text>
        </View>
      );
    } else {
    bottomAction = (
      <View style={styles.bottomBar}>
        <Button
          title={isBooking ? 'Please wait...' : getActionLabel(post.type)}
          disabled={isBooking}
          onPress={async () => {
            if (!userId) {
              showAlert('Sign in required', 'Please sign in to continue.');
              return;
            }

            if (!isAccountActive) {
              showAlert(
                'Account Pending',
                'Your account is still being reviewed. You can browse posts, but you cannot book or apply until your documents are approved.',
              );
              return;
            }

            // Scheduling conflict check — warn (don't hard-block) when the
            // booker already has an active contract that overlaps this one.
            // Applies to time-sensitive post types only. Jobs are skipped
            // because they're often open-ended and have no reliable duration.
            const CONFLICT_CHECKED_TYPES: PostType[] = [
              'route_offer',
              'route_request',
              'errand',
              'package',
            ];
            if (
              post.departure_at &&
              CONFLICT_CHECKED_TYPES.includes(post.type)
            ) {
              const defaultDuration =
                post.type === 'errand' || post.type === 'package' ? 90 : 60;
              try {
                const conflicts = await fetchConflicts({
                  userId,
                  at: post.departure_at,
                  durationMin: post.route_duration_min ?? defaultDuration,
                }).unwrap();
                if (conflicts.length > 0) {
                  const first = conflicts[0];
                  const extra =
                    conflicts.length > 1
                      ? ` (and ${conflicts.length - 1} other)`
                      : '';
                  const proceed = await showConfirm(
                    'Schedule conflict',
                    `You already committed to "${first.postTitle}" at ${formatDeparture(first.departureAt)}${extra}. That may overlap with this one. Continue anyway?`,
                  );
                  if (!proceed) return;
                }
              } catch {
                // Non-fatal — fall through and let the booking attempt proceed.
              }
            }

            const confirmed = await showConfirm(
              getActionLabel(post.type),
              getConfirmMessage(post.type),
            );
            if (!confirmed) return;

            setIsBooking(true);
            try {
              await createBooking({
                postId: post.id,
                userId,
                role: getBookingRole(post.type),
                seatsBooked: isRouteOffer ? 1 : undefined,
                paymentMethod: post.payment_method ?? 'cash',
              }).unwrap();

              showAlert('Success', getSuccessMessage(post.type));
              router.replace({ pathname: '/(tabs)/activity', params: { tab: 'my_posts' } });
            } catch (e: any) {
              const msg = e?.data?.error ?? e?.error ?? e?.message ?? 'Something went wrong';
              showAlert('Error', msg);
            } finally {
              setIsBooking(false);
            }
          }}
          size="lg"
          style={styles.actionButton}
        />
      </View>
    );
    }
  } else if (showOwnerActiveBar) {
    bottomAction = (
      <View style={styles.bottomBar}>
        <Button
          title={isRouteOffer ? 'Manage Trip' : 'View Contract'}
          onPress={() => {
            if (isRouteOffer) {
              router.push(`/(tabs)/activity/trip/${post.id}`);
            } else {
              router.push(`/(tabs)/activity/${ownerContractId}`);
            }
          }}
          size="lg"
          style={styles.actionButton}
        />
      </View>
    );
  } else {
    bottomAction = (
      <View style={styles.bottomBar}>
        <Text style={styles.bottomStatusText}>{getUnavailablePostText(effectiveStatus)}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <ScreenHeader style={styles.header}>
        <Pressable
          onPress={() => safeGoBack(backFallback)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {post.title}
        </Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPad }]}
      >
        {/* Type badge + status */}
        <View style={styles.badgeRow}>
          <PostTypeBadge type={post.type} />
          <View style={[styles.statusBadge, effectiveStatus === 'open' && styles.statusOpen]}>
            <Text style={[styles.statusText, effectiveStatus === 'open' && styles.statusTextOpen]}>
              {effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}
            </Text>
          </View>
        </View>

        {/* Route map */}
        {mapUri && (
          <View style={styles.mapContainer}>
            <Image source={{ uri: mapUri }} style={styles.mapImage} resizeMode="cover" />
            {showsRouteLayout && hasCoords ? (
              <Pressable
                style={styles.openMapsBtn}
                hitSlop={8}
                onPress={() => openInMaps(
                  { lat: post.origin_lat!, lng: post.origin_lng!, label: post.origin_address ?? undefined },
                  { lat: post.dest_lat!, lng: post.dest_lng!, label: post.dest_address ?? undefined },
                )}
              >
                <Icon name="external-link" size={16} color={colors.neutral[0]} />
                <Text style={styles.openMapsText}>Open in Maps</Text>
              </Pressable>
            ) : pointLocation ? (
              <Pressable
                style={styles.openMapsBtn}
                hitSlop={8}
                onPress={() => openInMaps(pointLocation)}
              >
                <Icon name="external-link" size={16} color={colors.neutral[0]} />
                <Text style={styles.openMapsText}>Open in Maps</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Route info */}
        {showsRouteLayout && (post.origin_address || post.dest_address) && (
          <View style={styles.section}>
            <View style={styles.routeRow}>
              <View style={styles.routeDot}>
                <View style={styles.dotGreen} />
                <View style={styles.routeLine} />
                {pickupStops.map((_, i) => (
                  <React.Fragment key={i}>
                    <View style={styles.dotStop} />
                    <View style={styles.routeLine} />
                  </React.Fragment>
                ))}
                <View style={styles.dotRed} />
              </View>
              <View style={styles.routeAddresses}>
                <Text style={styles.address}>{post.origin_address ?? 'Not specified'}</Text>
                {pickupStops.map((stop, i) => (
                  <Text key={i} style={styles.addressStop}>{stop.address}</Text>
                ))}
                <Text style={styles.address}>{post.dest_address ?? 'Not specified'}</Text>
              </View>
            </View>
            {/* Open in Maps link for posts without map preview */}
            {!mapUri && post.origin_lat != null && post.origin_lng != null && (
              <Pressable
                style={styles.openMapsLink}
                onPress={() => openInMaps(
                  { lat: post.origin_lat!, lng: post.origin_lng!, label: post.origin_address ?? undefined },
                  post.dest_lat != null && post.dest_lng != null
                    ? { lat: post.dest_lat, lng: post.dest_lng, label: post.dest_address ?? undefined }
                    : null,
                )}
              >
                <Icon name="external-link" size={14} color={c.textMuted} />
                <Text style={styles.openMapsLinkText}>Open in Maps</Text>
              </Pressable>
            )}
          </View>
        )}

        {!showsRouteLayout && (post.origin_address || post.dest_address) && (
          <View style={styles.section}>
            <View style={styles.infoRow}>
              <Icon name="map-pin" size={18} color={c.textMuted} />
              <Text style={styles.infoText}>{post.origin_address ?? post.dest_address}</Text>
            </View>
            {!mapUri && pointLocation && (
              <Pressable
                style={styles.openMapsLink}
                onPress={() => openInMaps(pointLocation)}
              >
                <Icon name="external-link" size={14} color={c.textMuted} />
                <Text style={styles.openMapsLinkText}>Open in Maps</Text>
              </Pressable>
            )}
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
            <Icon name="clock" size={18} color={c.textMuted} />
            <Text style={styles.infoText}>{formatDeparture(post.departure_at)}</Text>
          </View>
        )}

        {/* Price */}
        {isRoute && post.price_cents != null && (
          <View style={styles.infoRow}>
            <Icon name="receipt" size={18} color={c.textMuted} />
            <Text style={styles.infoText}>
              {formatBZD(post.price_cents)}{post.type === 'route_offer' ? '/seat' : ' offered'}
            </Text>
          </View>
        )}

        {/* Seats (route_offer) */}
        {showSeatsInfo && (
          <View style={styles.infoRow}>
            <Icon name="user" size={18} color={c.textMuted} />
            <Text style={styles.infoText}>
              {post.seats_filled}/{post.seats_total} seats filled
              {post.min_riders != null ? ` · Min ${post.min_riders} to go` : ''}
            </Text>
          </View>
        )}

        {/* Pickup style */}
        {post.pickup_style && (
          <View style={styles.infoRow}>
            <Icon name="map-pin" size={18} color={c.textMuted} />
            <Text style={styles.infoText}>
              {post.pickup_style === 'single' ? 'Single pickup point' : 'Multi-stop pickups'}
            </Text>
          </View>
        )}

        {post.is_round_trip && (
          <View style={styles.infoRow}>
            <Icon name="navigation" size={18} color={c.textMuted} />
            <Text style={styles.infoText}>Round trip</Text>
          </View>
        )}

        {post.return_time && (
          <View style={styles.infoRow}>
            <Icon name="clock" size={18} color={c.textMuted} />
            <Text style={styles.infoText}>Return: {formatDeparture(post.return_time)}</Text>
          </View>
        )}

        {repeatDaysLabel && (
          <View style={styles.infoRow}>
            <Icon name="clock" size={18} color={c.textMuted} />
            <Text style={styles.infoText}>Repeats: {repeatDaysLabel}</Text>
          </View>
        )}

        {repeatUntilLabel && (
          <View style={styles.infoRow}>
            <Icon name="clock" size={18} color={c.textMuted} />
            <Text style={styles.infoText}>Until: {repeatUntilLabel}</Text>
          </View>
        )}

        {isOwner && isRecurringRoute && (
          <View style={styles.recurringOwnerSection}>
            <Text style={styles.infoMuted}>
              {post.last_confirmed_at
                ? `Last confirmed: ${formatDate(post.last_confirmed_at)}`
                : 'This recurring route has not been reconfirmed yet.'}
            </Text>
            <Button
              title="Still offering this route"
              variant="outline"
              size="sm"
              loading={isConfirmingRecurringRoute}
              onPress={async () => {
                try {
                  await confirmRecurringRoute(post.id).unwrap();
                  showAlert('Route confirmed', 'We updated the recurring route confirmation timestamp.');
                } catch (e: any) {
                  const msg = e?.data?.error ?? e?.error ?? e?.message ?? 'Failed to confirm recurring route.';
                  showAlert('Error', msg);
                }
              }}
              style={styles.recurringConfirmButton}
            />
          </View>
        )}

        {/* Errand-specific */}
        {isErrand && (
          <>
            {post.errand_category && (
              <View style={styles.infoRow}>
                <Icon name="package" size={18} color={c.textMuted} />
                <Text style={styles.infoText}>
                  {post.errand_category.charAt(0).toUpperCase() + post.errand_category.slice(1)}
                </Text>
              </View>
            )}
            {post.errand_fee_cents != null && (
              <View style={styles.infoRow}>
                <Icon name="receipt" size={18} color={c.textMuted} />
                <Text style={styles.infoText}>
                  Errand fee: {formatBZD(post.errand_fee_cents)}
                </Text>
              </View>
            )}
            {post.item_cost_cents != null && (
              <View style={styles.infoRow}>
                <Icon name="receipt" size={18} color={c.textMuted} />
                <Text style={styles.infoMuted}>
                  Est. item cost: ~{formatBZD(post.item_cost_cents)} (separate)
                </Text>
              </View>
            )}
          </>
        )}

        {/* Job pay */}
        {showJobPrice && (
          <View style={styles.infoRow}>
            <Icon name="receipt" size={18} color={c.textMuted} />
            <Text style={styles.infoText}>
              Pay: {formatBZD(jobPriceCents!)}{jobPayType === 'hourly' ? '/hr' : ' fixed'}
            </Text>
          </View>
        )}
        {jobCategory != null && (
          <View style={styles.infoRow}>
            <Icon name="package" size={18} color={c.textMuted} />
            <Text style={styles.infoText}>{JOB_CATEGORY_LABELS[jobCategory] ?? jobCategory}</Text>
          </View>
        )}
        {jobTimeline != null && (
          <View style={styles.infoRow}>
            <Icon name="clock" size={18} color={c.textMuted} />
            <Text style={styles.infoText}>{JOB_TIMELINE_LABELS[jobTimeline] ?? jobTimeline}</Text>
          </View>
        )}

        {/* Description */}
        {post.description && (
          <View style={styles.descSection}>
            <Text style={styles.sectionLabel}>Description</Text>
            <Text style={styles.description}>{post.description}</Text>
          </View>
        )}

        {showOwnerResponsesSection && (
          <View style={styles.responsesSection}>
            <Text style={styles.sectionLabel}>{getAcceptedLabel(post.type)}</Text>
            <View style={styles.responsesList}>{bookerRows}</View>
          </View>
        )}

        {/* Author card */}
        <View style={styles.authorCard}>
          <Text style={styles.sectionLabel}>Posted by</Text>
          <Pressable
            style={styles.authorRow}
            onPress={() => {
              if (post.author_id && !isOwner) {
                router.push({ pathname: '/modals/user-profile', params: { userId: post.author_id } });
              }
            }}
            disabled={isOwner}
          >
            <Avatar
              uri={post.author?.avatar_url}
              name={authorName}
              size="md"
            />
            <View style={styles.authorInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text style={styles.authorName}>{authorName}</Text>
                {post.author?.taxi_association_verified && (
                  <TaxiVerifiedBadge
                    variant="compact"
                    associationName={post.author.taxi_association_name}
                  />
                )}
              </View>
              {post.author?.taxi_association_verified && post.author.taxi_association_name && (
                <TaxiVerifiedBadge
                  variant="pill"
                  associationName={post.author.taxi_association_name}
                  style={{ marginTop: 2, marginBottom: 2 }}
                />
              )}
              {post.author && (
                <View style={styles.authorStats}>
                  <View style={styles.stat}>
                    <Icon name="star" size={14} color={colors.accent.green} />
                    <Text style={styles.statText}>
                      {(post.author.rating_avg ?? 0).toFixed(1)}
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Icon name="clock" size={14} color={c.textMuted} />
                    <Text style={styles.statText}>
                      {post.author.punctuality_pct}% on time
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </Pressable>
          {!isOwner && (
            <Pressable
              style={styles.reportButton}
              onPress={async () => {
                const confirmed = await showConfirm('Report', 'Do you want to report this content?');
                if (confirmed) {
                  router.push({
                    pathname: '/modals/flag-content',
                    params: { targetType: 'post', targetId: postId! },
                  });
                }
              }}
              hitSlop={8}
            >
              <Icon name="alert-triangle" size={14} color={c.textMuted} />
              <Text style={styles.reportText}>Report</Text>
            </Pressable>
          )}
        </View>

        {/* Posted time */}
        <Text style={styles.postedAt}>
          Posted {getTimeAgo(post.created_at)}
        </Text>

        {/* Bottom action */}
        {bottomAction}
      </ScrollView>
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

function getBookedLabel(type: string): string {
  switch (type) {
    case 'route_offer': return 'Seat Booked';
    case 'route_request': return 'Offer Sent';
    case 'errand': return 'Errand Accepted';
    case 'package': return 'Delivery Accepted';
    case 'job': return 'Application Sent';
    default: return 'Booked';
  }
}

function getPendingLabel(type: string): string {
  switch (type) {
    case 'route_offer': return 'Seat Pending';
    case 'route_request': return 'Offer Pending';
    case 'errand': return 'Errand Pending';
    case 'package': return 'Delivery Pending';
    case 'job': return 'Application Pending';
    default: return 'Pending';
  }
}

function getAcceptedMessage(type: string): string {
  switch (type) {
    case 'route_offer': return 'Your seat is confirmed!';
    case 'route_request': return 'Your drive offer was accepted!';
    case 'errand': return 'You were accepted for this errand!';
    case 'package': return 'You were accepted for this delivery!';
    case 'job': return 'You got the job!';
    default: return 'You were accepted!';
  }
}

function getAcceptConfirmMessage(type: string, name: string): string {
  switch (type) {
    case 'route_offer': return `Confirm ${name}'s seat booking?`;
    case 'route_request': return `Accept ${name} as your driver?`;
    case 'errand': return `Accept ${name} for this errand?`;
    case 'package': return `Accept ${name} for this delivery?`;
    case 'job': return `Accept ${name} for this job?`;
    default: return `Accept ${name}'s request?`;
  }
}

function getAcceptedLabel(type: string): string {
  switch (type) {
    case 'route_offer': return 'Booked by';
    case 'route_request': return 'Driver offered';
    case 'errand': return 'Accepted by';
    case 'package': return 'Delivery by';
    case 'job': return 'Applicants';
    default: return 'Responded by';
  }
}

/** Safe check usable before `post` is loaded */
function isOwnerCheck(userId: string | undefined, post: { author_id: string } | undefined | null): boolean {
  return !!userId && !!post && userId === post.author_id;
}

function getBookingRole(postType: string): 'rider' | 'driver' {
  return postType === 'route_offer' ? 'rider' : 'driver';
}

function getConfirmMessage(type: string): string {
  switch (type) {
    case 'route_offer': return 'Book 1 seat on this ride?';
    case 'route_request': return 'Offer to drive this ride?';
    case 'errand': return 'Accept this errand?';
    case 'package': return 'Offer to deliver this package?';
    case 'job': return 'Apply for this job?';
    default: return 'Respond to this post?';
  }
}

function getSuccessMessage(type: string): string {
  switch (type) {
    case 'route_offer': return 'Seat booked! Check Activity for updates.';
    case 'route_request': return 'Offer sent! Check Activity for updates.';
    case 'errand': return 'Errand accepted! Check Activity for updates.';
    case 'package': return 'Delivery offer sent! Check Activity for updates.';
    case 'job': return 'Application sent! Check Activity for updates.';
    default: return 'Response sent! Check Activity for updates.';
  }
}

function getUnavailablePostText(status: string): string {
  switch (status) {
    case 'filled':
      return 'This post is no longer accepting responses.';
    case 'completed':
      return 'This post has been completed.';
    case 'cancelled':
      return 'This post was cancelled.';
    case 'expired':
      return 'This post has expired.';
    default:
      return 'This post is not available.';
  }
}


const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.bg,
    gap: spacing.lg,
  },
  errorText: {
    ...type.body.regular,
    color: c.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...type.h3.bold,
    color: c.text,
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 160,
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
    backgroundColor: c.border,
  },
  statusOpen: {
    backgroundColor: 'rgba(81, 193, 82, 0.18)',
  },
  statusText: {
    ...type.caption.regular,
    color: c.textMuted,
  },
  statusTextOpen: {
    color: c.textMuted,
  },
  title: {
    ...type.h2.bold,
    color: c.text,
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
  dotStop: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neutral[400],
    borderWidth: 1.5,
    borderColor: c.border,
  },
  routeAddresses: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
    gap: spacing.lg,
  },
  address: {
    ...type.body.regular,
    color: c.text,
  },
  addressStop: {
    ...type.bodySm.regular,
    color: c.textMuted,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoText: {
    ...type.body.regular,
    color: c.text,
  },
  infoMuted: {
    ...type.bodySm.regular,
    color: c.textMuted,
  },
  recurringOwnerSection: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  recurringConfirmButton: {
    alignSelf: 'flex-start',
  },
  descSection: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  stopsList: {
    gap: spacing.sm,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stopText: {
    ...type.body.regular,
    color: c.text,
    flex: 1,
  },
  sectionLabel: {
    ...type.bodySm.bold,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    ...type.body.regular,
    color: c.text,
    lineHeight: 24,
  },
  responsesSection: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  responsesList: {
    gap: spacing.sm,
  },
  authorCard: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
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
    ...type.body.bold,
    color: c.text,
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
    ...type.bodySm.regular,
    color: c.textMuted,
  },
  postedAt: {
    ...type.caption.regular,
    color: c.textMuted,
    textAlign: 'center',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-end',
  },
  reportText: {
    ...type.caption.regular,
    color: c.textMuted,
  },
  bottomBar: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  actionButton: {
    width: '100%',
  },
  actionButtonBelow: {
    width: '100%',
    marginTop: spacing.sm,
  },
  bottomStatusText: {
    ...type.body.regular,
    color: c.textMuted,
    textAlign: 'center',
  },
  bookerSection: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bookerLabel: {
    ...type.bodySm.bold,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  bookerInfo: {
    flex: 1,
    gap: 2,
  },
  bookerName: {
    ...type.body.bold,
    color: c.text,
  },
  bookerMeta: {
    ...type.caption.regular,
    color: c.textMuted,
  },
  bookerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bookerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  bookerRatingText: {
    ...type.caption.regular,
    color: c.textMuted,
    fontWeight: '600',
  },
  openMapsBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  openMapsText: {
    ...type.caption.regular,
    // The pill behind this text is rgba(0,0,0,0.6) in both themes,
    // so the label must always be light, not theme-inverted.
    color: '#ffffff',
    fontWeight: '600',
  },
  openMapsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    alignSelf: 'flex-end',
  },
  openMapsLinkText: {
    ...type.caption.regular,
    color: c.textMuted,
    fontWeight: '600',
  },
  bookerProfilePressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  applicantActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  acceptButton: {
    backgroundColor: colors.accent.green,
  },
  rejectButton: {},
  acceptedBadge: {
    backgroundColor: colors.accent.green + '22',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  acceptedBadgeText: {
    ...type.caption.regular,
    color: c.textMuted,
    fontWeight: '700',
  },
  bottomSuccessText: {
    ...type.h3.bold,
    color: colors.accent.green,
    textAlign: 'center',
  },
  bottomBarRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  bottomSuccessInRow: {
    flex: 1,
    textAlign: 'left',
  },
  actionButtonHalf: {
    flex: 1,
  },
  messageButton: {
    flex: 1,
  },
});
