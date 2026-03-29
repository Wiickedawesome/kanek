import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert that works on both native and web.
 * On web, Alert.alert callbacks don't fire — uses window.alert instead.
 */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

/**
 * Cross-platform confirm dialog.
 * Returns true if confirmed, false if cancelled.
 */
export function showConfirm(title: string, message?: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message ? `${title}\n${message}` : title));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', onPress: () => resolve(true) },
    ]);
  });
}
