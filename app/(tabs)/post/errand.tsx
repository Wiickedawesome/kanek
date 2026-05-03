import React, { useState, useCallback, useEffect } from 'react';
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
import { LocationInput, DateInput, TimeInput } from '@/components/forms';
import type { LocationCoords } from '@/components/forms';
import { Icon } from '@/components/icons';
import { RouteInfoCard } from '@/components/cards/RouteInfoCard';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useCreatePostMutation } from '@/store/api/postsApi';
import { calculateRoute } from '@/lib/mapbox';
import type { RouteInfo } from '@/lib/mapbox';
import { EKYASH_COMING_SOON_MESSAGE, ENABLE_EKYASH, MAX_PRICE_CENTS, MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from '@/lib/constants';
import { sanitizeDecimal, safeGoBack } from '@/lib/helpers';
import type { RootState } from '@/store';
import { showAlert } from '@/lib/alert';
import { showToast } from '@/store/slices/toastSlice';
import type { ErrandCategory, PaymentMethod } from '@/types/database';

const safeBack = () => safeGoBack('/(tabs)/post/');

const ERRAND_CATEGORIES: { value: ErrandCategory; label: string }[] = [
  { value: 'grocery', label: 'Grocery' },
  { value: 'bill', label: 'Bill Payment' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'document', label: 'Documents' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'food', label: 'Food' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'other', label: 'Other' },
];

export default function ErrandFormScreen() {
  const dispatch = useDispatch();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [createPost, { isLoading }] = useCreatePostMutation();

  const handleSelectEkyash = useCallback(() => {
    showAlert('Coming Soon', EKYASH_COMING_SOON_MESSAGE);
  }, []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ErrandCategory | null>(null);
  const [originAddress, setOriginAddress] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [errandFeeDollars, setErrandFeeDollars] = useState('');
  const [itemCostDollars, setItemCostDollars] = useState('');
  const [needByDate, setNeedByDate] = useState('');
  const [needByTime, setNeedByTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Route calculation state
  const [originCoords, setOriginCoords] = useState<LocationCoords | null>(null);
  const [destCoords, setDestCoords] = useState<LocationCoords | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Auto-calculate route when both coordinates are available
  useEffect(() => {
    if (!originCoords || !destCoords) {
      setRouteInfo(null);
      return;
    }

    let cancelled = false;
    setRouteLoading(true);
    calculateRoute(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng)
      .then((info) => {
        if (!cancelled) setRouteInfo(info);
      })
      .catch(() => {
        if (!cancelled) setRouteInfo(null);
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });

    return () => { cancelled = true; };
  }, [originCoords, destCoords]);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Title is required';
    else if (title.trim().length > MAX_TITLE_LENGTH) newErrors.title = `Max ${MAX_TITLE_LENGTH} characters`;
    if (!category) newErrors.category = 'Pick a category';
    if (!originAddress.trim()) newErrors.originAddress = 'Pickup location is required';

    // Errand fee
    const feeNum = parseFloat(errandFeeDollars);
    if (!errandFeeDollars.trim()) {
      newErrors.errandFeeDollars = 'Errand fee is required';
    } else if (isNaN(feeNum) || feeNum <= 0) {
      newErrors.errandFeeDollars = 'Enter a valid fee';
    } else if (Math.round(feeNum * 100) > MAX_PRICE_CENTS) {
      newErrors.errandFeeDollars = 'Max $9,999 BZD';
    }

    // Item cost (optional but validate if entered)
    if (itemCostDollars.trim()) {
      const itemNum = parseFloat(itemCostDollars);
      if (isNaN(itemNum) || itemNum < 0) {
        newErrors.itemCostDollars = 'Enter a valid amount';
      } else if (Math.round(itemNum * 100) > MAX_PRICE_CENTS) {
        newErrors.itemCostDollars = 'Max $9,999 BZD';
      }
    }

    if (!description.trim()) newErrors.description = 'Description is required';
    else if (description.length > MAX_DESCRIPTION_LENGTH) {
      newErrors.description = `Max ${MAX_DESCRIPTION_LENGTH} characters`;
    }

    // Validate deadline if provided
    if (needByDate.trim() && needByTime.trim()) {
      const dt = new Date(`${needByDate}T${needByTime}`);
      if (isNaN(dt.getTime())) {
        newErrors.needByDate = 'Invalid date';
      } else if (dt <= new Date()) {
        newErrors.needByDate = 'Deadline must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, category, originAddress, errandFeeDollars, itemCostDollars, description, needByDate, needByTime]);

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!userId) {
      showAlert('Error', 'You must be signed in to post');
      return;
    }
    if (!category) {
      showAlert('Error', 'Please select a category');
      return;
    }

    const errandFeeCents = Math.round(parseFloat(errandFeeDollars) * 100);
    const itemCostCents = itemCostDollars.trim()
      ? Math.round(parseFloat(itemCostDollars) * 100)
      : null;

    const departureAt =
      needByDate.trim() && needByTime.trim()
        ? new Date(`${needByDate}T${needByTime}`).toISOString()
        : null;

    try {
      await createPost({
        author_id: userId,
        type: 'errand',
        title: title.trim(),
        description: description.trim(),
        origin_address: originAddress.trim(),
        dest_address: destAddress.trim() || null,
        origin_lat: originCoords?.lat ?? null,
        origin_lng: originCoords?.lng ?? null,
        dest_lat: destCoords?.lat ?? null,
        dest_lng: destCoords?.lng ?? null,
        departure_at: departureAt,
        errand_category: category,
        errand_fee_cents: errandFeeCents,
        item_cost_cents: itemCostCents,
        payment_method: paymentMethod,
        route_geometry: routeInfo?.geometry ?? null,
        route_distance_km: routeInfo?.distance_km ?? null,
        route_duration_min: routeInfo?.duration_minutes ?? null,
        route_fuel_cost_cents: routeInfo?.fuel_cost_cents ?? null,
      }).unwrap();

      dispatch(showToast({ title: 'Post created successfully!' }));
      safeBack();
    } catch (err: unknown) {
      console.error('Post save error:', err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'error' in err
            ? String((err as Record<string, unknown>).error)
            : 'Something went wrong';
      showAlert('Error', message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader style={styles.header}>
        <Pressable onPress={safeBack} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Post an Errand</Text>
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
            label="Title"
            placeholder="e.g. Grocery pickup from Brodies"
            value={title}
            onChangeText={setTitle}
            error={errors.title}
            maxLength={100}
          />

          {/* Category selector */}
          <View>
            <Text style={styles.fieldLabel}>Category</Text>
            {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
            <View style={styles.categoryGrid}>
              {ERRAND_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.value}
                  style={[
                    styles.categoryChip,
                    category === cat.value && styles.categoryChipSelected,
                  ]}
                  onPress={() => setCategory(cat.value)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      category === cat.value && styles.categoryTextSelected,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <LocationInput
            label="Pickup location"
            placeholder="Where to pick up items"
            value={originAddress}
            onChangeText={setOriginAddress}
            onLocationSelect={setOriginCoords}
            error={errors.originAddress}
          />

          <LocationInput
            label="Deliver to (optional)"
            placeholder="Drop-off address"
            value={destAddress}
            onChangeText={setDestAddress}
            onLocationSelect={setDestCoords}
          />

          {/* Route calculation summary */}
          {routeLoading && <RouteInfoCard loading />}
          {routeInfo && !routeLoading && (
            <RouteInfoCard
              distanceKm={routeInfo.distance_km}
              durationMinutes={routeInfo.duration_minutes}
              fuelCostCents={routeInfo.fuel_cost_cents}
            />
          )}

          <View style={styles.row}>
            <DateInput
              label="Need by (date)"
              value={needByDate}
              onChangeText={setNeedByDate}
              error={errors.needByDate}
            />
            <TimeInput
              label="Time"
              value={needByTime}
              onChangeText={setNeedByTime}
            />
          </View>

          <View style={styles.row}>
            <TextInput
              label="Errand fee (BZD)"
              placeholder="0.00"
              value={errandFeeDollars}
              onChangeText={(t) => setErrandFeeDollars(sanitizeDecimal(t))}
              keyboardType="decimal-pad"
              inputMode="decimal"
              containerStyle={styles.halfField}
              error={errors.errandFeeDollars}
            />
            <TextInput
              label="Item cost est. (BZD)"
              placeholder="0.00"
              value={itemCostDollars}
              onChangeText={(t) => setItemCostDollars(sanitizeDecimal(t))}
              keyboardType="decimal-pad"
              inputMode="decimal"
              containerStyle={styles.halfField}
              error={errors.itemCostDollars}
            />
          </View>

          {/* Settlement method */}
          <View>
            <Text style={styles.fieldLabel}>Settlement</Text>
            <View style={styles.categoryGrid}>
              <Pressable
                style={[styles.categoryChip, paymentMethod === 'cash' && styles.categoryChipSelected]}
                onPress={() => setPaymentMethod('cash')}
              >
                <Text style={[styles.categoryText, paymentMethod === 'cash' && styles.categoryTextSelected]}>Cash</Text>
              </Pressable>
              <Pressable
                style={[styles.categoryChip, paymentMethod === 'ekyash' && styles.categoryChipSelected]}
                onPress={handleSelectEkyash}
              >
                <Text style={[styles.categoryText, paymentMethod === 'ekyash' && styles.categoryTextSelected]}>{ENABLE_EKYASH ? 'E-Kyash' : 'E-Kyash Soon'}</Text>
              </Pressable>
            </View>
          </View>

          <TextInput
            label="Description"
            placeholder="Describe exactly where you'll be and what needs to be done"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            style={styles.textArea}
            error={errors.description}
          />

          <Text style={styles.charCount}>
            {description.length}/{MAX_DESCRIPTION_LENGTH}
          </Text>

          <Button
            title="Post Errand"
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
    backgroundColor: colors.neutral[100],
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
    paddingBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.body2Bold,
    color: colors.forest[900],
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.xs,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
  },
  categoryChipSelected: {
    borderColor: colors.accent.green,
    backgroundColor: colors.accent.green,
  },
  categoryText: {
    ...typography.body2,
    color: colors.neutral[500],
  },
  categoryTextSelected: {
    ...typography.body2Bold,
    color: colors.neutral[0],
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  textArea: {
    minHeight: 80,
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
