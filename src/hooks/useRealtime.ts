import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from '@/lib/supabase';
import { addNotification, setNotifications } from '@/store/slices/notificationsSlice';
import { reportsApi } from '@/store/api/reportsApi';
import type { AppDispatch, RootState } from '@/store';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

  // Fetch initial notifications on mount
  useEffect(() => {
    if (!userId) return;

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) dispatch(setNotifications(data));
      });
  }, [userId, dispatch]);

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
          dispatch(addNotification(payload.new as any));
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

  /** Subscribe to new road reports — invalidates RTK Query cache on INSERT */
  const subscribeToRoadReports = useCallback(() => {
    const channel = supabase
      .channel('road-reports')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'road_reports',
        },
        () => {
          dispatch(reportsApi.util.invalidateTags([{ type: 'RoadReport', id: 'LIST' }]));
        },
      )
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
    subscribeToRoadReports,
  };
}
