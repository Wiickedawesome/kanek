import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import type { IconName } from '@/components/icons';
import { ScreenHeader } from '@/components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '@/theme';
import type { RootState } from '@/store';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';
import { showAlert } from '@/lib/alert';

interface PostTypeOption {
  type: string;
  label: string;
  description: string;
  icon: IconName;
  color: string;
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
    color: colors.accent.green,
    bgColor: '#e8f5e9',
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
    color: colors.warning,
    bgColor: '#fff8e1',
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
    color: colors.forest[600],
    bgColor: colors.neutral[100],
    route: '/(tabs)/post/job',
  },
];

export default function PostScreen() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: profile } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const role = profile?.role;
  const isAccountActive = profile?.account_status === 'active';

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
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
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
              <View style={[styles.iconContainer, { backgroundColor: option.bgColor }]}>
                <Icon name={option.icon} size={28} color={option.color} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{option.label}</Text>
                <Text style={styles.cardDesc}>{option.description}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.neutral[400]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[0],
  },
  subtitle: {
    ...typography.body2,
    color: colors.neutral[400],
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff8e1',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#ffe082',
  },
  pendingBannerText: {
    ...typography.body2,
    color: colors.forest[900],
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
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: 8,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(20, 40, 0, 0.12)',
    ...shadows.sm,
  },
  cardPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  cardTitle: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  cardDesc: {
    ...typography.body2,
    color: colors.forest[500],
    marginTop: 2,
  },
});
