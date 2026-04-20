import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureError } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import { addNotification } from '@/store/slices/notificationsSlice';
import { showToast } from '@/store/slices/toastSlice';
import { notificationsApi } from '@/store/api/notificationsApi';
import { postsApi } from '@/store/api/postsApi';
import { bookingsApi } from '@/store/api/bookingsApi';
import { reportsApi } from '@/store/api/reportsApi';
import { messagesApi } from '@/store/api/messagesApi';
import type { AppDispatch, RootState } from '@/store';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const NOTIF_PREFS_KEY = 'kanek_notification_prefs';

/** Map notification type → preference category key */
function getNotifCategory(type: string): string | null {
  if (['new_booking', 'seat_booked', 'booking_cancelled'].includes(type)) return 'bookings';
  if (['errand_accepted'].includes(type)) return 'errands';
  if (['job_application'].includes(type)) return 'jobs';
  if (['route_activated'].includes(type)) return 'routes';
  if (['report_nearby', 'report_update'].includes(type)) return 'reports';
  return null; // system notifications always shown
}

interface DriverLocation {
  userId: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  timestamp: number;
}

/**
 * Subscribe to Supabase realtime channels.
 *
 * Channels (from PLAN.md Section 8):
 * - user:{userId}         → notifications, booking status changes
 * - post:{postId}         → seat count updates, status changes
 * - tracking:{contractId} → driver location every 3s during active trip
 * - road-reports          → new reports near user
 */
export function useRealtime() {
  const dispatch = useDispatch<AppDispatch>();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const channelsRef = useRef<RealtimeChannel[]>([]);

  // Subscribe to user notification channel
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new as Database['public']['Tables']['notifications']['Row'];
          dispatch(addNotification(notif));
          // Show in-app toast if prefs allow it
          const checkPrefsAndToast = async () => {
            try {
              const raw = await AsyncStorage.getItem(NOTIF_PREFS_KEY);
              const prefs = raw ? JSON.parse(raw) : null;
              const inAppEnabled = prefs?.inAppEnabled ?? true;
              if (!inAppEnabled) return;
              const cat = getNotifCategory(notif.type ?? '');
              if (cat && prefs && prefs[cat] === false) return;
              dispatch(showToast({
                title: notif.title ?? 'New notification',
                body: notif.body ?? undefined,
                notificationType: notif.type ?? undefined,
                data: (notif.data as Record<string, unknown>) ?? undefined,
              }));
            } catch (err) {
              captureError(err, { context: 'useRealtime.parseNotificationPrefs' });
              // Fallback to showing toast if we can't read prefs securely
              dispatch(showToast({
                title: notif.title ?? 'New notification',
                body: notif.body ?? undefined,
                notificationType: notif.type ?? undefined,
                data: (notif.data as Record<string, unknown>) ?? undefined,
              }));
            }
          };
          checkPrefsAndToast();
          // Invalidate RTK Query caches so screens refresh
          dispatch(notificationsApi.util.invalidateTags([{ type: 'Notification', id: 'LIST' }]));
          dispatch(postsApi.util.invalidateTags([{ type: 'Post', id: 'MY_LIST' }]));
          dispatch(bookingsApi.util.invalidateTags([{ type: 'Booking', id: 'LIST' }]));
          dispatch(bookingsApi.util.invalidateTags([{ type: 'Contract', id: 'LIST' }]));
        },
      )
      .subscribe();

    channelsRef.current.push(channel);

    return () => {
      supabase.removeChannel(channel);
      channelsRef.current = channelsRef.current.filter((c) => c !== channel);
    };
  }, [userId, dispatch]);

  /** Subscribe to live location updates for an active contract */
  const subscribeToTracking = useCallback(
    (contractId: string, onLocation: (loc: DriverLocation) => void) => {
      const channel = supabase
        .channel(`tracking:${contractId}`)
        .on('broadcast', { event: 'location' }, (payload) => {
          onLocation(payload.payload as DriverLocation);
        })
        .subscribe();

      channelsRef.current.push(channel);

      return () => {
        supabase.removeChannel(channel);
        channelsRef.current = channelsRef.current.filter((c) => c !== channel);
      };
    },
    [],
  );

  /** Broadcast driver location to a tracking channel */
  const broadcastLocation = useCallback(
    (contractId: string, location: Omit<DriverLocation, 'timestamp'>) => {
      supabase.channel(`tracking:${contractId}`).send({
        type: 'broadcast',
        event: 'location',
        payload: { ...location, timestamp: Date.now() },
      });
    },
    [],
  );

  /** Subscribe to post updates (seat changes, status) */
  const subscribeToPost = useCallback(
    (postId: string, onChange: (post: Record<string, unknown>) => void) => {
      const channel = supabase
        .channel(`post:${postId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'posts',
            filter: `id=eq.${postId}`,
          },
          (payload) => {
            onChange(payload.new);
          },
        )
        .subscribe();

      channelsRef.current.push(channel);

      return () => {
        supabase.removeChannel(channel);
        channelsRef.current = channelsRef.current.filter((c) => c !== channel);
      };
    },
    [],
  );

  /** Subscribe to new gas prices — invalidates RTK Query cache on INSERT */
  const subscribeToGasPrices = useCallback(() => {
    const channel = supabase
      .channel('gas-prices')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gas_prices',
        },
        () => {
          dispatch(reportsApi.util.invalidateTags([{ type: 'GasPrice', id: 'LIST' }]));
        },
      )
      .subscribe();

    channelsRef.current.push(channel);

    return () => {
      supabase.removeChannel(channel);
      channelsRef.current = channelsRef.current.filter((c) => c !== channel);
    };
  }, [dispatch]);

  /** Subscribe to booking status changes for the current user */
  const subscribeToBookings = useCallback(() => {
    if (!userId) return () => {};

    const channel = supabase
      .channel(`bookings:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          dispatch(bookingsApi.util.invalidateTags([{ type: 'Booking', id: 'LIST' }]));
        },
      )
      .subscribe();

    channelsRef.current.push(channel);

    return () => {
      supabase.removeChannel(channel);
      channelsRef.current = channelsRef.current.filter((c) => c !== channel);
    };
  }, [userId, dispatch]);

  /** Subscribe to new chat messages for a contract */
  const subscribeToMessages = useCallback(
    (contractId: string) => {
      const channel = supabase
        .channel(`messages:${contractId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'contract_messages',
            filter: `contract_id=eq.${contractId}`,
          },
          () => {
            dispatch(messagesApi.util.invalidateTags([{ type: 'Message', id: contractId }]));
          },
        )
        .subscribe();

      channelsRef.current.push(channel);

      return () => {
        supabase.removeChannel(channel);
        channelsRef.current = channelsRef.current.filter((c) => c !== channel);
      };
    },
    [dispatch],
  );

  // Cleanup all channels on unmount
  useEffect(() => {
    return () => {
      channelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, []);

  return {
    subscribeToTracking,
    broadcastLocation,
    subscribeToPost,
    subscribeToGasPrices,
    subscribeToBookings,
    subscribeToMessages,
  };
}
