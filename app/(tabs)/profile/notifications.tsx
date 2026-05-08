import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Icon } from '@/components/icons';
import { colors, type, spacing, borderRadius, shadows, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { showAlert } from '@/lib/alert';
import { safeGoBack } from '@/lib/helpers';
import { ScreenHeader, useFloatingTabBarPad } from '@/components/ui';
import { Text } from '@/components/ui/Text';

const STORAGE_KEY = 'kanek_notification_prefs';

interface NotificationPrefs {
  pushEnabled: boolean;
  inAppEnabled: boolean;
  bookings: boolean;
  errands: boolean;
  jobs: boolean;
  routes: boolean;
  reports: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  pushEnabled: true,
  inAppEnabled: true,
  bookings: true,
  errands: true,
  jobs: true,
  routes: true,
  reports: true,
};

export default function NotificationSettingsScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const tabBarPad = useFloatingTabBarPad();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [systemPermission, setSystemPermission] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
      }
      const { status } = await Notifications.getPermissionsAsync();
      setSystemPermission(status);
      setLoading(false);
    })();
  }, []);

  const updatePref = useCallback(async (key: keyof NotificationPrefs, value: boolean) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [prefs]);

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
        <ActivityIndicator size="large" color={colors.accent.green} />
      </SafeAreaView>
    );
  }

  const showPermissionBanner = systemPermission !== 'granted';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader style={styles.header}>
        <Pressable
          onPress={() => safeGoBack('/(tabs)/profile/')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

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
            value={prefs.pushEnabled}
            onToggle={(v) => updatePref('pushEnabled', v)}
          />
          <ToggleRow
            icon="bell"
            label="In-App Alerts"
            description="Show banner notifications inside the app"
            value={prefs.inAppEnabled}
            onToggle={(v) => updatePref('inAppEnabled', v)}
          />
        </View>

        {/* Category toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <ToggleRow
            icon="compass"
            label="Bookings & Rides"
            description="Seat bookings, ride confirmations"
            value={prefs.bookings}
            onToggle={(v) => updatePref('bookings', v)}
          />
          <ToggleRow
            icon="package"
            label="Errands & Packages"
            description="Errand accepted, package delivery updates"
            value={prefs.errands}
            onToggle={(v) => updatePref('errands', v)}
          />
          <ToggleRow
            icon="clipboard-list"
            label="Jobs"
            description="Job applications and responses"
            value={prefs.jobs}
            onToggle={(v) => updatePref('jobs', v)}
          />
          <ToggleRow
            icon="map-pin"
            label="Rides"
            description="Ride updates and status changes"
            value={prefs.routes}
            onToggle={(v) => updatePref('routes', v)}
          />
          <ToggleRow
            icon="alert-triangle"
            label="Reports"
            description="Road reports and gas price alerts"
            value={prefs.reports}
            onToggle={(v) => updatePref('reports', v)}
          />
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
