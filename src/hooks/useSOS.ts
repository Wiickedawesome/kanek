import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { showAlert, showConfirm } from '@/lib/alert';
import * as Location from 'expo-location';
import { useSelector } from 'react-redux';
import { invokeFunction } from '@/lib/invokeFunction';
import type { RootState } from '@/store';

interface SOSState {
  isSending: boolean;
  lastSentAt: number | null;
}

const SOS_COOLDOWN_MS = 30_000; // 30s cooldown between SOS triggers

/**
 * Emergency SOS hook — sends GPS coords to emergency contact via edge function
 * and optionally opens the phone dialer to local emergency number.
 */
export function useSOS() {
  const [state, setState] = useState<SOSState>({ isSending: false, lastSentAt: null });
  const cooldownRef = useRef(false);
  const userId = useSelector((s: RootState) => s.auth.user?.id);

  const triggerSOS = useCallback(async () => {
    if (!userId) {
      showAlert('Error', 'You must be signed in to use SOS.');
      return;
    }

    if (cooldownRef.current) {
      showAlert('SOS Already Sent', 'Please wait before sending another SOS.');
      return;
    }

    // Get fresh GPS coordinates
    let coords: { latitude: number; longitude: number } | null = null;
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
      // Fall back to last known location
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        coords = { latitude: last.coords.latitude, longitude: last.coords.longitude };
      }
    }

    setState({ isSending: true, lastSentAt: null });
    cooldownRef.current = true;

    try {
      // Call edge function to send emergency email (userId derived from auth JWT server-side)
      const { data, error } = await invokeFunction<{ sent: boolean; to?: string }>('send-sms-sos', {
        body: {
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
        },
      });

      if (error) {
        showAlert('SOS Error', 'Could not send SOS email. Try calling emergency services directly.');
      } else if (data && !data.sent) {
        setState({ isSending: false, lastSentAt: Date.now() });
        showAlert(
          'SOS Alert Recorded',
          'Your emergency alert was logged but email could not be sent. Please call emergency services directly.',
        );
      } else {
        setState({ isSending: false, lastSentAt: Date.now() });
        showAlert(
          'SOS Sent',
          'Your emergency contact has been notified by email with your location.',
        );
        const callNow = await showConfirm('Call 911?', 'Would you like to call emergency services now?');
        if (callNow) {
          Linking.openURL('tel:911');
        }
      }
    } catch {
      showAlert('SOS Error', 'Network error. Try calling emergency services directly.');
    } finally {
      setState((prev) => ({ ...prev, isSending: false }));
      // Reset cooldown
      setTimeout(() => {
        cooldownRef.current = false;
      }, SOS_COOLDOWN_MS);
    }
  }, [userId]);

  return {
    triggerSOS,
    isSending: state.isSending,
    lastSentAt: state.lastSentAt,
  };
}
