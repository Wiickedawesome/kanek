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
const RECURRING_CONFIRM_INTERVAL_DAYS = 15;
const RECURRING_CONFIRM_INTERVAL_MS = RECURRING_CONFIRM_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

type TimedPost = {
  id: string;
  author_id: string;
  title: string;
  status: string;
  type: string;
  departure_at: string | null;
  expires_at: string | null;
  last_confirmed_at: string | null;
  repeat_days: number[] | null;
  repeat_until: string | null;
  return_time: string | null;
  route_duration_min: number | null;
};

type RecurringAdvancePlan = {
  post: TimedPost;
  nextDepartureAt: string;
  nextReturnTime: string | null;
};

type BookingRecipient = {
  post_id: string;
  user_id: string;
  status: string;
};

type NotifyPayload = {
  userId?: string;
  userIds?: string[];
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

function normalizeRepeatDay(day: number): number | null {
  if (day === 0) return 7;
  if (day >= 1 && day <= 7) return day;
  return null;
}

function getRecurringDays(days: number[] | null | undefined): number[] {
  if (!days || days.length === 0) return [];
  return Array.from(new Set(days.map((day) => normalizeRepeatDay(day)).filter((day): day is number => day != null)));
}

function getNextRecurringDeparture(post: TimedPost): Date | null {
  if (!post.departure_at) return null;

  const repeatDays = getRecurringDays(post.repeat_days);
  if (repeatDays.length === 0) return null;

  const departure = new Date(post.departure_at);
  if (Number.isNaN(departure.getTime())) return null;

  const year = departure.getUTCFullYear();
  const month = departure.getUTCMonth();
  const date = departure.getUTCDate();
  const hours = departure.getUTCHours();
  const minutes = departure.getUTCMinutes();
  const seconds = departure.getUTCSeconds();
  const millis = departure.getUTCMilliseconds();

  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = new Date(Date.UTC(year, month, date + offset, hours, minutes, seconds, millis));
    const weekday = candidate.getUTCDay() === 0 ? 7 : candidate.getUTCDay();
    if (!repeatDays.includes(weekday)) continue;

    if (post.repeat_until && candidate.toISOString().slice(0, 10) > post.repeat_until) {
      return null;
    }

    return candidate;
  }

  return null;
}

function getShiftedReturnTime(post: TimedPost, nextDeparture: Date): string | null {
  if (!post.departure_at || !post.return_time) return null;

  const departure = new Date(post.departure_at);
  const returnTime = new Date(post.return_time);
  if (Number.isNaN(departure.getTime()) || Number.isNaN(returnTime.getTime())) {
    return null;
  }

  const durationMs = returnTime.getTime() - departure.getTime();
  if (durationMs <= 0) return null;

  return new Date(nextDeparture.getTime() + durationMs).toISOString();
}

function shouldSendRecurringKeepaliveReminder(post: TimedPost, nowMs: number, todayDate: string): boolean {
  if (getRecurringDays(post.repeat_days).length === 0) return false;
  if (post.repeat_until && post.repeat_until < todayDate) return false;

  if (!post.last_confirmed_at) return true;

  const lastConfirmedMs = new Date(post.last_confirmed_at).getTime();
  if (Number.isNaN(lastConfirmedMs)) return true;

  return nowMs - lastConfirmedMs >= RECURRING_CONFIRM_INTERVAL_MS;
}

