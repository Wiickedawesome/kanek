/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { timingSafeEqual } from 'https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts';

import {
  createServiceClient,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  verifyAuthOrInternal,
} from '../_shared/supabase.ts';

/**
 * Cron function: send upcoming trip reminders, expire overdue public posts,
 * cancel stale accepted trips, and purge expired road reports.
 */
const NOTIFY_USER_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-user`;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const UPCOMING_REMINDER_MINUTES = 30;
const DEFAULT_TRIP_DURATION_MINUTES = 120;
const DEFAULT_ERRAND_DURATION_MINUTES = 90;
const INACTIVITY_GRACE_MINUTES = 180;

type TimedPost = {
  id: string;
  author_id: string;
  title: string;
  status: string;
  type: string;
  departure_at: string | null;
  expires_at: string | null;
  route_duration_min: number | null;
};

type BookingRecipient = {
  post_id: string;
  user_id: string;
  status: string;
};

type NotifyPayload = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  dedupe?: Record<string, unknown>;
  sendPush?: boolean;
};

function hasValidCronSecret(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('Authorization');

  if (!cronSecret || !authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7);
  const tokenBytes = new TextEncoder().encode(token);
  const secretBytes = new TextEncoder().encode(cronSecret);

  return tokenBytes.length === secretBytes.length && timingSafeEqual(tokenBytes, secretBytes);
}

function dedupePosts(posts: TimedPost[]): TimedPost[] {
  const seen = new Map<string, TimedPost>();
  for (const post of posts) {
    seen.set(post.id, post);
  }
  return Array.from(seen.values());
}

function getStaleInProgressDeadlineMs(post: TimedPost): number | null {
  if (post.status !== 'in_progress' || !post.departure_at) {
    return null;
  }

  const departureMs = new Date(post.departure_at).getTime();
  if (Number.isNaN(departureMs)) return null;

  const defaultDuration = post.type === 'errand' || post.type === 'package'
    ? DEFAULT_ERRAND_DURATION_MINUTES
    : DEFAULT_TRIP_DURATION_MINUTES;
  const durationMinutes = Math.max(Number(post.route_duration_min ?? defaultDuration), defaultDuration);

  return departureMs + (durationMinutes + INACTIVITY_GRACE_MINUTES) * 60_000;
}

async function sendInternalNotification(payload: NotifyPayload) {
  try {
    const res = await fetch(NOTIFY_USER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('notify-user failed', await res.text());
    }
  } catch (error) {
    console.error('notify-user request failed', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  // Internal-only: reject user-initiated requests
  const authResult = hasValidCronSecret(req)
    ? { userId: null as string | null }
    : await verifyAuthOrInternal(req);
  if ('error' in authResult) return authResult.error;
  if (authResult.userId !== null) {
    return errorResponse('Forbidden: internal-only endpoint', 403);
  }

  try {
    const supabase = createServiceClient();
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const reminderCutoff = new Date(nowMs + UPCOMING_REMINDER_MINUTES * 60_000).toISOString();

    const postFields = 'id, author_id, title, status, type, departure_at, expires_at, route_duration_min';

    const [
      dueByExpiryResult,
      dueByDepartureResult,
      reminderPostsResult,
    ] = await Promise.all([
      supabase
        .from('posts')
        .select(postFields)
        .in('status', ['open', 'activated'])
        .lt('expires_at', now)
        .not('expires_at', 'is', null),
      supabase
        .from('posts')
        .select(postFields)
        .in('status', ['open', 'activated', 'filled', 'in_progress'])
        .lt('departure_at', now)
        .not('departure_at', 'is', null),
      supabase
        .from('posts')
        .select('id, author_id, title, type, departure_at')
        .eq('status', 'filled')
        .gte('departure_at', now)
        .lt('departure_at', reminderCutoff)
        .not('departure_at', 'is', null),
    ]);

    if (dueByExpiryResult.error) {
      return errorResponse(`Posts expire error: ${dueByExpiryResult.error.message}`, 500);
    }
    if (dueByDepartureResult.error) {
      return errorResponse(`Posts departure error: ${dueByDepartureResult.error.message}`, 500);
    }
    if (reminderPostsResult.error) {
      return errorResponse(`Posts reminder error: ${reminderPostsResult.error.message}`, 500);
    }

    const duePosts = dedupePosts([
      ...((dueByExpiryResult.data ?? []) as TimedPost[]),
      ...((dueByDepartureResult.data ?? []) as TimedPost[]),
    ]);

    const expiredPosts: TimedPost[] = [];
    const cancelledPosts: TimedPost[] = [];

    for (const post of duePosts) {
      if (post.status === 'open' || post.status === 'activated') {
        expiredPosts.push(post);
        continue;
      }

      if (post.status === 'filled') {
        cancelledPosts.push(post);
        continue;
      }

      if (post.status === 'in_progress') {
        const inactiveAtMs = getStaleInProgressDeadlineMs(post);
        if (inactiveAtMs !== null && inactiveAtMs <= nowMs) {
          cancelledPosts.push(post);
        }
      }
    }

    const expiredIds = expiredPosts.map((post) => post.id);
    const cancelledIds = cancelledPosts.map((post) => post.id);
    const affectedIds = [...new Set([...expiredIds, ...cancelledIds])];

    const [affectedBookingsResult, reminderBookingsResult] = await Promise.all([
      affectedIds.length > 0
        ? supabase
            .from('bookings')
            .select('post_id, user_id, status')
            .in('post_id', affectedIds)
            .in('status', ['pending', 'confirmed'])
        : Promise.resolve({ data: [] as BookingRecipient[], error: null }),
      (reminderPostsResult.data?.length ?? 0) > 0
        ? supabase
            .from('bookings')
            .select('post_id, user_id, status')
            .in('post_id', reminderPostsResult.data!.map((post) => post.id))
            .eq('status', 'confirmed')
        : Promise.resolve({ data: [] as BookingRecipient[], error: null }),
    ]);

    if (affectedBookingsResult.error) {
      return errorResponse(`Bookings expire error: ${affectedBookingsResult.error.message}`, 500);
    }
    if (reminderBookingsResult.error) {
      return errorResponse(`Bookings reminder error: ${reminderBookingsResult.error.message}`, 500);
    }

    const affectedBookings = (affectedBookingsResult.data ?? []) as BookingRecipient[];
    const reminderBookings = (reminderBookingsResult.data ?? []) as BookingRecipient[];
    const bookingsByPost = new Map<string, BookingRecipient[]>();
    const reminderBookingsByPost = new Map<string, BookingRecipient[]>();

    for (const booking of affectedBookings) {
      const existing = bookingsByPost.get(booking.post_id) ?? [];
      existing.push(booking);
      bookingsByPost.set(booking.post_id, existing);
    }

    for (const booking of reminderBookings) {
      const existing = reminderBookingsByPost.get(booking.post_id) ?? [];
      existing.push(booking);
      reminderBookingsByPost.set(booking.post_id, existing);
    }

    if (expiredIds.length > 0) {
      const { error } = await supabase
        .from('posts')
        .update({ status: 'expired', updated_at: now })
        .in('id', expiredIds);

      if (error) {
        return errorResponse(`Expire update error: ${error.message}`, 500);
      }

      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancel_reason: 'Post expired after its scheduled deadline',
          cancelled_at: now,
          updated_at: now,
        })
        .in('post_id', expiredIds)
        .in('status', ['pending', 'confirmed']);

      if (bookingError) {
        return errorResponse(`Expire bookings error: ${bookingError.message}`, 500);
      }
    }

    if (cancelledIds.length > 0) {
      const { error } = await supabase
        .from('posts')
        .update({ status: 'cancelled', updated_at: now })
        .in('id', cancelledIds);

      if (error) {
        return errorResponse(`Cancel update error: ${error.message}`, 500);
      }

      const [{ error: bookingError }, { error: contractError }] = await Promise.all([
        supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            cancel_reason: 'Automatically cancelled due to inactivity after departure time',
            cancelled_at: now,
            updated_at: now,
          })
          .in('post_id', cancelledIds)
          .in('status', ['pending', 'confirmed']),
        supabase
          .from('contracts')
          .update({ status: 'cancelled' })
          .in('post_id', cancelledIds)
          .eq('status', 'active'),
      ]);

      if (bookingError) {
        return errorResponse(`Cancel bookings error: ${bookingError.message}`, 500);
      }
      if (contractError) {
        return errorResponse(`Cancel contracts error: ${contractError.message}`, 500);
      }
    }

    const notifications: Promise<void>[] = [];

    for (const post of reminderPostsResult.data ?? []) {
      notifications.push(sendInternalNotification({
        userId: post.author_id,
        type: 'trip_reminder',
        title: 'Trip starting soon',
        body: `Your post "${post.title}" starts within ${UPCOMING_REMINDER_MINUTES} minutes.`,
        data: { postId: post.id, departureAt: post.departure_at },
        dedupe: { postId: post.id, reminder: 'departure_window' },
      }));

      for (const booking of reminderBookingsByPost.get(post.id) ?? []) {
        notifications.push(sendInternalNotification({
          userId: booking.user_id,
          type: 'trip_reminder',
          title: 'Trip starting soon',
          body: `"${post.title}" starts within ${UPCOMING_REMINDER_MINUTES} minutes.`,
          data: { postId: post.id, departureAt: post.departure_at },
          dedupe: { postId: post.id, reminder: 'departure_window' },
        }));
      }
    }

    for (const post of expiredPosts) {
      notifications.push(sendInternalNotification({
        userId: post.author_id,
        type: 'post_expired',
        title: 'Post Expired',
        body: `Your post "${post.title}" passed its scheduled deadline and was expired automatically.`,
        data: { postId: post.id, reason: 'deadline_expired' },
        dedupe: { postId: post.id, reason: 'deadline_expired' },
      }));

      for (const booking of bookingsByPost.get(post.id) ?? []) {
        notifications.push(sendInternalNotification({
          userId: booking.user_id,
          type: 'post_expired',
          title: 'Post Expired',
          body: `"${post.title}" passed its scheduled deadline and is no longer active.`,
          data: { postId: post.id, reason: 'deadline_expired' },
          dedupe: { postId: post.id, reason: 'deadline_expired' },
        }));
      }
    }

    for (const post of cancelledPosts) {
      notifications.push(sendInternalNotification({
        userId: post.author_id,
        type: 'post_cancelled',
        title: 'Post Cancelled',
        body: `Your post "${post.title}" was cancelled automatically after its deadline due to inactivity.`,
        data: { postId: post.id, reason: 'inactivity_cancelled' },
        dedupe: { postId: post.id, reason: 'inactivity_cancelled' },
      }));

      for (const booking of bookingsByPost.get(post.id) ?? []) {
        notifications.push(sendInternalNotification({
          userId: booking.user_id,
          type: 'post_cancelled',
          title: 'Post Cancelled',
          body: `"${post.title}" was cancelled automatically after its deadline due to inactivity.`,
          data: { postId: post.id, reason: 'inactivity_cancelled' },
          dedupe: { postId: post.id, reason: 'inactivity_cancelled' },
        }));
      }
    }

    await Promise.allSettled(notifications);

    // Delete expired road reports (they auto-expire after 2 hours)
    const { count: deletedReports } = await supabase
      .from('road_reports')
      .delete({ count: 'exact' })
      .lt('expires_at', now);

    return jsonResponse({
      expiredPosts: expiredIds.length,
      cancelledPosts: cancelledIds.length,
      remindedPosts: reminderPostsResult.data?.length ?? 0,
      deletedRoadReports: deletedReports ?? 0,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Expire failed',
      500,
    );
  }
});
