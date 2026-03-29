import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/icons';
import { Avatar } from '@/components/ui/Avatar';
import { RatingBreakdown } from '@/components/profile';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useGetPublicProfileQuery } from '@/store/api/profilesApi';
import { useGetUserRatingsQuery } from '@/store/api/ratingsApi';
import { formatMonthYear, formatShortDate } from '@/lib/helpers';

export default function UserProfileModal() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const {
    data: profile,
    isLoading: profileLoading,
  } = useGetPublicProfileQuery(userId ?? '', { skip: !userId });

  const {
    data: ratings,
    isLoading: ratingsLoading,
  } = useGetUserRatingsQuery(
    { userId: userId ?? '', limit: 10 },
    { skip: !userId },
  );

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.centered}>
        <Icon name="user" size={48} color={colors.neutral[400]} />
        <Text style={styles.errorText}>User not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const fullName =
    `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'User';
  const memberSince = formatMonthYear(profile.created_at);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Trust Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User identity */}
        <View style={styles.identitySection}>
          <Avatar uri={profile.avatar_url} name={fullName} size="lg" />
          <Text style={styles.name}>{fullName}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {profile.role === 'driver' ? 'Driver' : 'Rider'}
            </Text>
          </View>
          <Text style={styles.memberSince}>Member since {memberSince}</Text>
        </View>

        {/* Trust metrics */}
        <RatingBreakdown
          ratingAvg={profile.rating_avg}
          punctualityPct={profile.punctuality_pct}
          strikesSoft={profile.strikes_soft}
          strikesHard={profile.strikes_hard}
        />

        {/* Recent reviews */}
        <View style={styles.reviewsSection}>
          <Text style={styles.sectionTitle}>Recent Reviews</Text>
          {ratingsLoading ? (
            <ActivityIndicator size="small" color={colors.accent.green} />
          ) : !ratings || ratings.length === 0 ? (
            <Text style={styles.emptyText}>No reviews yet</Text>
          ) : (
            ratings.map((rating) => {
              const reviewerName = rating.rater
                ? `${rating.rater.first_name ?? ''} ${rating.rater.last_name ?? ''}`.trim() ||
                  'User'
                : 'User';
              return (
                <View key={rating.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Avatar
                      uri={rating.rater?.avatar_url ?? null}
                      name={reviewerName}
                      size="sm"
                    />
                    <View style={styles.reviewMeta}>
                      <Text style={styles.reviewerName}>{reviewerName}</Text>
                      <Text style={styles.reviewDate}>
                        {formatShortDate(rating.created_at)}
                      </Text>
                    </View>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Icon
                          key={n}
                          name="star"
                          size={14}
                          color={
                            n <= rating.stars
                              ? colors.accent.green
                              : colors.neutral[300]
                          }
                        />
                      ))}
                    </View>
                  </View>
                  {rating.was_on_time != null && (
                    <View style={styles.onTimeBadge}>
                      <Icon
                        name="clock"
                        size={12}
                        color={rating.was_on_time ? colors.accent.green : colors.error}
                      />
                      <Text
                        style={[
                          styles.onTimeText,
                          { color: rating.was_on_time ? colors.accent.green : colors.error },
                        ]}
                      >
                        {rating.was_on_time ? 'On time' : 'Late'}
                      </Text>
                    </View>
                  )}
                  {rating.comment && (
                    <Text style={styles.reviewComment}>{rating.comment}</Text>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
    gap: spacing.md,
  },
  errorText: {
    ...typography.body1,
    color: colors.neutral[400],
  },
  backLink: {
    ...typography.body1Bold,
    color: colors.accent.green,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
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
  identitySection: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.h2,
    color: colors.forest[900],
  },
  roleBadge: {
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
  memberSince: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  reviewsSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.forest[900],
  },
  emptyText: {
    ...typography.body2,
    color: colors.neutral[400],
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  reviewCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  reviewMeta: {
    flex: 1,
  },
  reviewerName: {
    ...typography.body2Bold,
    color: colors.forest[900],
  },
  reviewDate: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  onTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  onTimeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  reviewComment: {
    ...typography.body2,
    color: colors.forest[500],
    lineHeight: 20,
  },
});
