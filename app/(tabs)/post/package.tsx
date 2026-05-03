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
import type { PaymentMethod } from '@/types/database';
import { showAlert } from '@/lib/alert';
import { showToast } from '@/store/slices/toastSlice';

const safeBack = () => safeGoBack('/(tabs)/post/');

export default function PackageFormScreen() {
  const dispatch = useDispatch();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [createPost, { isLoading }] = useCreatePostMutation();

  const handleSelectEkyash = useCallback(() => {
    showAlert('Coming Soon', EKYASH_COMING_SOON_MESSAGE);
  }, []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [priceDollars, setPriceDollars] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
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
    if (!originAddress.trim()) newErrors.originAddress = 'Pickup location is required';
    if (!destAddress.trim()) newErrors.destAddress = 'Delivery address is required';

    const priceNum = parseFloat(priceDollars);
    if (!priceDollars.trim()) {
      newErrors.priceDollars = 'Delivery fee is required';
    } else if (isNaN(priceNum) || priceNum <= 0) {
      newErrors.priceDollars = 'Enter a valid fee';
    } else if (Math.round(priceNum * 100) > MAX_PRICE_CENTS) {
      newErrors.priceDollars = 'Max $9,999 BZD';
    }

    if (!description.trim()) newErrors.description = 'Description is required';
    else if (description.length > MAX_DESCRIPTION_LENGTH) {
      newErrors.description = `Max ${MAX_DESCRIPTION_LENGTH} characters`;
    }

    if (departureDate.trim() && departureTime.trim()) {
      const dt = new Date(`${departureDate}T${departureTime}`);
      if (isNaN(dt.getTime())) {
        newErrors.departureDate = 'Invalid date';
      } else if (dt <= new Date()) {
        newErrors.departureDate = 'Must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, originAddress, destAddress, priceDollars, description, departureDate, departureTime]);

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!userId) {
      showAlert('Error', 'You must be signed in to post');
      return;
    }

    const priceCents = Math.round(parseFloat(priceDollars) * 100);
    const departureAt =
      departureDate.trim() && departureTime.trim()
        ? new Date(`${departureDate}T${departureTime}`).toISOString()
        : null;

    try {
      await createPost({
        author_id: userId,
        type: 'package',
        title: title.trim(),
        description: description.trim(),
        origin_address: originAddress.trim(),
        dest_address: destAddress.trim(),
        origin_lat: originCoords?.lat ?? null,
        origin_lng: originCoords?.lng ?? null,
        dest_lat: destCoords?.lat ?? null,
        dest_lng: destCoords?.lng ?? null,
        departure_at: departureAt,
        price_cents: priceCents,
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
        <Text style={styles.headerTitle}>Send a Package</Text>
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
            placeholder="e.g. Small box to Orange Walk"
            value={title}
            onChangeText={setTitle}
            error={errors.title}
            maxLength={100}
          />

          <LocationInput
            label="Pickup from"
            placeholder="Where to collect the package"
            value={originAddress}
            onChangeText={setOriginAddress}
            onLocationSelect={setOriginCoords}
            error={errors.originAddress}
          />

          <LocationInput
            label="Deliver to"
            placeholder="Delivery address"
            value={destAddress}
            onChangeText={setDestAddress}
            onLocationSelect={setDestCoords}
            error={errors.destAddress}
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
              label="Send by (date)"
              value={departureDate}
              onChangeText={setDepartureDate}
              error={errors.departureDate}
            />
            <TimeInput
              label="Time"
              value={departureTime}
              onChangeText={setDepartureTime}
              error={errors.departureTime}
            />
          </View>

          <TextInput
            label="Delivery fee (BZD)"
            placeholder="0.00"
            value={priceDollars}
            onChangeText={(t) => setPriceDollars(sanitizeDecimal(t))}
            keyboardType="decimal-pad"
            inputMode="decimal"
            error={errors.priceDollars}
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
                onPress={handleSelectEkyash}
              >
                <Text style={[styles.chipText, paymentMethod === 'ekyash' && styles.chipTextSelected]}>{ENABLE_EKYASH ? 'E-Kyash' : 'E-Kyash Soon'}</Text>
              </Pressable>
            </View>
          </View>

          <TextInput
            label="Description"
            placeholder="Describe exactly where you'll be and package details (size, weight, handling)"
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
            title="Post Package"
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
  fieldLabel: {
    ...typography.body2Bold,
    color: colors.forest[900],
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
});