function formatNotificationDate(isoDate: string): string {
  const value = new Date(isoDate);
  if (Number.isNaN(value.getTime())) return isoDate;

  return value.toLocaleString('en-BZ', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
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
    const recurringConfirmCutoff = new Date(nowMs - RECURRING_CONFIRM_INTERVAL_MS).toISOString();
    const recurringReminderBucket = Math.floor(nowMs / RECURRING_CONFIRM_INTERVAL_MS);
    const todayDate = now.slice(0, 10);

    const postFields = 'id, author_id, title, status, type, departure_at, expires_at, route_duration_min, repeat_days, repeat_until, return_time, last_confirmed_at';

    const [
      dueByExpiryResult,
      dueByDepartureResult,
      reminderPostsResult,
      advanceRecurringPostsResult,
      recurringKeepalivePostsResult,
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
      supabase
        .from('posts')
        .select(postFields)
        .in('type', ['route_offer', 'route_request'])
        .in('status', ['open', 'activated', 'expired', 'cancelled', 'completed'])
        .lt('departure_at', now)
        .not('departure_at', 'is', null)
        .not('repeat_days', 'is', null),
      supabase
        .from('posts')
        .select(postFields)
        .in('type', ['route_offer', 'route_request'])
        .in('status', ['open', 'activated'])
        .not('repeat_days', 'is', null)
        .or(`last_confirmed_at.is.null,last_confirmed_at.lte.${recurringConfirmCutoff}`),
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
    if (advanceRecurringPostsResult.error) {
      return errorResponse(`Recurring advance error: ${advanceRecurringPostsResult.error.message}`, 500);
    }
    if (recurringKeepalivePostsResult.error) {
      return errorResponse(`Recurring keepalive error: ${recurringKeepalivePostsResult.error.message}`, 500);
    }

    const advancePlans = dedupePosts((advanceRecurringPostsResult.data ?? []) as TimedPost[])
      .reduce<RecurringAdvancePlan[]>((plans, post) => {
        const nextDeparture = getNextRecurringDeparture(post);
        if (!nextDeparture) return plans;

        plans.push({
          post,
          nextDepartureAt: nextDeparture.toISOString(),
          nextReturnTime: getShiftedReturnTime(post, nextDeparture),
        });
        return plans;
      }, []);

    const advancedIds = advancePlans.map((plan) => plan.post.id);
    const advancedIdSet = new Set(advancedIds);

    const duePosts = dedupePosts([
      ...((dueByExpiryResult.data ?? []) as TimedPost[]),
      ...((dueByDepartureResult.data ?? []) as TimedPost[]),
    ]).filter((post) => !advancedIdSet.has(post.id));

    const recurringKeepalivePosts = ((recurringKeepalivePostsResult.data ?? []) as TimedPost[])
      .filter((post) => shouldSendRecurringKeepaliveReminder(post, nowMs, todayDate));

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
    const affectedIds = [...new Set([...expiredIds, ...cancelledIds, ...advancedIds])];

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

    if (advancedIds.length > 0) {
      const [{ error: bookingError }, { error: contractError }] = await Promise.all([
        supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            cancel_reason: 'Recurring route moved to its next scheduled occurrence',
            cancelled_at: now,
            updated_at: now,
          })
          .in('post_id', advancedIds)
          .in('status', ['pending', 'confirmed']),
        supabase
          .from('contracts')
          .update({ status: 'cancelled' })
          .in('post_id', advancedIds)
          .eq('status', 'active'),
      ]);

      if (bookingError) {
        return errorResponse(`Advance recurring bookings error: ${bookingError.message}`, 500);
      }
      if (contractError) {
        return errorResponse(`Advance recurring contracts error: ${contractError.message}`, 500);
      }

      for (const plan of advancePlans) {
        const { error } = await supabase
          .from('posts')
          .update({
            departure_at: plan.nextDepartureAt,
            return_time: plan.nextReturnTime,
            expires_at: null,
            seats_filled: 0,
            status: 'open',
            updated_at: now,
          })
          .eq('id', plan.post.id);

        if (error) {
          return errorResponse(`Advance recurring routes error: ${error.message}`, 500);
        }
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

      const reminderRiderIds = (reminderBookingsByPost.get(post.id) ?? []).map((b) => b.user_id);
      if (reminderRiderIds.length > 0) {
        notifications.push(sendInternalNotification({
          userIds: reminderRiderIds,
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

      const expiredRiderIds = (bookingsByPost.get(post.id) ?? []).map((b) => b.user_id);
      if (expiredRiderIds.length > 0) {
        notifications.push(sendInternalNotification({
          userIds: expiredRiderIds,
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

      const cancelledRiderIds = (bookingsByPost.get(post.id) ?? []).map((b) => b.user_id);
      if (cancelledRiderIds.length > 0) {
        notifications.push(sendInternalNotification({
          userIds: cancelledRiderIds,
          type: 'post_cancelled',
          title: 'Post Cancelled',
          body: `"${post.title}" was cancelled automatically after its deadline due to inactivity.`,
          data: { postId: post.id, reason: 'inactivity_cancelled' },
          dedupe: { postId: post.id, reason: 'inactivity_cancelled' },
        }));
      }
    }

    for (const plan of advancePlans) {
      const scheduleLabel = formatNotificationDate(plan.nextDepartureAt);

      notifications.push(sendInternalNotification({
        userId: plan.post.author_id,
        type: 'recurring_route_advanced',
        title: 'Recurring route rescheduled',
        body: `Your recurring route "${plan.post.title}" was moved to ${scheduleLabel}.`,
        data: { postId: plan.post.id, departureAt: plan.nextDepartureAt },
        dedupe: { postId: plan.post.id, reason: 'recurring_advanced', departureAt: plan.nextDepartureAt },
      }));

      const advanceRiderIds = (bookingsByPost.get(plan.post.id) ?? []).map((b) => b.user_id);
      if (advanceRiderIds.length > 0) {
        notifications.push(sendInternalNotification({
          userIds: advanceRiderIds,
          type: 'recurring_route_advanced',
          title: 'Recurring route moved forward',
          body: `"${plan.post.title}" was moved to its next occurrence on ${scheduleLabel}. Please rebook if you still need this ride.`,
          data: { postId: plan.post.id, departureAt: plan.nextDepartureAt },
          dedupe: { postId: plan.post.id, reason: 'recurring_advanced', departureAt: plan.nextDepartureAt },
        }));
      }
    }

    for (const post of recurringKeepalivePosts) {
      notifications.push(sendInternalNotification({
        userId: post.author_id,
        type: 'route_reconfirm_reminder',
        title: 'Still offering this recurring route?',
        body: post.repeat_until
          ? `Confirm to keep "${post.title}" posted through ${post.repeat_until}.`
          : `Confirm to keep "${post.title}" posted as a recurring route.`,
        data: {
          postId: post.id,
          repeatUntil: post.repeat_until,
          reminderWindowDays: RECURRING_CONFIRM_INTERVAL_DAYS,
        },
        dedupe: {
          postId: post.id,
          reminder: 'recurring_keepalive',
          bucket: recurringReminderBucket,
        },
      }));
    }

    await Promise.allSettled(notifications);

    // Expired driver documents cannot be caught by the row trigger once a
    // document simply ages past its date, so sweep them on every cron pass.
    // Requires the service-role client used above so the protected-column
    // guard (enforce_protected_profile_columns) lets the status change through.
    let restrictedExpiredDriverDocs = 0;
    try {
      const { data: restricted, error: restrictError } = await supabase.rpc(
        'enforce_expired_driver_documents',
      );
      if (restrictError) {
        console.error('enforce_expired_driver_documents failed', restrictError.message);
      } else if (typeof restricted === 'number') {
        restrictedExpiredDriverDocs = restricted;
      }
    } catch (error) {
      console.error('enforce_expired_driver_documents request failed', error);
    }

    return jsonResponse({
      expiredPosts: expiredIds.length,
      cancelledPosts: cancelledIds.length,
      advancedRecurringPosts: advancedIds.length,
      recurringKeepalivePosts: recurringKeepalivePosts.length,
      remindedPosts: reminderPostsResult.data?.length ?? 0,
      restrictedExpiredDriverDocs,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Expire failed',
      500,
    );
  }
});
