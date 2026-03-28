import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useSelector, useDispatch } from 'react-redux';
import { supabase } from '@/lib/supabase';
import { addNotification } from '@/store/slices/notificationsSlice';
import { useRegisterPushTokenMutation } from '@/store/api/notificationsApi';
import type { RootState, AppDispatch } from '@/store';
import type { Database } from '@/types/database';

type NotificationRow = Database['public']['Tables']['notifications']['Row'];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications() {
  const userId = useSelector((s: RootState) => s.auth.user?.id);
  const dispatch = useDispatch<AppDispatch>();
  const [registerToken] = useRegisterPushTokenMutation();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Register push token
  const registerPushToken = useCallback(async () => {
    if (!userId || !Device.isDevice) return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerToken({ userId, token: tokenData.data });

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
  }, [userId, registerToken]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!userId) return;

    channelRef.current = supabase
      .channel(`user-notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as NotificationRow;
          dispatch(addNotification(notification));
        },
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, dispatch]);

  // Register token on mount
  useEffect(() => {
    registerPushToken();
  }, [registerPushToken]);

  return { registerPushToken };
}
