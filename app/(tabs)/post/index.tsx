import React from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import type { IconName } from '@/components/icons';
import { ScreenHeader, useFloatingTabBarPad } from '@/components/ui';
import { colors, type, spacing, borderRadius, shadows, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import type { RootState } from '@/store';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';
import { showAlert } from '@/lib/alert';
import { Text } from '@/components/ui/Text';

interface PostTypeOption {
  type: string;
  label: string;
  description: string;
  icon: IconName;
  color: string;
  /** Optional override used in dark mode when `color` is too dark on the
   *  elevated dark surface. */
  darkColor?: string;
  bgColor: string;
  route: '/(tabs)/post/route' | '/(tabs)/post/errand' | '/(tabs)/post/package' | '/(tabs)/post/job';
  driverOnly?: boolean;
}

const POST_OPTIONS: PostTypeOption[] = [
  {
    type: 'route_offer',
    label: 'Offer a Route',
    description: 'Share your trip and earn per seat',
    icon: 'navigation',
    color: colors.forest[700],
    darkColor: colors.accent.green,
    bgColor: colors.neutral[100],
    route: '/(tabs)/post/route',
    driverOnly: true,
  },
  {
    type: 'route_request',
    label: 'Request a Ride',
    description: 'Find or request a ride somewhere',
    icon: 'compass',
    color: colors.accent.blue,
    bgColor: '#e3f2fd',
    route: '/(tabs)/post/route',
  },
  {
    type: 'errand',
    label: 'Post an Errand',
    description: 'Need something picked up or done?',
    icon: 'package',
    color: '#a14a00',
    darkColor: '#ffb074',
    bgColor: '#ffe0b2',
    route: '/(tabs)/post/errand',
  },
  {
    type: 'package',
    label: 'Send a Package',
    description: 'Ship something with a traveler',
    icon: 'package',
    color: '#9c27b0',
    bgColor: '#f3e5f5',
    route: '/(tabs)/post/package',
  },
  {
    type: 'job',
    label: 'Post a Job',
    description: 'Hire someone for a task',
    icon: 'clipboard-list',
    color: '#5c4400',
    darkColor: colors.accent.yellow,
    bgColor: '#fff59d',
    route: '/(tabs)/post/job',
  },
];

export default function PostScreen() {
  const { c, isDark } = useTheme();
  const styles = createStyles(c);
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: profile } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const role = profile?.role;
  const isAccountActive = profile?.account_status === 'active';
  const tabBarPad = useFloatingTabBarPad();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader style={styles.header}>
        <Text style={styles.title}>New Post</Text>
        <Text style={styles.subtitle}>What do you need?</Text>
      </ScreenHeader>
      {!isAccountActive && !!profile && (
        <View style={styles.pendingBanner}>
          <Icon name="alert-triangle" size={18} color={colors.warning} />
          <Text style={styles.pendingBannerText}>
            Your account is pending approval. You can browse posts, but you cannot create new posts until your documents are reviewed.
          </Text>
        </View>
      )}
      <ScrollView style={styles.content} contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPad }]}>
        {POST_OPTIONS.map((option) => {
          // Hide driver-only options for non-drivers
          if (option.driverOnly && role !== 'driver') return null;

          return (
            <Pressable
              key={option.type}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => {
                if (!isAccountActive) {
                  showAlert(
                    'Account Pending',
                    'Your account is still being reviewed. You cannot create posts until your documents are approved.',
                  );
                  return;
                }
                router.push({
                  pathname: option.route,
                  params: { type: option.type },
                });
              }}
            >
              <View style={[styles.iconContainer, { backgroundColor: isDark ? c.surfaceElevated : option.bgColor }]}>
                <Icon name={option.icon} size={28} color={isDark ? (option.darkColor ?? option.color) : option.color} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{option.label}</Text>
                <Text style={styles.cardDesc}>{option.description}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={c.textMuted} />
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...type.h2.bold,
    color: c.text,
  },
  subtitle: {
    ...type.bodySm.regular,
    color: c.textMuted,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 193, 7, 0.18)',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.40)',
  },
  pendingBannerText: {
    ...type.bodySm.regular,
    color: c.text,
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 8,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
    ...shadows.sm,
  },
  cardPressed: {
    backgroundColor: c.surface,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  cardTitle: {
    ...type.body.bold,
    color: c.text,
  },
  cardDesc: {
    ...type.bodySm.regular,
    color: c.textMuted,
    marginTop: 2,
  },
});
