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
import { Button, TextInput, FilterChip } from '@/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { TopographicBg } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { supabase } from '@/lib/supabase';
import type { RootState } from '@/store';
import type { FlagReason } from '@/types/database';
import { safeGoBack } from '@/lib/helpers';

const REASONS: { value: FlagReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'scam', label: 'Scam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'fake_account', label: 'Fake Account' },
  { value: 'safety', label: 'Safety Concern' },
  { value: 'other', label: 'Other' },
];

export default function FlagContentModal() {
  const { targetType, targetId } = useLocalSearchParams<{
    targetType: 'post' | 'user' | 'booking';
    targetId: string;
  }>();

  const userId = useSelector((state: RootState) => state.auth.user?.id);

  const [reason, setReason] = useState<FlagReason | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      showAlert('Reason Required', 'Please select a reason for your report.');
      return;
    }
    if (!userId || !targetType || !targetId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('flags').insert({
        reporter_id: userId,
        target_type: targetType,
        target_id: targetId,
        reason,
        description: description.trim() || null,
      });

      if (error) throw error;

      showAlert(
        'Report Submitted',
        'Thank you. Our team will review this report.',
      );
      router.back();
    } catch {
      showAlert('Error', 'Could not submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TopographicBg />
      <LinearGradient colors={[colors.forest[900], colors.forest[700]]} style={styles.header}>
        <Pressable onPress={() => safeGoBack('/(tabs)/explore/')} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Report Content</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.infoBox}>
            <Icon name="shield-alert" size={20} color={colors.forest[900]} />
            <Text style={styles.infoText}>
              Reports are confidential. Our team reviews each report and takes
              appropriate action.
            </Text>
          </View>

          <Text style={styles.label}>Why are you reporting this?</Text>
          <View style={styles.reasonGrid}>
            {REASONS.map((r) => (
              <FilterChip
                key={r.value}
                label={r.label}
                selected={reason === r.value}
                onPress={() => setReason(r.value)}
              />
            ))}
          </View>

          <TextInput
            label="Additional details (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Provide any extra context..."
            multiline
            numberOfLines={4}
            maxLength={500}
          />

          <Button
            title="Submit Report"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!reason}
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
  },
  headerTitle: {
    ...typography.h3,
    color: colors.neutral[0],
  },
  content: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.neutral[0],
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  infoText: {
    ...typography.body2,
    color: colors.forest[900],
    flex: 1,
    lineHeight: 20,
  },
  label: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
