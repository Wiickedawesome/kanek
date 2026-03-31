import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { Button, TextInput } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useSubmitRatingMutation, useCheckHasRatedQuery } from '@/store/api/ratingsApi';
import { useGetPublicProfileQuery } from '@/store/api/profilesApi';
import type { RootState } from '@/store';
import { safeGoBack } from '@/lib/helpers';

export default function RateModal() {
  const { contractId, ratedId } = useLocalSearchParams<{
    contractId: string;
    ratedId: string;
  }>();

  const userId = useSelector((state: RootState) => state.auth.user?.id);

  const { data: ratedProfile } = useGetPublicProfileQuery(ratedId ?? '', {
    skip: !ratedId,
  });
  const { data: alreadyRated } = useCheckHasRatedQuery(
    { contractId: contractId ?? '', raterId: userId ?? '' },
    { skip: !contractId || !userId },
  );

  const [submitRating] = useSubmitRatingMutation();
  const [stars, setStars] = useState(0);
  const [wasOnTime, setWasOnTime] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const ratedName = ratedProfile
    ? `${ratedProfile.first_name ?? ''} ${ratedProfile.last_name ?? ''}`.trim() || 'this user'
    : 'this user';

  const handleSubmit = async () => {
    if (stars === 0) {
      showAlert('Rating Required', 'Please select a star rating.');
      return;
    }
    if (!userId || !contractId || !ratedId) return;
    if (alreadyRated) {
      showAlert('Already Rated', 'You have already rated this trip.');
      return;
    }

    setSubmitting(true);
    try {
      await submitRating({
        contractId,
        raterId: userId,
        ratedId,
        stars,
        wasOnTime,
        comment: comment.trim() || null,
      }).unwrap();

      showAlert('Thanks!', 'Your rating has been submitted.');
      router.back();
    } catch {
      showAlert('Error', 'Could not submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadyRated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => safeGoBack('/(tabs)/activity/')} hitSlop={12}>
            <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
          </Pressable>
          <Text style={styles.headerTitle}>Rate Trip</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.alreadyRated}>
          <Icon name="star" size={48} color={colors.accent.green} />
          <Text style={styles.alreadyRatedText}>
            You{"'"}ve already rated this trip
          </Text>
          <Button title="Go Back" variant="outline" onPress={() => safeGoBack('/(tabs)/activity/')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack('/(tabs)/activity/')} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Rate Trip</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.prompt}>
            How was your experience with{' '}
            <Text style={styles.boldText}>{ratedName ?? 'this user'}</Text>?
          </Text>

          {/* Stars */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setStars(n)} hitSlop={8}>
                <Icon
                  name="star"
                  size={40}
                  color={n <= stars ? colors.accent.green : colors.neutral[300]}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.starsLabel}>
            {stars === 0 ? 'Tap to rate' : `${stars}/5`}
          </Text>

          {/* On time? */}
          <Text style={styles.label}>Were they on time?</Text>
          <View style={styles.onTimeRow}>
            <Pressable
              style={[
                styles.onTimeBtn,
                wasOnTime === true && styles.onTimeBtnActive,
              ]}
              onPress={() => setWasOnTime(true)}
            >
              <Text
                style={[
                  styles.onTimeBtnText,
                  wasOnTime === true && styles.onTimeBtnTextActive,
                ]}
              >
                Yes
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.onTimeBtn,
                wasOnTime === false && styles.onTimeBtnNegative,
              ]}
              onPress={() => setWasOnTime(false)}
            >
              <Text
                style={[
                  styles.onTimeBtnText,
                  wasOnTime === false && styles.onTimeBtnTextActive,
                ]}
              >
                No
              </Text>
            </Pressable>
          </View>

          {/* Comment */}
          <TextInput
            label="Comment (optional)"
            value={comment}
            onChangeText={setComment}
            placeholder="Share your experience..."
            multiline
            numberOfLines={3}
            maxLength={300}
          />

          <Button
            title="Submit Rating"
            onPress={handleSubmit}
            loading={submitting}
            disabled={stars === 0}
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  flex: {
    flex: 1,
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
  content: {
    padding: spacing.xl,
    gap: spacing.xl,
    alignItems: 'center',
  },
  prompt: {
    ...typography.body1,
    color: colors.forest[900],
    textAlign: 'center',
    lineHeight: 24,
  },
  boldText: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  starsLabel: {
    ...typography.body2,
    color: colors.neutral[500],
  },
  label: {
    ...typography.body1Bold,
    color: colors.forest[900],
    alignSelf: 'flex-start',
  },
  onTimeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  onTimeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
  },
  onTimeBtnActive: {
    borderColor: colors.accent.green,
    backgroundColor: '#e8f5e9',
  },
  onTimeBtnNegative: {
    borderColor: colors.error,
    backgroundColor: '#ffebee',
  },
  onTimeBtnText: {
    ...typography.body1Bold,
    color: colors.neutral[400],
  },
  onTimeBtnTextActive: {
    color: colors.forest[900],
  },
  alreadyRated: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  alreadyRatedText: {
    ...typography.body1,
    color: colors.neutral[500],
    textAlign: 'center',
  },
});
