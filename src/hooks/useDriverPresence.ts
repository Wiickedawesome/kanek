import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Location from 'expo-location';
import { useSelector } from 'react-redux';
import { supabase } from '@/lib/supabase';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';
import type { RootState } from '@/store';

/** How often a fresh position (or last_active_at refresh) is persisted. */
const PRESENCE_WRITE_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
/** Minimum distance moved before we bother writing a new position. */
const MIN_WRITE_DISTANCE_M = 50;
/** Web builds have flaky geolocation + auth-persistence quirks; skip there. */
const PRESENCE_ENABLED_PLATFORM = Platform.OS !== 'web';

/**
 * Global driver-presence hook.
 *
 * While the user is signed in with role 'driver' and the app is in the
 * foreground, persists a low-granularity snapshot of their position to
 * `profiles.last_lat / last_lng` and refreshes `last_active_at` on a
 * throttle. These power (a) "N drivers active nearby" readouts, (b) radius
 * targeting for ASAP request notifications, and (c) driver ranking.
 *
 * Deliberately NOT high-accuracy and NOT real-time — this is a presence
 * snapshot, not trip tracking (that lives in useDriverTracking).
 */
export function useDriverPresence() {
  const userId = useSelector((s: RootState) => s.auth.user?.id);
  const { data: profile } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const role = profile?.role;
  const isDriver = role === 'driver';

  useEffect(() => {
    if (!userId || !isDriver || !PRESENCE_ENABLED_PLATFORM) return;

    let cancelled = false;
    let lastWritten: { lat: number; lng: number } | null = null;
    let lastWriteAt = 0;

    const writePresence = async (lat: number, lng: number, force: boolean) => {
      const now = Date.now();
      if (cancelled) return;
      if (!force && now - lastWriteAt < PRESENCE_WRITE_INTERVAL_MS) return;

      // Refreshes last_active_at on every interval even if stationary,
      // but only rewrites coords when meaningfully moved (or forced).
      const shouldWriteCoords =
        force ||
        !lastWritten ||
        distanceMeters(lastWritten, { lat, lng }) > MIN_WRITE_DISTANCE_M;

      const updates: Record<string, unknown> = { last_active_at: new Date().toISOString() };
      if (shouldWriteCoords) {
        updates.last_lat = lat;
        updates.last_lng = lng;
      }

      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
      if (!error && !cancelled) {
        lastWriteAt = now;
        if (shouldWriteCoords) lastWritten = { lat, lng };
      }
    };

    let subscription: Location.LocationSubscription | null = null;

    const startPresence = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED || cancelled) return;

      // Low accuracy, large distance filter — presence, not navigation.
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 60_000,
          distanceInterval: 50,
        },
        (loc) => {
          void writePresence(loc.coords.latitude, loc.coords.longitude, false);
        },
      );

      // Immediately write once on start so "active now" is truthful.
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        await writePresence(last.coords.latitude, last.coords.longitude, true);
      }
    };

    const stopPresence = () => {
      subscription?.remove();
      subscription = null;
    };

    void startPresence();

    // Pause writes when backgrounded (permission + battery cost), no watcher kill so we resume cleanly.
    const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void startPresence();
      } else {
        stopPresence();
      }
    });

    return () => {
      cancelled = true;
      stopPresence();
      appStateSub.remove();
    };
  }, [userId, isDriver]);
}

/** Haversine distance in metres. */
function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
