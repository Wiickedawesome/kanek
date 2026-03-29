import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { TextInput, Button } from '@/components/ui';
import { LocationInput, DateInput, TimeInput } from '@/components/forms';
import type { LocationCoords } from '@/components/forms';
import { Icon } from '@/components/icons';
import { RouteInfoCard } from '@/components/cards/RouteInfoCard';
import { colors, typography, spacing } from '@/theme';
import { useCreatePostMutation } from '@/store/api/postsApi';
import { calculateRoute } from '@/lib/mapbox';
import type { RouteInfo } from '@/lib/mapbox';
import { MAX_PRICE_CENTS, MAX_DESCRIPTION_LENGTH } from '@/lib/constants';
import { sanitizeDecimal } from '@/lib/helpers';
import type { RootState } from '@/store';

export default function PackageFormScreen() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [createPost, { isLoading }] = useCreatePostMutation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [priceDollars, setPriceDollars] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');

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
      Alert.alert('Error', 'You must be signed in to post');
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
        route_geometry: routeInfo?.geometry ?? null,
        route_distance_km: routeInfo?.distance_km ?? null,
        route_duration_min: routeInfo?.duration_minutes ?? null,
        route_fuel_cost_cents: routeInfo?.fuel_cost_cents ?? null,
      }).unwrap();

      router.back();
    } catch (err: unknown) {
      console.error('Post save error:', err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'error' in err
            ? String((err as Record<string, unknown>).error)
            : 'Something went wrong';
      Alert.alert('Error', message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Send a Package</Text>
        <View style={{ width: 24 }} />
      </View>

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
  formContent: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
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
