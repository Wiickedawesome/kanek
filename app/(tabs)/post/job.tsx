import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { TextInput, Button, ScreenHeader } from '@/components/ui';
import { LocationInput } from '@/components/forms';
import type { LocationCoords } from '@/components/forms';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useCreatePostMutation } from '@/store/api/postsApi';
import { MAX_PRICE_CENTS, MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from '@/lib/constants';
import { sanitizeDecimal, safeGoBack } from '@/lib/helpers';
import type { RootState } from '@/store';
import { showAlert } from '@/lib/alert';
import { showToast } from '@/store/slices/toastSlice';
import type { JobCategory, PayType, JobTimeline, PaymentMethod } from '@/types/database';

const safeBack = () => safeGoBack('/(tabs)/post/');

const JOB_CATEGORIES: { value: JobCategory; label: string }[] = [
  { value: 'skilled_trade', label: 'Skilled Trade' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'handyman', label: 'Handyman' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'moving', label: 'Moving' },
  { value: 'tutoring', label: 'Tutoring' },
  { value: 'tech', label: 'Tech' },
  { value: 'other', label: 'Other' },
];

const PAY_TYPES: { value: PayType; label: string }[] = [
  { value: 'hourly', label: 'Per Hour' },
  { value: 'fixed', label: 'Fixed Price' },
];

const TIMELINES: { value: JobTimeline; label: string }[] = [
  { value: 'asap', label: 'ASAP' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'flexible', label: 'Flexible' },
];

export default function JobFormScreen() {
  const dispatch = useDispatch();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [createPost, { isLoading }] = useCreatePostMutation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<JobCategory | null>(null);
  const [originAddress, setOriginAddress] = useState('');
  const [originCoords, setOriginCoords] = useState<LocationCoords | null>(null);
  const [payRateDollars, setPayRateDollars] = useState('');
  const [payType, setPayType] = useState<PayType>('fixed');
  const [timeline, setTimeline] = useState<JobTimeline>('flexible');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Title is required';
    else if (title.trim().length > MAX_TITLE_LENGTH) newErrors.title = `Max ${MAX_TITLE_LENGTH} characters`;
    if (!description.trim()) newErrors.description = 'Description is required';
    if (!category) newErrors.category = 'Pick a category';

    const rateNum = parseFloat(payRateDollars);
    if (!payRateDollars.trim()) {
      newErrors.payRateDollars = 'Pay is required';
    } else if (isNaN(rateNum) || rateNum <= 0) {
      newErrors.payRateDollars = 'Enter a valid amount';
    } else if (Math.round(rateNum * 100) > MAX_PRICE_CENTS) {
      newErrors.payRateDollars = 'Max $9,999 BZD';
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      newErrors.description = `Max ${MAX_DESCRIPTION_LENGTH} characters`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, description, category, payRateDollars]);

  const handleSubmit = async () => {
    if (!validate() || !userId || !category) return;

    const payRateCents = Math.round(parseFloat(payRateDollars) * 100);

    try {
      await createPost({
        author_id: userId,
        type: 'job',
        title: title.trim(),
        description: description.trim(),
        origin_address: originAddress.trim() || null,
        origin_lat: originCoords?.lat ?? null,
        origin_lng: originCoords?.lng ?? null,
        job_category: category,
        pay_rate_cents: payRateCents,
        pay_type: payType,
        job_timeline: timeline,
        payment_method: paymentMethod,
      }).unwrap();

      dispatch(showToast({ title: 'Post created successfully!' }));
      safeBack();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      showAlert('Error', message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader style={styles.header}>
        <Pressable onPress={safeBack} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Post a Job</Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            label="Job title"
            placeholder="e.g. Help moving furniture"
            value={title}
            onChangeText={setTitle}
            error={errors.title}
            maxLength={100}
          />

          {/* Category */}
          <View>
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.chipRow}>
              {JOB_CATEGORIES.map((c) => (
                <Pressable
                  key={c.value}
                  style={[
                    styles.chip,
                    category === c.value && styles.chipSelected,
                  ]}
                  onPress={() => setCategory(c.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      category === c.value && styles.chipTextSelected,
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errors.category && (
              <Text style={styles.errorText}>{errors.category}</Text>
            )}
          </View>

          <LocationInput
            label="Location (optional)"
            placeholder="Where is the job?"
            value={originAddress}
            onChangeText={setOriginAddress}
            onLocationSelect={setOriginCoords}
          />

          {/* Pay type */}
          <View>
            <Text style={styles.fieldLabel}>Pay type</Text>
            <View style={styles.chipRow}>
              {PAY_TYPES.map((p) => (
                <Pressable
                  key={p.value}
                  style={[
                    styles.chip,
                    payType === p.value && styles.chipSelected,
                  ]}
                  onPress={() => setPayType(p.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      payType === p.value && styles.chipTextSelected,
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <TextInput
            label={payType === 'hourly' ? 'Rate per hour (BZD)' : 'Fixed pay (BZD)'}
            placeholder="0.00"
            value={payRateDollars}
            onChangeText={(t) => setPayRateDollars(sanitizeDecimal(t))}
            keyboardType="decimal-pad"
            inputMode="decimal"
            error={errors.payRateDollars}
          />

          {/* Settlement method */}
          <View>
            <Text style={styles.fieldLabel}>Settlement</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, paymentMethod === 'cash' && styles.chipSelected]}
                onPress={() => setPaymentMethod('cash')}
              >
                <Text style={[styles.chipText, paymentMethod === 'cash' && styles.chipTextSelected]}>Cash</Text>
              </Pressable>
              <Pressable
                style={[styles.chip, paymentMethod === 'ekyash' && styles.chipSelected]}
                onPress={() => setPaymentMethod('ekyash')}
              >
                <Text style={[styles.chipText, paymentMethod === 'ekyash' && styles.chipTextSelected]}>E-Kyash</Text>
              </Pressable>
            </View>
          </View>

          {/* Timeline */}
          <View>
            <Text style={styles.fieldLabel}>Timeline</Text>
            <View style={styles.chipRow}>
              {TIMELINES.map((t) => (
                <Pressable
                  key={t.value}
                  style={[
                    styles.chip,
                    timeline === t.value && styles.chipSelected,
                  ]}
                  onPress={() => setTimeline(t.value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      timeline === t.value && styles.chipTextSelected,
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <TextInput
            label="Description"
            placeholder="Describe exactly where you'll be and what the job involves (time, tools, etc.)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            style={styles.textArea}
            error={errors.description}
          />

          <Text style={styles.charCount}>
            {description.length}/{MAX_DESCRIPTION_LENGTH}
          </Text>

          <Button
            title="Post Job"
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading}
            style={styles.submitButton}
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
  formContent: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  fieldLabel: {
    ...typography.body2Bold,
    color: colors.forest[700],
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
  },
  chipSelected: {
    backgroundColor: colors.forest[700],
    borderColor: colors.forest[700],
  },
  chipText: {
    ...typography.body2,
    color: colors.neutral[500],
  },
  chipTextSelected: {
    color: colors.neutral[0],
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.caption,
    color: colors.neutral[400],
    textAlign: 'right',
    marginTop: -spacing.md,
  },
  submitButton: {
    marginTop: spacing.md,
  },
});
