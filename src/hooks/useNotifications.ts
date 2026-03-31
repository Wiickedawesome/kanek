import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useSelector } from 'react-redux';
import { useRegisterPushTokenMutation } from '@/store/api/notificationsApi';
import type { RootState } from '@/store';

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
  const [registerToken] = useRegisterPushTokenMutation();

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

  // Register token on mount
  useEffect(() => {
    registerPushToken();
  }, [registerPushToken]);

  return { registerPushToken };
}
