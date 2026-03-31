import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { showAlert } from '@/lib/alert';
import * as Location from 'expo-location';
import { useDispatch, useSelector } from 'react-redux';
import {
  setLocation,
  setTracking,
  setActiveContractId,
} from '@/store/slices/locationSlice';
import { useRealtime } from './useRealtime';
import type { AppDispatch, RootState } from '@/store';

const BROADCAST_INTERVAL_MS = 3_000; // 3 seconds per PLAN.md Section 8

/**
 * Driver-side location tracking hook.
 *
 * When started, watches the device position and broadcasts it
 * to the `tracking:{contractId}` Supabase Realtime channel
 * every 3 seconds. Pauses broadcasting when the app is backgrounded
 * and resumes on foreground (using expo-location foreground watcher).
 */
export function useDriverTracking() {
  const dispatch = useDispatch<AppDispatch>();
  const userId = useSelector((s: RootState) => s.auth.user?.id);
  const isTracking = useSelector((s: RootState) => s.location.isTracking);
  const activeContractId = useSelector(
    (s: RootState) => s.location.activeContractId,
  );
  const { broadcastLocation } = useRealtime();

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestCoordsRef = useRef<{
    latitude: number;
    longitude: number;
    heading: number | null;
    speed: number | null;
  } | null>(null);

  // Broadcast latest coords at the fixed interval
  const startBroadcasting = useCallback(
    (contractId: string) => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        const coords = latestCoordsRef.current;
        if (!coords || !userId) return;
        broadcastLocation(contractId, {
          userId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          heading: coords.heading,
        });
      }, BROADCAST_INTERVAL_MS);
    },
    [broadcastLocation, userId],
  );

  const stopBroadcasting = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Start tracking for a specific contract.
   * Requests foreground permission, begins watching position,
   * and broadcasts at 3s intervals.
   */
  const startTracking = useCallback(
    async (contractId: string) => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        showAlert(
          'Location Required',
          'Location permission is needed to share your position with riders during the trip.',
        );
        return;
      }

      // Start the position watcher
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2_000,
          distanceInterval: 5, // metres
        },
        (loc) => {
          const { latitude, longitude, heading, speed } = loc.coords;
          latestCoordsRef.current = { latitude, longitude, heading, speed };
          dispatch(setLocation({ latitude, longitude }));
        },
      );

      watchRef.current = subscription;
      dispatch(setActiveContractId(contractId));
      dispatch(setTracking(true));
      startBroadcasting(contractId);
    },
    [dispatch, startBroadcasting],
  );

  /** Stop tracking and clean up resources. */
  const stopTracking = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
    stopBroadcasting();
    latestCoordsRef.current = null;
    dispatch(setTracking(false));
    dispatch(setActiveContractId(null));
  }, [dispatch, stopBroadcasting]);

  // Pause/resume broadcasting when app state changes
  useEffect(() => {
    if (!isTracking || !activeContractId) return;

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        startBroadcasting(activeContractId);
      } else {
        stopBroadcasting();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isTracking, activeContractId, startBroadcasting, stopBroadcasting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      watchRef.current?.remove();
      watchRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return { startTracking, stopTracking, isTracking };
}
