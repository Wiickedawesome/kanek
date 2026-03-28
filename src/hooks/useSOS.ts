import { useCallback, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import { useSelector } from 'react-redux';
import { supabase } from '@/lib/supabase';
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
  const emergencyContact = useSelector(
    (s: RootState) => s.auth.user?.user_metadata?.emergency_contact as string | undefined,
  );

  const triggerSOS = useCallback(async () => {
    if (!userId) {
      Alert.alert('Error', 'You must be signed in to use SOS.');
      return;
    }

    if (cooldownRef.current) {
      Alert.alert('SOS Already Sent', 'Please wait before sending another SOS.');
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
      // Call edge function to send emergency SMS
      const { error } = await supabase.functions.invoke('send-sms-sos', {
        body: {
          userId,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          emergencyContact: emergencyContact ?? null,
        },
      });

      if (error) {
        Alert.alert('SOS Error', 'Could not send SOS message. Try calling emergency services directly.');
      } else {
        setState({ isSending: false, lastSentAt: Date.now() });
        Alert.alert(
          'SOS Sent',
          'Your emergency contact has been notified with your location.',
          [
            { text: 'OK' },
            {
              text: 'Call 911',
              onPress: () => Linking.openURL('tel:911'),
            },
          ],
        );
      }
    } catch {
      Alert.alert('SOS Error', 'Network error. Try calling emergency services directly.');
    } finally {
      setState((prev) => ({ ...prev, isSending: false }));
      // Reset cooldown
      setTimeout(() => {
        cooldownRef.current = false;
      }, SOS_COOLDOWN_MS);
    }
  }, [userId, emergencyContact]);

  return {
    triggerSOS,
    isSending: state.isSending,
    lastSentAt: state.lastSentAt,
  };
}
