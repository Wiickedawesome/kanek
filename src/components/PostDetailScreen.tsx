import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { GlassView } from '@/components/ui/GlassView';
import { PostTypeBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui';
import { RouteInfoCard } from '@/components/cards/RouteInfoCard';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useGetPostByIdQuery, useDeletePostMutation } from '@/store/api/postsApi';
import { useCreateBookingMutation, useGetBookingForPostQuery, useGetPostBookingsQuery, useCompleteBookingMutation, useAcceptJobApplicationMutation, useRejectJobApplicationMutation } from '@/store/api/bookingsApi';
import { supabase } from '@/lib/supabase';
import { buildRouteMapUrl } from '@/lib/mapbox';
import { formatBZD, formatDeparture, getTimeAgo, openInMaps, safeGoBack } from '@/lib/helpers';
import { showAlert, showConfirm } from '@/lib/alert';
import type { RootState } from '@/store';

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

interface Props {
  backFallback: string;
}

export default function PostDetailScreen({ backFallback }: Props) {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const authUser = useSelector((state: RootState) => state.auth.user);
  const userId = authUser?.id;
  const { data: post, isLoading, error } = useGetPostByIdQuery(postId ?? '', {
    skip: !postId,
  });
  const [deletePost] = useDeletePostMutation();
  const [createBooking] = useCreateBookingMutation();
  const [completeBooking] = useCompleteBookingMutation();
  const { data: existingBooking } = useGetBookingForPostQuery(
    { postId: postId ?? '', userId: userId ?? '' },
    { skip: !postId || !userId },
  );
  const { data: postBookings } = useGetPostBookingsQuery(
    { postId: postId ?? '' },
    { skip: !postId || !isOwnerCheck(userId, post) },
  );
  const [acceptJobApplication] = useAcceptJobApplicationMutation();
  const [rejectJobApplication] = useRejectJobApplicationMutation();
  const [isBooking, setIsBooking] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);

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
        <Button title="Go Back" variant="outline" onPress={() => safeGoBack(backFallback)} />
      </SafeAreaView>
    );
  }

  const authorName = post.author
    ? `${post.author.first_name ?? ''} ${post.author.last_name ?? ''}`.trim()
    : 'Unknown';
  const isOwner = userId === post.author_id;
  const isRoute = post.type === 'route_offer' || post.type === 'route_request';
  const isErrand = post.type === 'errand' || post.type === 'package';
  const isPostOpen = post.status === 'open';
  const isRouteOffer = post.type === 'route_offer';
  const showSeatsInfo = isRouteOffer && post.seats_total != null;
  const showJobPrice = post.type === 'job' && post.pay_rate_cents != null;
  const jobPriceCents = showJobPrice ? post.pay_rate_cents : null;
  const jobPayType = post.type === 'job' ? post.pay_type : null;
  const jobTimeline = post.type === 'job' ? post.job_timeline : null;
  const jobCategory = post.type === 'job' ? post.job_category : null;
  const showOwnerCompletionBar =
    isOwner &&
    !isPostOpen &&
    post.status !== 'completed' &&
    post.status !== 'cancelled' &&
    post.status !== 'expired';
  const showOwnerDeleteBar = isOwner && isPostOpen;
  const showExistingBookingBar = !!existingBooking;
  const showOpenBookingBar = isPostOpen && !isOwner && !existingBooking;
  const hasOwnerBookings = (postBookings?.length ?? 0) > 0;
  const showOwnerResponsesSection = isOwner && hasOwnerBookings;
  const bookerRows = (postBookings ?? []).map((b) => {
    const name = b.user
      ? `${b.user.first_name ?? ''} ${b.user.last_name ?? ''}`.trim() || 'Unknown'
      : 'Unknown';
    const isJobOwnerPending = post.type === 'job' && isOwner && post.status === 'open' && b.status === 'pending';
    const isJobAccepted = post.type === 'job' && b.status === 'confirmed';
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
            <Text style={styles.bookerMeta}>
              {b.status === 'confirmed' ? 'Confirmed' : 'Pending'}
              {b.seats_booked > 1 ? ` · ${b.seats_booked} seats` : ''}
            </Text>
          </View>
        </Pressable>
        {isJobOwnerPending && (
          <View style={styles.applicantActions}>
            <Button
              title={isBusy ? '...' : 'Accept'}
              size="sm"
              disabled={actionBookingId !== null}
              onPress={async () => {
                const ok = await showConfirm('Accept Applicant', `Accept ${name} for this job?`);
                if (!ok) return;
                setActionBookingId(b.id);
                try {
                  await acceptJobApplication({
                    bookingId: b.id,
                    postId: post.id,
                    applicantId: b.user_id,
                    postTitle: post.title ?? 'this job',
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
                const ok = await showConfirm('Reject Applicant', `Remove ${name}'s application?`);
                if (!ok) return;
                setActionBookingId(b.id);
                try {
                  await rejectJobApplication({
                    bookingId: b.id,
                    postId: post.id,
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
        {isJobAccepted && (
          <>
            <View style={styles.acceptedBadge}>
              <Text style={styles.acceptedBadgeText}>Accepted</Text>
            </View>
            {b.contract?.id && (
              <Pressable
                onPress={() => router.push(`/(tabs)/activity/${b.contract!.id}`)}
                hitSlop={8}
              >
                <Icon name="message-circle" size={20} color={colors.forest[600]} />
              </Pressable>
            )}
          </>
        )}
      </View>
    );
  });

  let bottomAction: React.ReactNode;

  if (showOwnerCompletionBar) {
    bottomAction = (
      <View style={styles.bottomBar}>
        <Button
          title={isCompleting ? 'Completing...' : 'Mark Complete'}
          disabled={isCompleting}
          onPress={async () => {
            if (!postBookings || postBookings.length === 0) {
              showAlert('No bookings', 'There are no active bookings to complete.');
              return;
            }
            const confirmed = await showConfirm(
              'Mark Complete',
              'Mark this post and all its bookings as completed?',
            );
            if (!confirmed) return;

            setIsCompleting(true);
            try {
              for (const b of postBookings) {
                await completeBooking(b.id).unwrap();
              }
              const firstBooking = postBookings[0];
              const { data: contract } = await supabase
                .from('contracts')
                .select('id')
                .eq('booking_id', firstBooking.id)
                .single();

              if (contract && firstBooking.user_id) {
                router.push({
                  pathname: '/modals/rate',
                  params: {
                    contractId: contract.id,
                    ratedId: firstBooking.user_id,
                  },
                });
              } else {
                showAlert('Completed', 'This post has been marked as completed.');
              }
            } catch (e: any) {
              const msg = e?.data?.error ?? e?.error ?? e?.message ?? 'Failed to complete.';
              showAlert('Error', msg);
            } finally {
              setIsCompleting(false);
            }
          }}
          size="lg"
          style={styles.actionButton}
        />
      </View>
    );
  } else if (showOwnerDeleteBar) {
    bottomAction = (
      <View style={styles.bottomBar}>
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
          style={styles.actionButton}
        />
      </View>
    );
  } else if (showExistingBookingBar) {
    const isJobPending = post.type === 'job' && existingBooking?.status === 'pending';
    const isJobConfirmed = post.type === 'job' && existingBooking?.status === 'confirmed';
    const isConfirmed = existingBooking?.status === 'confirmed';
    const contractId = existingBooking?.contract?.id;
    if (isJobConfirmed) {
      bottomAction = contractId ? (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarRow}>
            <Text style={[styles.bottomSuccessText, styles.bottomSuccessInRow]}>You Got the Job!</Text>
            <Button
              title="Message"
              variant="outline"
              onPress={() => router.push(`/(tabs)/activity/${contractId}`)}
              size="lg"
              style={styles.messageButton}
            />
          </View>
        </View>
      ) : (
        <View style={styles.bottomBar}>
          <Text style={styles.bottomSuccessText}>You Got the Job!</Text>
        </View>
      );
    } else if (isConfirmed && contractId) {
      bottomAction = (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarRow}>
            <Button
              title={getBookedLabel(post.type)}
              disabled
              onPress={() => {}}
              size="lg"
              style={styles.actionButtonHalf}
            />
            <Button
              title="Message"
              variant="outline"
              onPress={() => router.push(`/(tabs)/activity/${contractId}`)}
              size="lg"
              style={styles.messageButton}
            />
          </View>
        </View>
      );
    } else {
      bottomAction = (
        <View style={styles.bottomBar}>
          <Button
            title={isJobPending ? 'Application Pending' : getBookedLabel(post.type)}
            disabled
            onPress={() => {}}
            size="lg"
            style={styles.actionButton}
          />
        </View>
      );
    }
  } else if (showOpenBookingBar) {
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

            const confirmed = await showConfirm(
              getActionLabel(post.type),
              getConfirmMessage(post.type),
            );
            if (!confirmed) return;

            setIsBooking(true);
            try {
              const booking = await createBooking({
                postId: post.id,
                userId,
                role: getBookingRole(post.type),
                seatsBooked: isRouteOffer ? 1 : undefined,
                paymentMethod: post.payment_method ?? 'cash',
              }).unwrap();

              const shouldOpenPayment = shouldOpenPaymentAfterBooking(post.type, post.payment_method);
              const { data: contract } = await supabase
                .from('contracts')
                .select('id')
                .eq('booking_id', booking.id)
                .maybeSingle();

              showAlert(
                'Success',
                shouldOpenPayment
                  ? 'Seat booked. Continue to your contract to complete the E-Kyash payment.'
                  : getSuccessMessage(post.type),
              );

              if (shouldOpenPayment && contract?.id) {
                router.replace(`/(tabs)/activity/${contract.id}`);
              } else {
                router.replace({ pathname: '/(tabs)/activity', params: { tab: 'active' } });
              }
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
  } else {
    bottomAction = (
      <View style={styles.bottomBar}>
        <Text style={styles.bottomStatusText}>{getUnavailablePostText(post.status)}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <GlassView tint="dark" intensity={80} style={styles.header}>
        <Pressable onPress={() => safeGoBack(backFallback)} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Post Details
        </Text>
        <View style={{ width: 24 }} />
      </GlassView>

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
            {hasCoords && (
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
            )}
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
                <Icon name="external-link" size={14} color={colors.forest[400]} />
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
        {showSeatsInfo && (
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

        {/* Job pay */}
        {showJobPrice && (
          <View style={styles.infoRow}>
            <Icon name="receipt" size={18} color={colors.forest[400]} />
            <Text style={styles.infoText}>
              Pay: {formatBZD(jobPriceCents!)}{jobPayType === 'hourly' ? '/hr' : ' fixed'}
            </Text>
          </View>
        )}
        {jobCategory != null && (
          <View style={styles.infoRow}>
            <Icon name="package" size={18} color={colors.forest[400]} />
            <Text style={styles.infoText}>{JOB_CATEGORY_LABELS[jobCategory] ?? jobCategory}</Text>
          </View>
        )}
        {jobTimeline != null && (
          <View style={styles.infoRow}>
            <Icon name="clock" size={18} color={colors.forest[400]} />
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
              <Icon name="alert-triangle" size={14} color={colors.neutral[400]} />
              <Text style={styles.reportText}>Report</Text>
            </Pressable>
          )}
        </View>

        {/* Posted time */}
        <Text style={styles.postedAt}>
          Posted {getTimeAgo(post.created_at)}
        </Text>
      </ScrollView>

      {/* Bottom action */}
      {bottomAction}
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
    case 'route_offer': return 'Book 1 seat on this route?';
    case 'route_request': return 'Offer to drive this route?';
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

function shouldOpenPaymentAfterBooking(type: string, paymentMethod: string | null | undefined): boolean {
  return paymentMethod === 'ekyash' && type === 'route_offer';
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
  responsesSection: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  responsesList: {
    gap: spacing.sm,
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
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-end',
  },
  reportText: {
    ...typography.caption,
    color: colors.neutral[400],
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
  bottomStatusText: {
    ...typography.body1,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  bookerSection: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bookerLabel: {
    ...typography.body2Bold,
    color: colors.neutral[500],
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
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  bookerMeta: {
    ...typography.caption,
    color: colors.neutral[500],
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
    ...typography.caption,
    color: colors.neutral[0],
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
    ...typography.caption,
    color: colors.forest[400],
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
    ...typography.caption,
    color: colors.forest[600],
    fontWeight: '700',
  },
  bottomSuccessText: {
    ...typography.h3,
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
