import React, { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { showAlert, showConfirm } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { ScreenHeader, ScreenLoader, Card, useFloatingTabBarPad } from '@/components/ui';
import { Icon } from '@/components/icons';
import { VerificationStatus, RoleBadge } from '@/components/profile';
import { Avatar } from '@/components/ui/Avatar';
import { colors, type, spacing, borderRadius, shadows, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { useGetMyProfileQuery, useUpdateProfileMutation } from '@/store/api/profilesApi';
import { useGetUserRatingsQuery } from '@/store/api/ratingsApi';
import { useAuth } from '@/hooks/useAuth';
import { useSOS } from '@/hooks/useSOS';
import { EKYASH_COMING_SOON_MESSAGE, ENABLE_EKYASH, MAX_UPLOAD_SIZE } from '@/lib/constants';
import { formatShortDate } from '@/lib/helpers';
import { uploadProfileAvatar } from '@/lib/avatar';
import type { RootState } from '@/store';
import Constants from 'expo-constants';
import type { AccountStatus } from '@/types/database';
import { Text } from '@/components/ui/Text';

export default function ProfileScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const tabBarPad = useFloatingTabBarPad();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { signOut } = useAuth();
  const { triggerSOS } = useSOS();
  const [updateProfile] = useUpdateProfileMutation();
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const {
    data: profile,
    isLoading,
  } = useGetMyProfileQuery(userId ?? '', { skip: !userId });

  const { data: recentReviews } = useGetUserRatingsQuery(
    { userId: userId ?? '', limit: 5 },
    { skip: !userId },
  );

  const handleSignOut = async () => {
    const confirmed = await showConfirm('Sign Out', 'Are you sure you want to sign out?');
    if (confirmed) signOut();
  };

  const handleAvatarUpload = useCallback(async () => {
    if (!userId) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Photo library access is required to upload a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_UPLOAD_SIZE) {
      showAlert('File too large', 'Profile pictures must be under 5 MB.');
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const avatarUrl = await uploadProfileAvatar({
        userId,
        uri: asset.uri,
        mimeType: asset.mimeType,
      });

      await updateProfile({
        id: userId,
        updates: { avatar_url: avatarUrl },
      }).unwrap();

      showAlert('Profile Photo Updated', 'Your profile picture has been updated.');
    } catch (error) {
      showAlert(
        'Upload Failed',
        error instanceof Error ? error.message : 'Could not upload your profile picture.',
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [updateProfile, userId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <ScreenLoader />
      </SafeAreaView>
    );
  }

  const fullName = profile
    ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
    : 'User';

  const hasRecentReviews = (recentReviews?.length ?? 0) > 0;
  const visibleReviews = showAllReviews
    ? (recentReviews ?? [])
    : (recentReviews ?? []).slice(0, 3);
  const recentReviewItems = visibleReviews.map((review) => {
    const isAnon = (review as any).is_anonymous;
    const raterName = isAnon
      ? 'Anonymous'
      : review.rater
        ? `${review.rater.first_name ?? ''} ${review.rater.last_name ?? ''}`.trim() || 'User'
        : 'User';

    return (
      <View key={review.id} style={styles.reviewItem}>
        <View style={styles.reviewHeader}>
          <Avatar
            uri={isAnon ? null : review.rater?.avatar_url}
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
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </ScreenHeader>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPad }]}>
        {/* Profile card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarColumn}>
            <Pressable
              style={styles.avatarButton}
              onPress={handleAvatarUpload}
              disabled={isUploadingAvatar}
            >
              <Avatar
                uri={profile?.avatar_url}
                name={fullName}
                size="lg"
              />
              <View style={styles.avatarBadge}>
                <Icon name="plus-circle" size={18} color={colors.accent.green} />
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>
              {isUploadingAvatar ? 'Uploading...' : profile?.avatar_url ? 'Change Photo' : 'Add Photo'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{fullName || 'Set your name'}</Text>
            <View style={styles.badgesRow}>
              <RoleBadge role={profile?.role} />
              {profile?.account_status && (
                <VerificationStatus status={profile.account_status} />
              )}
            </View>
            {profile?.account_status && profile.account_status !== 'active' && (
              <Text style={styles.statusHint}>{getStatusHint(profile.account_status)}</Text>
            )}
          </View>
        </Card>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <View style={styles.statIconRow}>
              <Icon name="star" size={20} color={colors.accent.green} />
              <Text style={styles.statValue}>
                {(profile?.rating_avg ?? 0).toFixed(1)}
              </Text>
            </View>
            <Text style={styles.statLabel}>Rating</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <View style={styles.statIconRow}>
              <Icon name="clock" size={20} color={c.textMuted} />
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
        {hasRecentReviews && (
          <View style={styles.reviewsSection}>
            <Text style={styles.reviewsSectionTitle}>Recent Reviews</Text>
            {recentReviewItems}
            {(recentReviews?.length ?? 0) > 3 && (
              <Pressable
                onPress={() => setShowAllReviews((prev) => !prev)}
                style={styles.showAllBtn}
              >
                <Text style={styles.showAllText}>
                  {showAllReviews ? 'Show less' : `Show all (${recentReviews!.length})`}
                </Text>
                <Icon
                  name={showAllReviews ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.accent.green}
                />
              </Pressable>
            )}
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
            icon="bell"
            label="Notification Settings"
            onPress={() => router.push('/(tabs)/profile/notifications')}
          />
          <MenuItem
            icon="clipboard-list"
            label="My Documents"
            onPress={() => router.push('/(tabs)/profile/documents')}
          />
          <MenuItem
            icon="receipt"
            label="E-Kyash Wallet"
            badge="Coming Soon"
            onPress={() => {
              if (!ENABLE_EKYASH) {
                showAlert('Coming Soon', EKYASH_COMING_SOON_MESSAGE);
                return;
              }
              router.push('/(tabs)/profile/wallet');
            }}
          />
          <MenuItem
            icon="fuel"
            label="My Fuel Reports"
            onPress={() => router.push('/(tabs)/profile/reports')}
          />
          <MenuItem
            icon="compass"
            label="Offline Maps"
            onPress={() => router.push('/modals/download-map')}
          />
          <MenuItem
            icon="phone"
            label="Emergency Contact Email"
            subtitle={profile?.emergency_contact ?? 'Not set'}
            onPress={async () => {
              if (!profile?.emergency_contact) {
                router.push('/(tabs)/profile/settings');
                return;
              }
              const confirmed = await showConfirm(
                'Emergency SOS',
                'This will send your GPS location to your emergency contact by email. Continue?',
              );
              if (confirmed) triggerSOS();
            }}
          />
        </View>

        {/* Legal */}
        <View style={styles.menuSection}>
          <MenuItem
            icon="clipboard-list"
            label="Privacy Policy"
            onPress={() => Linking.openURL('https://kanek.bz/privacy')}
          />
          <MenuItem
            icon="clipboard-list"
            label="Terms of Service"
            onPress={() => Linking.openURL('https://kanek.bz/terms')}
          />
        </View>

        {/* Sign out */}
        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <Text style={styles.version}>Kanek v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function getStatusHint(status: AccountStatus) {
  switch (status) {
    case 'pending':
      return 'Verification is still in review.';
    case 'restricted':
      return 'Your account is temporarily restricted while recent reports are reviewed.';
    case 'suspended':
      return 'Your account is suspended pending admin review.';
    case 'dormant':
      return 'Your account is inactive until you use kanek again.';
    default:
      return null;
  }
}

function MenuItem({
  icon,
  label,
  subtitle,
  badge,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  subtitle?: string;
  badge?: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const styles = createStyles(c);
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <Icon name={icon} size={20} color={c.textMuted} />
      <View style={styles.menuItemContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={styles.menuLabel}>{label}</Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Icon name="chevron-right" size={16} color={c.textMuted} />
    </Pressable>
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...type.h2.bold,
    color: c.text,
  },
  scrollContent: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  avatarColumn: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  avatarButton: {
    position: 'relative',
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  avatarHint: {
    ...type.caption.regular,
    color: colors.accent.green,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    ...type.h3.bold,
    color: c.text,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusHint: {
    ...type.caption.regular,
    color: c.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: 8,
    paddingVertical: spacing.lg,
    ...shadows.sm,
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
    ...type.h3.bold,
    color: c.text,
  },
  statLabel: {
    ...type.caption.regular,
    color: c.textMuted,
  },
  statDivider: {
    width: 1,
    backgroundColor: c.border,
  },
  reviewsSection: {
    backgroundColor: c.surface,
    borderRadius: 8,
    padding: spacing.lg,
    ...shadows.sm,
  },
  reviewsSectionTitle: {
    ...type.body.bold,
    color: c.text,
    marginBottom: spacing.md,
  },
  reviewItem: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
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
    ...type.bodySm.regular,
    color: c.text,
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
    ...type.caption.regular,
    color: colors.accent.green,
  },
  reviewDate: {
    ...type.caption.regular,
    color: c.textMuted,
  },
  reviewComment: {
    ...type.bodySm.regular,
    color: c.textMuted,
    marginTop: spacing.xs,
    marginLeft: 40 + spacing.sm,
  },
  showAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  showAllText: {
    ...type.bodySm.bold,
    color: colors.accent.green,
  },
  menuSection: {
    backgroundColor: c.surface,
    borderRadius: 8,
    overflow: 'hidden',
    ...shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  menuItemContent: {
    flex: 1,
  },
  menuLabel: {
    ...type.body.regular,
    color: c.text,
  },
  menuSubtitle: {
    ...type.caption.regular,
    color: c.textMuted,
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.accent.green + '1A',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.accent.green + '40',
  },
  badgeText: {
    ...type.caption.regular,
    color: colors.accent.green,
    fontFamily: 'Manrope_700Bold',
    fontSize: 10,
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  signOutText: {
    ...type.body.bold,
    color: colors.error,
  },
  version: {
    ...type.caption.regular,
    color: c.textMuted,
    textAlign: 'center',
  },
});
