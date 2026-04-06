import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useSelector, useDispatch } from 'react-redux';
import { useRegisterPushTokenMutation } from '@/store/api/notificationsApi';
import { showToast } from '@/store/slices/toastSlice';
import { navigateToNotification } from '@/lib/helpers';
import type { RootState, AppDispatch } from '@/store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // We show our own in-app banner
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

  // Register push token
  const registerPushToken = useCallback(async () => {
    if (!userId || !Device.isDevice || Platform.OS === 'web') return;

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

  // Show in-app toast when a push arrives while foregrounded (native only)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      const data = (content.data ?? {}) as Record<string, unknown>;
      dispatch(
        showToast({
          title: content.title ?? 'New notification',
          body: content.body ?? undefined,
          notificationType: typeof data.type === 'string' ? data.type : undefined,
          data,
        }),
      );
    });

    // Handle tap on OS notification banner (app was backgrounded or notification center)
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      const type = typeof data.type === 'string' ? data.type : undefined;
      navigateToNotification(type, data);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [dispatch]);

  return { registerPushToken };
}
