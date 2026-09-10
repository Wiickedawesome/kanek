import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Icon } from '@/components/icons';
import { colors, type, spacing, borderRadius, shadows, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { showAlert } from '@/lib/alert';
import { safeGoBack } from '@/lib/helpers';
import { ScreenHeader, ScreenLoader, useFloatingTabBarPad } from '@/components/ui';
import { Text } from '@/components/ui/Text';
import {
  useGetMyProfileQuery,
  useUpdateProfileMutation,
} from '@/store/api/profilesApi';
import type { RootState } from '@/store';

const STORAGE_KEY = 'kanek_notification_prefs';

interface LocalPrefs {
  pushEnabled: boolean;
  inAppEnabled: boolean;
}

const DEFAULT_LOCAL_PREFS: LocalPrefs = {
  pushEnabled: true,
  inAppEnabled: true,
};

// Per-type notification preferences honored by the notify-user / send-push
// edge functions. Critical types (sos, strike_received, account_suspended,
// payment_*) are intentionally not listed: they always come through.
const NOTIFICATION_PREF_TYPES: { key: string; label: string; description: string }[] = [
  { key: 'new_message', label: 'New chat messages', description: 'Direct messages from a trip partner.' },
  { key: 'booking_request', label: 'Booking requests', description: 'When someone books or applies to your post.' },
  { key: 'booking_accepted', label: 'Booking accepted', description: 'When your booking or application is accepted.' },
  { key: 'booking_rejected', label: 'Booking rejected', description: 'When your application is declined.' },
  { key: 'contract_event', label: 'Trip updates', description: 'Trip status updates from your driver or rider.' },
  { key: 'trip_reminder', label: 'Trip reminders', description: 'Reminders before a scheduled trip.' },
  { key: 'route_activated', label: 'Ride activations', description: 'When a recurring ride hits its rider minimum.' },
  { key: 'recurring_route_advanced', label: 'Recurring route updates', description: 'Next-occurrence updates for recurring rides.' },
  { key: 'post_expired', label: 'Post expirations', description: 'When one of your posts expires.' },
  { key: 'post_cancelled', label: 'Post cancellations', description: 'When a post you booked is cancelled.' },
];

export default function NotificationSettingsScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const tabBarPad = useFloatingTabBarPad();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: profile } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const [updateProfile] = useUpdateProfileMutation();
  const [localPrefs, setLocalPrefs] = useState<LocalPrefs>(DEFAULT_LOCAL_PREFS);
  const [loading, setLoading] = useState(true);
  const [systemPermission, setSystemPermission] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setLocalPrefs({
            pushEnabled: parsed?.pushEnabled ?? true,
            inAppEnabled: parsed?.inAppEnabled ?? true,
          });
        } catch {
          // ignore malformed cached prefs
        }
      }
      const { status } = await Notifications.getPermissionsAsync();
      setSystemPermission(status);
      setLoading(false);
    })();
  }, []);

  const updateLocalPref = useCallback(async (key: keyof LocalPrefs, value: boolean) => {
    const updated = { ...localPrefs, [key]: value };
    setLocalPrefs(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [localPrefs]);

  const serverPrefs = useMemo(
    () => (profile?.notification_preferences ?? {}) as Record<string, unknown>,
    [profile?.notification_preferences],
  );
  const updateTypePref = useCallback(async (key: string, value: boolean) => {
    if (!userId) return;
    const next = { ...serverPrefs, [key]: value };
    try {
      await updateProfile({
        id: userId,
        updates: { notification_preferences: next as Record<string, boolean> },
      }).unwrap();
    } catch {
      showAlert('Error', 'Could not update notification preferences.');
    }
  }, [userId, serverPrefs, updateProfile]);

  const requestPermission = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setSystemPermission(status);
    if (status !== 'granted') {
      showAlert(
        'Permission Required',
        'Please enable notifications in your device settings to receive push notifications.',
      );
    }
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <ScreenLoader />
      </SafeAreaView>
    );
  }

  const showPermissionBanner = systemPermission !== 'granted';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Notification Settings" onBack={() => safeGoBack('/(tabs)/profile/')} />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPad }]}>
        {/* System permission banner */}
        {showPermissionBanner && (
          <Pressable style={styles.permissionBanner} onPress={requestPermission}>
            <Icon name="bell" size={20} color={colors.warning} />
            <View style={styles.permissionText}>
              <Text style={styles.permissionTitle}>Push notifications disabled</Text>
              <Text style={styles.permissionBody}>
                Tap to enable push notifications for this device.
              </Text>
            </View>
            <Icon name="chevron-right" size={16} color={c.textMuted} />
          </Pressable>
        )}

        {/* General toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <ToggleRow
            icon="bell"
            label="Push Notifications"
            description="Receive notifications on your device"
            value={localPrefs.pushEnabled}
            onToggle={(v) => updateLocalPref('pushEnabled', v)}
          />
          <ToggleRow
            icon="bell"
            label="In-App Alerts"
            description="Show banner notifications inside the app"
            value={localPrefs.inAppEnabled}
            onToggle={(v) => updateLocalPref('inAppEnabled', v)}
          />
        </View>

        {/* Per-type toggles (server-backed) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <Text style={styles.sectionHint}>
            Critical alerts (SOS, account, payments) always come through.
          </Text>
          {NOTIFICATION_PREF_TYPES.map((item) => {
            const enabled = serverPrefs[item.key] !== false;
            return (
              <ToggleRow
                key={item.key}
                icon="bell"
                label={item.label}
                description={item.description}
                value={enabled}
                onToggle={(v) => updateTypePref(item.key, v)}
              />
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  onToggle,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  description: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  const { c } = useTheme();
  const styles = createStyles(c);
  return (
    <View style={styles.toggleRow}>
      <Icon name={icon} size={20} color={c.textMuted} />
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.neutral[300], true: colors.accent.green }}
        thumbColor={Platform.OS === 'android' ? colors.neutral[0] : undefined}
      />
    </View>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...type.h3.bold,
    color: c.text,
  },
  scrollContent: {
    padding: spacing.xl,
    gap: spacing.xl,
    paddingBottom: spacing.lg,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.18)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.40)',
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    ...type.body.bold,
    color: c.text,
  },
  permissionBody: {
    ...type.caption.regular,
    color: c.textMuted,
  },
  section: {
    backgroundColor: c.surface,
    borderRadius: 8,
    overflow: 'hidden',
    ...shadows.sm,
  },
  sectionTitle: {
    ...type.body.bold,
    color: c.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionHint: {
    ...type.caption.regular,
    color: c.textMuted,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  toggleInfo: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    ...type.body.regular,
    color: c.text,
  },
  toggleDesc: {
    ...type.caption.regular,
    color: c.textMuted,
  },
});
