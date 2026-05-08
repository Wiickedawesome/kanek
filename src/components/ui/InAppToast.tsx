import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { Icon } from '@/components/icons';
import { colors, type, spacing, borderRadius, shadows, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { navigateToNotification } from '@/lib/helpers';
import { hapticLight } from '@/lib/haptics';
import type { AppDispatch } from '@/store';
import { dismissToast, selectCurrentToast } from '@/store/slices/toastSlice';
import type { IconName } from '@/components/icons';
import { Text } from '@/components/ui/Text';

const NOTIFICATION_ICON_MAP: Record<string, IconName> = {
  payment_sent: 'receipt',
  payment_received: 'receipt',
  booking_confirmed: 'clipboard-list',
  booking_cancelled: 'clipboard-list',
  contract_completed: 'star',
  new_booking: 'user',
  new_message: 'send',
  post_cancelled: 'alert-triangle',
  errand_accepted: 'package',
  job_application: 'clipboard-list',
  job_accepted: 'clipboard-list',
  job_match_confirmed: 'clipboard-list',
  route_activated: 'navigation',
  sos_sent: 'shield-alert',
  driver_verified: 'user',
  driver_verification_rejected: 'alert-triangle',
  rider_verified: 'user',
  rider_document_rejected: 'alert-triangle',
  account_suspended: 'shield-alert',
  account_reactivated: 'circle-dot',
  post_removed: 'alert-triangle',
  strike_received: 'alert-triangle',
  strike_issued: 'alert-triangle',
  seat_booked: 'user',
};

export function InAppToast() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const toast = useSelector(selectCurrentToast);
  const translateY = useSharedValue(-120);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const clearToast = useCallback(() => {
    dispatch(dismissToast());
  }, [dispatch]);

  const hideToast = useCallback(() => {
    translateY.value = withTiming(-120, { duration: 250 }, (finished) => {
      if (finished) runOnJS(clearToast)();
    });
  }, [translateY, clearToast]);

  const handleTap = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Animate out then navigate
    translateY.value = withTiming(-120, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(clearToast)();
        runOnJS(navigateToNotification)(
          toast?.notificationType,
          toast?.data ?? null,
        );
      }
    });
  }, [translateY, clearToast, toast]);

  const handleDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    hideToast();
  }, [hideToast]);

  useEffect(() => {
    if (toast) {
      hapticLight();
      translateY.value = withSpring(0, { damping: 14, stiffness: 120 });

      timerRef.current = setTimeout(() => {
        hideToast();
      }, 4000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast, hideToast, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!toast) return null;

  const iconName: IconName =
    (toast.notificationType && NOTIFICATION_ICON_MAP[toast.notificationType]) || 'bell';

  return (
    <ReAnimated.View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.xs },
        animatedStyle,
      ]}
    >
      <Pressable style={styles.content} onPress={handleTap}>
        <View style={styles.iconCircle}>
          <Icon name={iconName} size={18} color={colors.neutral[0]} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
          {toast.body ? (
            <Text style={styles.body} numberOfLines={2}>{toast.body}</Text>
          ) : null}
        </View>
        <Pressable onPress={handleDismiss} hitSlop={8}>
          <Icon name="x" size={16} color={c.textMuted} />
        </Pressable>
      </Pressable>
    </ReAnimated.View>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent.green,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.forest[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.body.bold,
    color: c.text,
  },
  body: {
    ...type.bodySm.regular,
    color: c.textMuted,
  },
});
