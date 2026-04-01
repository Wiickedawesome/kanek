import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
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
import { colors, typography, spacing, borderRadius } from '@/theme';
import { showAlert } from '@/lib/alert';
import { safeGoBack } from '@/lib/helpers';

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
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </SafeAreaView>
    );
  }

  const showPermissionBanner = systemPermission !== 'granted';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack('/(tabs)/profile/')} hitSlop={8}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
            <Icon name="chevron-right" size={16} color={colors.neutral[400]} />
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
            label="Routes"
            description="Route updates and status changes"
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
  return (
    <View style={styles.toggleRow}>
      <Icon name={icon} size={20} color={colors.forest[400]} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.forest[900],
  },
  headerTitle: {
    ...typography.h3,
    color: colors.neutral[0],
  },
  scrollContent: {
    padding: spacing.xl,
    gap: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8e1',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  permissionBody: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  section: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    ...typography.body1Bold,
    color: colors.forest[900],
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
    borderBottomColor: colors.neutral[100],
  },
  toggleInfo: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    ...typography.body1,
    color: colors.forest[900],
  },
  toggleDesc: {
    ...typography.caption,
    color: colors.neutral[500],
  },
});
