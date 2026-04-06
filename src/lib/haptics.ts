import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

/** Light tap — buttons, chips, toggles */
export function hapticLight() {
  if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Medium tap — confirmations, card press */
export function hapticMedium() {
  if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Success vibration — booking confirmed, payment success */
export function hapticSuccess() {
  if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Error vibration — failed action, SOS */
export function hapticError() {
  if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/** Selection tick — filter chip toggle, tab switch */
export function hapticSelection() {
  if (isNative) Haptics.selectionAsync();
}

