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
import { useLocalSearchParams } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { TextInput, Button } from '@/components/ui';
import { LocationInput, DateInput, TimeInput } from '@/components/forms';
import type { LocationCoords } from '@/components/forms';
import { Icon } from '@/components/icons';
import { RouteInfoCard } from '@/components/cards/RouteInfoCard';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useCreatePostMutation } from '@/store/api/postsApi';
import { useGetDriverDetailsQuery } from '@/store/api/profilesApi';
import { calculateRoute } from '@/lib/mapbox';
import type { RouteInfo } from '@/lib/mapbox';
import { MAX_SEATS, MAX_PRICE_CENTS, MAX_DESCRIPTION_LENGTH } from '@/lib/constants';
import { sanitizeDecimal, sanitizeInteger, safeGoBack } from '@/lib/helpers';
import type { RootState } from '@/store';
import { showAlert } from '@/lib/alert';
import { showToast } from '@/store/slices/toastSlice';
import type { PostType, PickupStyle, PaymentMethod } from '@/types/database';

const safeBack = () => safeGoBack('/(tabs)/post/');

export default function RouteFormScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const postType = (type as PostType) || 'route_offer';
  const isOffer = postType === 'route_offer';

  const dispatch = useDispatch();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [createPost, { isLoading }] = useCreatePostMutation();
  const { data: driverDetails } = useGetDriverDetailsQuery(userId ?? '', { skip: !userId || !isOffer });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [priceDollars, setPriceDollars] = useState('');
  const [seatsTotal, setSeatsTotal] = useState('');
  const [minRiders, setMinRiders] = useState('');
  const [pickupStyle, setPickupStyle] = useState<PickupStyle>('single');
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  // Auto-fill vehicle description from driver_details
  useEffect(() => {
    if (driverDetails && !vehicleDescription) {
      const parts = [
        driverDetails.vehicle_color,
        driverDetails.vehicle_year,
        driverDetails.vehicle_make,
        driverDetails.vehicle_model,
      ].filter(Boolean);
      if (parts.length > 0) {
        setVehicleDescription(parts.join(' '));
      }
    }
  }, [driverDetails]); // eslint-disable-line react-hooks/exhaustive-deps

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
        if (!cancelled) {
          setRouteInfo(null);
          showAlert('Route Error', 'Could not calculate route. Check your addresses and try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });

    return () => { cancelled = true; };
  }, [originCoords, destCoords]);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Title is required';
    if (!originAddress.trim()) newErrors.originAddress = 'Origin is required';
    if (!destAddress.trim()) newErrors.destAddress = 'Destination is required';
    if (!departureDate.trim()) newErrors.departureDate = 'Date is required';
    if (!departureTime.trim()) newErrors.departureTime = 'Time is required';

    // Price validation
    const priceNum = parseFloat(priceDollars);
    if (!priceDollars.trim()) {
      newErrors.priceDollars = 'Price is required';
    } else if (isNaN(priceNum) || priceNum <= 0) {
      newErrors.priceDollars = 'Enter a valid price';
    } else if (Math.round(priceNum * 100) > MAX_PRICE_CENTS) {
      newErrors.priceDollars = 'Max price is $9,999 BZD';
    }

    // Seats validation (for offers)
    if (isOffer) {
      const seatsNum = parseInt(seatsTotal, 10);
      if (!seatsTotal.trim()) {
        newErrors.seatsTotal = 'Seats required';
      } else if (isNaN(seatsNum) || seatsNum < 1) {
        newErrors.seatsTotal = 'At least 1 seat';
      } else if (seatsNum > MAX_SEATS) {
        newErrors.seatsTotal = `Max ${MAX_SEATS} seats`;
      }

      if (minRiders.trim()) {
        const minNum = parseInt(minRiders, 10);
        if (isNaN(minNum) || minNum < 1) {
          newErrors.minRiders = 'Must be at least 1';
        } else if (seatsNum && minNum > seatsNum) {
          newErrors.minRiders = 'Cannot exceed total seats';
        }
      }

      if (!vehicleDescription.trim()) {
        newErrors.vehicleDescription = 'Describe your vehicle so riders can find you';
      }
    }

    if (!description.trim()) newErrors.description = 'Description is required';
    else if (description.length > MAX_DESCRIPTION_LENGTH) {
      newErrors.description = `Max ${MAX_DESCRIPTION_LENGTH} characters`;
    }

    // Validate departure datetime
    if (departureDate.trim() && departureTime.trim()) {
      const dt = new Date(`${departureDate}T${departureTime}`);
      if (isNaN(dt.getTime())) {
        newErrors.departureDate = 'Invalid date';
        newErrors.departureTime = 'Invalid time';
      } else if (dt <= new Date()) {
        newErrors.departureDate = 'Departure must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, originAddress, destAddress, departureDate, departureTime, priceDollars, seatsTotal, minRiders, description, isOffer, vehicleDescription]);

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!userId) {
      showAlert('Error', 'You must be signed in to post');
      return;
    }

    const priceCents = Math.round(parseFloat(priceDollars) * 100);
    const departure = new Date(`${departureDate}T${departureTime}`).toISOString();

    try {
      await createPost({
        author_id: userId,
        type: postType,
        title: title.trim(),
        description: description.trim(),
        origin_address: originAddress.trim(),
        dest_address: destAddress.trim(),
        origin_lat: originCoords?.lat ?? null,
        origin_lng: originCoords?.lng ?? null,
        dest_lat: destCoords?.lat ?? null,
        dest_lng: destCoords?.lng ?? null,
        departure_at: departure,
        price_cents: priceCents,
        seats_total: isOffer ? parseInt(seatsTotal, 10) : null,
        min_riders: minRiders.trim() ? parseInt(minRiders, 10) : null,
        pickup_style: isOffer ? pickupStyle : null,
        vehicle_description: isOffer ? vehicleDescription.trim() : null,
        pickup_notes: isOffer && pickupNotes.trim() ? pickupNotes.trim() : null,
        is_round_trip: isOffer ? isRoundTrip : false,
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={safeBack} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isOffer ? 'Offer a Route' : 'Request a Route'}
        </Text>
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
            placeholder={isOffer ? 'e.g. Belize City to Belmopan' : 'e.g. Need ride to San Ignacio'}
            value={title}
            onChangeText={setTitle}
            error={errors.title}
          />

          <LocationInput
            label="From"
            placeholder="Origin address or town"
            value={originAddress}
            onChangeText={setOriginAddress}
            onLocationSelect={setOriginCoords}
            error={errors.originAddress}
          />

          <LocationInput
            label="To"
            placeholder="Destination address or town"
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
              label="Date"
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
            label={isOffer ? 'Price per seat (BZD)' : 'Offering price (BZD)'}
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
            <View style={styles.pickupSection}>
              <View style={[styles.row, { gap: spacing.sm }]}>
                <Pressable
                  style={[styles.pickupOption, paymentMethod === 'cash' && styles.pickupSelected]}
                  onPress={() => setPaymentMethod('cash')}
                >
                  <Text style={[styles.pickupText, paymentMethod === 'cash' && styles.pickupTextSelected]}>Cash</Text>
                </Pressable>
                <Pressable
                  style={[styles.pickupOption, paymentMethod === 'ekyash' && styles.pickupSelected]}
                  onPress={() => setPaymentMethod('ekyash')}
                >
                  <Text style={[styles.pickupText, paymentMethod === 'ekyash' && styles.pickupTextSelected]}>eKyash</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {isOffer && (
            <>
              <TextInput
                label="Vehicle description"
                placeholder="e.g. White 2019 Toyota Corolla"
                value={vehicleDescription}
                onChangeText={setVehicleDescription}
                error={errors.vehicleDescription}
              />

              <View style={styles.row}>
                <TextInput
                  label="Seats available"
                  placeholder="e.g. 4"
                  value={seatsTotal}
                  onChangeText={(t) => setSeatsTotal(sanitizeInteger(t))}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  containerStyle={styles.halfField}
                  error={errors.seatsTotal}
                />
                <TextInput
                  label="Min riders (optional)"
                  placeholder="e.g. 2"
                  value={minRiders}
                  onChangeText={(t) => setMinRiders(sanitizeInteger(t))}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  containerStyle={styles.halfField}
                  error={errors.minRiders}
                />
              </View>

              <View style={styles.pickupSection}>
                <Text style={styles.fieldLabel}>Trip type</Text>
                <View style={styles.row}>
                  <Pressable
                    style={[
                      styles.pickupOption,
                      !isRoundTrip && styles.pickupSelected,
                    ]}
                    onPress={() => setIsRoundTrip(false)}
                  >
                    <Text
                      style={[
                        styles.pickupText,
                        !isRoundTrip && styles.pickupTextSelected,
                      ]}
                    >
                      One way
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.pickupOption,
                      isRoundTrip && styles.pickupSelected,
                    ]}
                    onPress={() => setIsRoundTrip(true)}
                  >
                    <Text
                      style={[
                        styles.pickupText,
                        isRoundTrip && styles.pickupTextSelected,
                      ]}
                    >
                      Round trip
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.pickupSection}>
                <Text style={styles.fieldLabel}>Pickup style</Text>
                <View style={styles.row}>
                  <Pressable
                    style={[
                      styles.pickupOption,
                      pickupStyle === 'single' && styles.pickupSelected,
                    ]}
                    onPress={() => setPickupStyle('single')}
                  >
                    <Text
                      style={[
                        styles.pickupText,
                        pickupStyle === 'single' && styles.pickupTextSelected,
                      ]}
                    >
                      Single pickup
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.pickupOption,
                      pickupStyle === 'multi_stop' && styles.pickupSelected,
                    ]}
                    onPress={() => setPickupStyle('multi_stop')}
                  >
                    <Text
                      style={[
                        styles.pickupText,
                        pickupStyle === 'multi_stop' && styles.pickupTextSelected,
                      ]}
                    >
                      Multi-stop
                    </Text>
                  </Pressable>
                </View>
              </View>

              <TextInput
                label="Pickup notes (optional)"
                placeholder="e.g. I'll be at Shell station by the roundabout"
                value={pickupNotes}
                onChangeText={setPickupNotes}
                multiline
                numberOfLines={2}
                style={styles.textArea}
              />
            </>
          )}

          <TextInput
            label="Description"
            placeholder="Describe exactly where you'll be (e.g. by the gas station on Western Hwy)"
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
            title={isOffer ? 'Post Route' : 'Post Request'}
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
  fieldLabel: {
    ...typography.body2Bold,
    color: colors.forest[900],
    marginBottom: spacing.sm,
  },
  pickupSection: {
    gap: 0,
  },
  pickupOption: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
  },
  pickupSelected: {
    borderColor: colors.accent.green,
    backgroundColor: colors.neutral[100],
  },
  pickupText: {
    ...typography.body2,
    color: colors.neutral[500],
  },
  pickupTextSelected: {
    ...typography.body2Bold,
    color: colors.forest[900],
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
