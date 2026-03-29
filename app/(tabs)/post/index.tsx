import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import type { IconName } from '@/components/icons';
import { colors, typography, spacing, borderRadius } from '@/theme';
import type { RootState } from '@/store';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';

interface PostTypeOption {
  type: string;
  label: string;
  description: string;
  icon: IconName;
  route: '/(tabs)/post/route' | '/(tabs)/post/errand' | '/(tabs)/post/package' | '/(tabs)/post/job';
  driverOnly?: boolean;
}

const POST_OPTIONS: PostTypeOption[] = [
  {
    type: 'route_offer',
    label: 'Offer a Route',
    description: 'Share your trip and earn per seat',
    icon: 'navigation',
    route: '/(tabs)/post/route',
    driverOnly: true,
  },
  {
    type: 'route_request',
    label: 'Request a Route',
    description: 'Find or request a ride somewhere',
    icon: 'compass',
    route: '/(tabs)/post/route',
  },
  {
    type: 'errand',
    label: 'Post an Errand',
    description: 'Need something picked up or done?',
    icon: 'package',
    route: '/(tabs)/post/errand',
  },
  {
    type: 'package',
    label: 'Send a Package',
    description: 'Ship something with a traveler',
    icon: 'package',
    route: '/(tabs)/post/package',
  },
  {
    type: 'job',
    label: 'Post a Job',
    description: 'Hire someone for a task',
    icon: 'clipboard-list',
    route: '/(tabs)/post/job',
  },
];

export default function PostScreen() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: profile } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const role = profile?.role;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>New Post</Text>
        <Text style={styles.subtitle}>What do you need?</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {POST_OPTIONS.map((option) => {
          // Hide driver-only options for non-drivers
          if (option.driverOnly && role !== 'driver') return null;

          return (
            <Pressable
              key={option.type}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() =>
                router.push({
                  pathname: option.route,
                  params: { type: option.type },
                })
              }
            >
              <View style={styles.iconContainer}>
                <Icon name={option.icon} size={28} color={colors.accent.green} />
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
    backgroundColor: colors.neutral[50],
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.forest[900],
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
  scrollContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cardPressed: {
    backgroundColor: colors.neutral[100],
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
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
    color: colors.neutral[500],
    marginTop: 2,
  },
});
