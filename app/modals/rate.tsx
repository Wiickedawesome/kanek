import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { Button, TextInput, ScreenHeader } from '@/components/ui';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { useSubmitRatingMutation, useCheckHasRatedQuery } from '@/store/api/ratingsApi';
import { useGetPublicProfileQuery } from '@/store/api/profilesApi';
import type { RootState } from '@/store';
import { safeGoBack } from '@/lib/helpers';
import { Text } from '@/components/ui/Text';

export default function RateModal() {
  const { c } = useTheme();
  const styles = createStyles(c);
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
  const [isAnonymous, setIsAnonymous] = useState(false);
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
        isAnonymous,
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
        <ScreenHeader style={styles.header}>
          <Pressable
            onPress={() => safeGoBack('/(tabs)/activity/')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon name="chevron-left" size={24} color={c.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Rate Trip</Text>
          <View style={{ width: 24 }} />
        </ScreenHeader>
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
      <ScreenHeader style={styles.header}>
        <Pressable
          onPress={() => safeGoBack('/(tabs)/activity/')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Rate Trip</Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

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

          {/* Anonymous toggle */}
          <View style={styles.anonymousRow}>
            <View style={styles.anonymousInfo}>
              <Text style={styles.anonymousLabel}>Submit anonymously</Text>
              <Text style={styles.anonymousHint}>Your name will be hidden from the review</Text>
            </View>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ false: colors.neutral[200], true: colors.accent.green }}
              thumbColor={colors.neutral[0]}
            />
          </View>

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

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
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
  },
  headerTitle: {
    ...type.h3.bold,
    color: c.text,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.xl,
    alignItems: 'center',
  },
  prompt: {
    ...type.body.regular,
    color: c.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  boldText: {
    ...type.body.bold,
    color: c.text,
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  starsLabel: {
    ...type.bodySm.regular,
    color: c.textMuted,
  },
  label: {
    ...type.body.bold,
    color: c.text,
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
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  onTimeBtnActive: {
    borderColor: colors.accent.green,
    backgroundColor: 'rgba(81, 193, 82, 0.18)',
  },
  onTimeBtnNegative: {
    borderColor: colors.error,
    backgroundColor: 'rgba(211, 47, 47, 0.22)',
  },
  onTimeBtnText: {
    ...type.body.bold,
    color: c.textMuted,
  },
  onTimeBtnTextActive: {
    color: c.text,
  },
  alreadyRated: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  alreadyRatedText: {
    ...type.body.regular,
    color: c.textMuted,
    textAlign: 'center',
  },
  anonymousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  anonymousInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  anonymousLabel: {
    ...type.body.bold,
    color: c.text,
  },
  anonymousHint: {
    ...type.caption.regular,
    color: c.textMuted,
  },
});
