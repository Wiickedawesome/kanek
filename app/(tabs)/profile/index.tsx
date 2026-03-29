import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';
import { useGetUserRatingsQuery } from '@/store/api/ratingsApi';
import { useAuth } from '@/hooks/useAuth';
import { formatShortDate } from '@/lib/helpers';
import type { RootState } from '@/store';

export default function ProfileScreen() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { signOut } = useAuth();

  const {
    data: profile,
    isLoading,
  } = useGetMyProfileQuery(userId ?? '', { skip: !userId });

  const { data: recentReviews } = useGetUserRatingsQuery(
    { userId: userId ?? '', limit: 5 },
    { skip: !userId },
  );

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </SafeAreaView>
    );
  }

  const fullName = profile
    ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
    : 'User';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile card */}
        <Card style={styles.profileCard}>
          <Avatar
            uri={profile?.avatar_url}
            name={fullName}
            size="lg"
          />
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{fullName || 'Set your name'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {profile?.role === 'driver' ? 'Driver' : 'Rider'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <View style={styles.statIconRow}>
              <Icon name="star" size={20} color={colors.accent.green} />
              <Text style={styles.statValue}>
                {profile?.rating_avg.toFixed(1) ?? '—'}
              </Text>
            </View>
            <Text style={styles.statLabel}>Rating</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={styles.statIconRow}>
              <Icon name="clock" size={20} color={colors.forest[400]} />
              <Text style={styles.statValue}>
                {profile?.punctuality_pct ?? '—'}%
              </Text>
            </View>
            <Text style={styles.statLabel}>On time</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={styles.statIconRow}>
              <Icon name="shield-alert" size={20} color={
                (profile?.strikes_hard ?? 0) > 0 ? colors.error : colors.neutral[400]
              } />
              <Text style={styles.statValue}>
                {(profile?.strikes_soft ?? 0) + (profile?.strikes_hard ?? 0)}
              </Text>
            </View>
            <Text style={styles.statLabel}>Strikes</Text>
          </View>
        </View>

        {/* Recent reviews */}
        {recentReviews && recentReviews.length > 0 && (
          <View style={styles.reviewsSection}>
            <Text style={styles.reviewsSectionTitle}>Recent Reviews</Text>
            {recentReviews.map((review) => {
              const raterName = review.rater
                ? `${review.rater.first_name ?? ''} ${review.rater.last_name ?? ''}`.trim() || 'User'
                : 'User';
              return (
                <View key={review.id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <Avatar
                      uri={review.rater?.avatar_url}
                      name={raterName}
                      size="sm"
                    />
                    <View style={styles.reviewHeaderInfo}>
                      <Text style={styles.reviewerName}>{raterName}</Text>
                      <View style={styles.reviewStars}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Icon
                            key={i}
                            name="star"
                            size={14}
                            color={i < review.stars ? colors.accent.green : colors.neutral[200]}
                          />
                        ))}
                        {review.was_on_time && (
                          <View style={styles.onTimeBadge}>
                            <Icon name="clock" size={12} color={colors.accent.green} />
                            <Text style={styles.onTimeText}>On time</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={styles.reviewDate}>
                      {formatShortDate(review.created_at)}
                    </Text>
                  </View>
                  {review.comment && (
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Menu items */}
        <View style={styles.menuSection}>
          <MenuItem
            icon="user"
            label="Account Settings"
            onPress={() => router.push('/(tabs)/profile/settings')}
          />
          <MenuItem
            icon="clipboard-list"
            label="My Documents"
            onPress={() => router.push('/(tabs)/profile/documents')}
          />
          <MenuItem
            icon="receipt"
            label="E-Kyash Wallet"
            onPress={() => router.push('/(tabs)/profile/wallet')}
          />
          <MenuItem
            icon="construction"
            label="My Road Reports"
            onPress={() => router.push('/(tabs)/profile/reports')}
          />
          <MenuItem
            icon="phone"
            label="Emergency Contact"
            subtitle={profile?.emergency_contact ?? 'Not set'}
            onPress={() => router.push('/(tabs)/profile/settings')}
          />
        </View>

        {/* Sign out */}
        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <Text style={styles.version}>kanek v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <Icon name={icon} size={20} color={colors.forest[400]} />
      <View style={styles.menuItemContent}>
        <Text style={styles.menuLabel}>{label}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Icon name="chevron-right" size={16} color={colors.neutral[400]} />
    </Pressable>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.forest[900],
  },
  headerTitle: {
    ...typography.h2,
    color: colors.neutral[0],
  },
  scrollContent: {
    padding: spacing.xl,
    gap: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  profileInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...typography.h3,
    color: colors.forest[900],
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.forest[600],
  },
  roleText: {
    ...typography.caption,
    color: colors.neutral[0],
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...typography.h3,
    color: colors.forest[900],
  },
  statLabel: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.neutral[200],
  },
  reviewsSection: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewsSectionTitle: {
    ...typography.body1Bold,
    color: colors.forest[900],
    marginBottom: spacing.md,
  },
  reviewItem: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  reviewerName: {
    ...typography.body2,
    color: colors.forest[900],
    fontWeight: '600',
  },
  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  onTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: spacing.sm,
  },
  onTimeText: {
    ...typography.caption,
    color: colors.accent.green,
  },
  reviewDate: {
    ...typography.caption,
    color: colors.neutral[400],
  },
  reviewComment: {
    ...typography.body2,
    color: colors.neutral[500],
    marginTop: spacing.xs,
    marginLeft: 40 + spacing.sm,
  },
  menuSection: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  menuItemContent: {
    flex: 1,
  },
  menuLabel: {
    ...typography.body1,
    color: colors.forest[900],
  },
  menuSubtitle: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: 2,
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  signOutText: {
    ...typography.body1Bold,
    color: colors.error,
  },
  version: {
    ...typography.caption,
    color: colors.neutral[400],
    textAlign: 'center',
  },
});
