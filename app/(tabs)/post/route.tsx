import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { TextInput, Button, ScreenHeader, useFloatingTabBarPad } from '@/components/ui';
import { LocationInput, DateInput, TimeInput } from '@/components/forms';
import type { LocationCoords } from '@/components/forms';
import { Icon } from '@/components/icons';
import { RouteInfoCard } from '@/components/cards/RouteInfoCard';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { useCreatePostMutation } from '@/store/api/postsApi';
import { useGetDriverDetailsQuery } from '@/store/api/profilesApi';
import { calculateRoute } from '@/lib/mapbox';
import type { RouteInfo } from '@/lib/mapbox';
import { EKYASH_COMING_SOON_MESSAGE, ENABLE_EKYASH, MAX_SEATS, MAX_PRICE_CENTS, MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from '@/lib/constants';
import { sanitizeDecimal, sanitizeInteger, safeGoBack } from '@/lib/helpers';
import type { RootState } from '@/store';
import { showAlert } from '@/lib/alert';
import { showToast } from '@/store/slices/toastSlice';
import type { PostType, PickupStyle, PaymentMethod } from '@/types/database';
import { Text } from '@/components/ui/Text';

const safeBack = () => safeGoBack('/(tabs)/post/');

const REPEAT_DAY_OPTIONS = [
  { label: 'Sun', value: 7 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];
const MAX_MULTI_STOPS = 5;

interface RouteStop {
  id: string;
  address: string;
  coords: LocationCoords | null;
}

interface SerializedRouteStop {
  address: string;
  lat: number | null;
  lng: number | null;
}

let routeStopId = 0;

function createRouteStop(): RouteStop {
  routeStopId += 1;
  return {
    id: `route-stop-${routeStopId}`,
    address: '',
    coords: null,
  };
}

function parseRouteDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }

  const [hours, minutes] = time.split(':').map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function serializeRouteStops(stops: RouteStop[]): string | null {
  const normalized: SerializedRouteStop[] = stops
    .filter((stop) => stop.address.trim().length > 0)
    .map((stop) => ({
      address: stop.address.trim(),
      lat: stop.coords?.lat ?? null,
      lng: stop.coords?.lng ?? null,
    }));

  if (normalized.length === 0) return null;
  return JSON.stringify({ stops: normalized });
}

export default function RouteFormScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const { type } = useLocalSearchParams<{ type: string }>();
  const postType = (type as PostType) || 'route_offer';
  const isOffer = postType === 'route_offer';
  const tabBarPad = useFloatingTabBarPad();

  const dispatch = useDispatch();

  const handleSelectEkyash = useCallback(() => {
    showAlert('Coming Soon', EKYASH_COMING_SOON_MESSAGE);
  }, []);
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [createPost, { isLoading }] = useCreatePostMutation();
  const { data: driverDetails } = useGetDriverDetailsQuery(userId ?? '', { skip: !userId || !isOffer });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [destAddress, setDestAddress] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  /** Request-only: ride needed immediately rather than at a scheduled time. */
  const [asap, setAsap] = useState(false);
  const [priceDollars, setPriceDollars] = useState('');
  const [seatsTotal, setSeatsTotal] = useState('');
  const [minRiders, setMinRiders] = useState('');
  const [pickupStyle, setPickupStyle] = useState<PickupStyle>('single');
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatUntilDate, setRepeatUntilDate] = useState('');
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

  const addRouteStop = useCallback(() => {
    setRouteStops((prev) => {
      if (prev.length >= MAX_MULTI_STOPS) return prev;
      return [...prev, createRouteStop()];
    });
  }, []);

  const updateRouteStopAddress = useCallback((stopId: string, address: string) => {
    setRouteStops((prev) =>
      prev.map((stop) =>
        stop.id === stopId
          ? { ...stop, address, coords: stop.address === address ? stop.coords : null }
          : stop
      )
    );
  }, []);

  const updateRouteStopCoords = useCallback((stopId: string, coords: LocationCoords) => {
    setRouteStops((prev) =>
      prev.map((stop) => (stop.id === stopId ? { ...stop, coords } : stop))
    );
  }, []);

  const removeRouteStop = useCallback((stopId: string) => {
    setRouteStops((prev) => prev.filter((stop) => stop.id !== stopId));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`routeStop:${stopId}`];
      return next;
    });
  }, []);

  const toggleRepeatDay = useCallback((day: number) => {
    setRepeatEnabled(true);
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }, []);

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

    const stopWaypoints = pickupStyle === 'multi_stop'
      ? routeStops
          .map((stop) => stop.coords)
          .filter((coords): coords is LocationCoords => coords != null)
      : [];

    let cancelled = false;
    setRouteLoading(true);
    calculateRoute(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng, stopWaypoints)
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
  }, [originCoords, destCoords, pickupStyle, routeStops]);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Title is required';
    else if (title.trim().length > MAX_TITLE_LENGTH) newErrors.title = `Max ${MAX_TITLE_LENGTH} characters`;
    if (!originAddress.trim()) newErrors.originAddress = 'Origin is required';
    if (!destAddress.trim()) newErrors.destAddress = 'Destination is required';
    if (!isOffer && asap) {
      // ASAP requests don't need a scheduled departure.
      if (departureDate.trim() && departureTime.trim()) {
        const dt = parseRouteDateTime(departureDate, departureTime);
        if (dt && dt <= new Date()) {
          newErrors.departureDate = 'If scheduling, departure must be in the future';
        }
      }
    } else if (!departureDate.trim()) {
      newErrors.departureDate = 'Date is required';
    } else if (!departureTime.trim()) {
      newErrors.departureTime = 'Time is required';
    }

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

      if (repeatEnabled && repeatDays.length === 0) {
        newErrors.repeatDays = 'Select at least one day';
      }

      if (repeatEnabled && repeatUntilDate.trim()) {
        const repeatUntil = new Date(`${repeatUntilDate}T00:00:00`);
        if (Number.isNaN(repeatUntil.getTime())) {
          newErrors.repeatUntilDate = 'Enter a valid end date';
        } else if (departureDate.trim() && repeatUntilDate < departureDate) {
          newErrors.repeatUntilDate = 'End date must be on or after departure';
        }
      }
    }

    if (pickupStyle === 'multi_stop') {
      routeStops.forEach((stop) => {
        // Only validate stops that the user started filling (has address)
        if (stop.address.trim().length > 0 && stop.address.trim().length < 2) {
          newErrors[`routeStop:${stop.id}`] = 'Stop address is required';
        }
      });
    }

    if (!description.trim()) newErrors.description = 'Description is required';
    else if (description.length > MAX_DESCRIPTION_LENGTH) {
      newErrors.description = `Max ${MAX_DESCRIPTION_LENGTH} characters`;
    }

    // Validate departure datetime
    if (departureDate.trim() && departureTime.trim()) {
      const dt = parseRouteDateTime(departureDate, departureTime);
      if (!dt) {
        newErrors.departureDate = 'Invalid date';
        newErrors.departureTime = 'Invalid time';
      } else if (dt <= new Date()) {
        newErrors.departureDate = 'Departure must be in the future';
      }
    }

    // Validate return time for round trips
    if (isOffer && isRoundTrip) {
      if (!returnDate.trim()) newErrors.returnDate = 'Return date is required';
      if (!returnTime.trim()) newErrors.returnTime = 'Return time is required';
      if (returnDate.trim() && returnTime.trim() && departureDate.trim() && departureTime.trim()) {
        const depDt = parseRouteDateTime(departureDate, departureTime);
        const retDt = parseRouteDateTime(returnDate, returnTime);
        if (!retDt) {
          newErrors.returnDate = 'Invalid date';
          newErrors.returnTime = 'Invalid time';
        } else if (depDt && retDt <= depDt) {
          newErrors.returnTime = 'Return must be after departure';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, originAddress, destAddress, departureDate, departureTime, priceDollars, seatsTotal, minRiders, description, isOffer, asap, vehicleDescription, isRoundTrip, returnDate, returnTime, pickupStyle, routeStops, repeatEnabled, repeatDays, repeatUntilDate]);

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!userId) {
      showAlert('Error', 'You must be signed in to post');
      return;
    }

    const priceCents = Math.round(parseFloat(priceDollars) * 100);
    const departureAt = parseRouteDateTime(departureDate, departureTime);
    const returnAt =
      isOffer && isRoundTrip ? parseRouteDateTime(returnDate, returnTime) : null;

    if (!departureAt && !( !isOffer && asap )) {
      showAlert('Error', 'Enter a valid departure date and time');
      return;
    }
    if (isOffer && isRoundTrip && !returnAt) {
      showAlert('Error', 'Enter a valid return date and time');
      return;
    }

    try {
      const result = await createPost({
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
        departure_at: departureAt ? departureAt.toISOString() : null,
        asap: !isOffer && asap ? true : undefined,
        price_cents: priceCents,
        seats_total: isOffer ? parseInt(seatsTotal, 10) : null,
        min_riders: minRiders.trim() ? parseInt(minRiders, 10) : null,
        pickup_style: isOffer ? pickupStyle : null,
        vehicle_description: isOffer ? vehicleDescription.trim() : null,
        pickup_notes: isOffer && pickupStyle === 'multi_stop' ? serializeRouteStops(routeStops) : null,
        is_round_trip: isOffer ? isRoundTrip : false,
        return_time: returnAt ? returnAt.toISOString() : null,
        repeat_days: isOffer && repeatEnabled && repeatDays.length > 0 ? repeatDays : null,
        repeat_until: isOffer && repeatEnabled && repeatUntilDate.trim() ? repeatUntilDate : null,
        last_confirmed_at: isOffer && repeatEnabled && repeatDays.length > 0 ? new Date().toISOString() : null,
        payment_method: paymentMethod,
        route_geometry: routeInfo?.geometry ?? null,
        route_distance_km: routeInfo?.distance_km ?? null,
        route_duration_min: routeInfo?.duration_minutes ?? null,
        route_fuel_cost_cents: routeInfo?.fuel_cost_cents ?? null,
      }).unwrap();

      dispatch(showToast({ title: 'Post created successfully!' }));
      if (result?.id) {
        router.replace(`/(tabs)/activity/post/${result.id}`);
      } else {
        router.replace('/(tabs)/activity');
      }
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
        <Pressable
          onPress={safeBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isOffer ? 'Offer a Route' : 'Request a Ride'}
        </Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.formContent, { paddingBottom: tabBarPad }]}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            label="Title"
            placeholder={isOffer ? 'e.g. Belize City to Belmopan' : 'e.g. Need ride to San Ignacio'}
            value={title}
            onChangeText={setTitle}
            error={errors.title}
            maxLength={100}
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
              pricePerSeatCents={isOffer && priceDollars ? Math.round(parseFloat(priceDollars) * 100) : null}
            />
          )}

          {isOffer && (
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
                  onPress={() => {
                    setPickupStyle('multi_stop');
                    setRouteStops((prev) => (prev.length > 0 ? prev : [createRouteStop()]));
                  }}
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
              {errors.routeStops ? <Text style={styles.inlineError}>{errors.routeStops}</Text> : null}
            </View>
          )}

          {isOffer && pickupStyle === 'multi_stop' && (
            <View style={styles.pickupSection}>
              <View style={styles.stopHeaderRow}>
                <Text style={styles.fieldLabel}>Stops on the way (optional)</Text>
                <Text style={styles.stopCounter}>{routeStops.filter(s => s.address.trim()).length}/{MAX_MULTI_STOPS}</Text>
              </View>

              {routeStops.map((stop, index) => (
                <View key={stop.id} style={styles.stopRow}>
                  <View style={styles.stopField}>
                    <LocationInput
                      label={`Stop ${index + 1}`}
                      placeholder="e.g. Belmopan roundabout"
                      value={stop.address}
                      onChangeText={(text) => updateRouteStopAddress(stop.id, text)}
                      onLocationSelect={(coords) => updateRouteStopCoords(stop.id, coords)}
                      error={errors[`routeStop:${stop.id}`]}
                    />
                  </View>
                  <Pressable
                    style={styles.removeStopButton}
                    onPress={() => removeRouteStop(stop.id)}
                    hitSlop={8}
                  >
                    <Icon name="x" size={18} color={c.text} />
                  </Pressable>
                </View>
              ))}

{routeStops.length < MAX_MULTI_STOPS && (
                <Pressable style={styles.addStopButton} onPress={addRouteStop}>
                  <Icon name="plus-circle" size={18} color={c.textMuted} />
                  <Text style={styles.addStopText}>Add stop</Text>
                </Pressable>
              )}
              <Text style={styles.helperText}>Add stops along your route (optional)</Text>
            </View>
          )}

          {isOffer && (
            <View style={styles.pickupSection}>
              <Text style={styles.fieldLabel}>Trip type</Text>
              <View style={styles.row}>
                <Pressable
                  style={[
                    styles.pickupOption,
                    !isRoundTrip && styles.pickupSelected,
                  ]}
                  onPress={() => {
                    setIsRoundTrip(false);
                    setReturnDate('');
                    setReturnTime('');
                  }}
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
          )}

          <View style={styles.row}>
            <DateInput
              label="Departure date"
              value={departureDate}
              onChangeText={setDepartureDate}
              error={errors.departureDate}
            />
            <TimeInput
              label="Departure time"
              value={departureTime}
              onChangeText={setDepartureTime}
              error={errors.departureTime}
            />
          </View>

          {!isOffer && (
            <View style={styles.pickupSection}>
              <View style={[styles.row, { gap: spacing.sm }]}>
                <Pressable
                  style={[styles.pickupOption, !asap && styles.pickupSelected]}
                  onPress={() => setAsap(false)}
                >
                  <Text style={[styles.pickupText, !asap && styles.pickupTextSelected]}>
                    Scheduled
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.pickupOption, asap && styles.pickupSelected]}
                  onPress={() => setAsap(true)}
                >
                  <Text style={[styles.pickupText, asap && styles.pickupTextSelected]}>
                    ASAP
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {isOffer && isRoundTrip && (
            <View style={styles.row}>
              <DateInput
                label="Return date"
                value={returnDate}
                onChangeText={setReturnDate}
                error={errors.returnDate}
              />
              <TimeInput
                label="Return time"
                value={returnTime}
                onChangeText={setReturnTime}
                error={errors.returnTime}
              />
            </View>
          )}

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
                  onPress={handleSelectEkyash}
                >
                  <Text style={[styles.pickupText, paymentMethod === 'ekyash' && styles.pickupTextSelected]}>{ENABLE_EKYASH ? 'E-Kyash' : 'E-Kyash Soon'}</Text>
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

              {/* Repeat trip toggle + day-of-week checkboxes */}
              <View style={styles.pickupSection}>
                <Text style={styles.fieldLabel}>Repeat trip</Text>
                <Pressable
                  style={[styles.repeatToggle, repeatEnabled && styles.repeatToggleActive]}
                  onPress={() => {
                    setRepeatEnabled((prev) => {
                      if (prev) {
                        setRepeatDays([]);
                        setRepeatUntilDate('');
                        return false;
                      }
                      return true;
                    });
                  }}
                >
                  <View style={[styles.checkbox, repeatEnabled && styles.checkboxChecked]}>
                    {repeatEnabled ? <Icon name="check" size={14} color="#fff" /> : null}
                  </View>
                  <Text style={styles.repeatToggleText}>
                    This trip repeats on specific days
                  </Text>
                </Pressable>
                {repeatEnabled ? (
                  <>
                    <View style={styles.daysRow}>
                      {REPEAT_DAY_OPTIONS.map(({ label, value }) => (
                        <Pressable
                          key={value}
                          style={[styles.dayChip, repeatDays.includes(value) && styles.dayChipSelected]}
                          onPress={() => toggleRepeatDay(value)}
                        >
                          <Text style={[styles.dayChipText, repeatDays.includes(value) && styles.dayChipTextSelected]}>
                            {label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    {errors.repeatDays ? <Text style={styles.inlineError}>{errors.repeatDays}</Text> : null}
                    <DateInput
                      label="Repeat until (optional)"
                      value={repeatUntilDate}
                      onChangeText={setRepeatUntilDate}
                      error={errors.repeatUntilDate}
                    />
                    <Text style={styles.helperText}>
                      Leave blank to keep the route repeating until you pause or delete it.
                    </Text>
                  </>
                ) : null}
              </View>

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
  formContent: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.lg,
    overflow: 'visible',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  fieldLabel: {
    ...type.bodySm.bold,
    color: c.text,
    marginBottom: spacing.sm,
  },
  pickupSection: {
    gap: 0,
    position: 'relative',
    overflow: 'visible',
  },
  stopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  stopCounter: {
    ...type.caption.regular,
    color: c.textMuted,
  },
  pickupOption: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    backgroundColor: c.surface,
  },
  pickupSelected: {
    borderColor: c.chipSelectedBg,
    backgroundColor: c.chipSelectedBg,
  },
  pickupText: {
    ...type.bodySm.regular,
    color: c.textMuted,
  },
  pickupTextSelected: {
    ...type.bodySm.bold,
    color: c.chipSelectedText,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginBottom: spacing.md,
    zIndex: 20,
  },
  stopField: {
    flex: 1,
    zIndex: 20,
  },
  removeStopButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: spacing.xs,
  },
  addStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.pill,
    backgroundColor: c.surface,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  addStopText: {
    ...type.bodySm.bold,
    color: c.textMuted,
  },
  inlineError: {
    ...type.caption.regular,
    color: colors.error,
    marginTop: spacing.xs,
  },
  helperText: {
    ...type.caption.regular,
    color: c.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  repeatToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  repeatToggleActive: {},
  repeatToggleText: {
    ...type.bodySm.regular,
    color: c.text,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
  },
  checkboxChecked: {
    borderColor: colors.accent.green,
    backgroundColor: colors.accent.green,
  },
  checkboxTick: {
    ...type.caption.regular,
    color: c.textInverse,
    fontWeight: '700',
    lineHeight: 14,
  },
  daysRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    backgroundColor: c.surface,
  },
  dayChipSelected: {
    borderColor: colors.accent.green,
    backgroundColor: colors.accent.green,
  },
  dayChipText: {
    ...type.caption.regular,
    color: c.textMuted,
  },
  dayChipTextSelected: {
    ...type.caption.regular,
    fontWeight: '700',
    color: c.textInverse,
  },
  charCount: {
    ...type.caption.regular,
    color: c.textMuted,
    textAlign: 'right',
    marginTop: -spacing.md,
  },
  submitButton: {
    marginTop: spacing.md,
  },
});
