import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/icons';
import { safeGoBack } from '@/lib/helpers';
import { reverseGeocode } from '@/lib/mapbox';
import { Button, TextInput, ScreenHeader } from '@/components/ui';
import { MapPicker } from '@/components/map/MapPicker';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import {
  useCreateGasPriceMutation,
  useUpdateGasPriceMutation,
  useGetGasPricesQuery,
} from '@/store/api/reportsApi';
import type { RootState } from '@/store';

const safeBack = () => safeGoBack('/(tabs)/profile/reports');

export default function ReportGasModal() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const location = useSelector((state: RootState) => state.location);
  const [createGasPrice] = useCreateGasPriceMutation();
  const [updateGasPrice] = useUpdateGasPriceMutation();
  const { data: gasPrices } = useGetGasPricesQuery();

  const existing = useMemo(
    () => (editId ? (gasPrices ?? []).find((g) => g.id === editId) : undefined),
    [editId, gasPrices],
  );
  const isEdit = !!existing;

  const [stationName, setStationName] = useState('');
  const [regular, setRegular] = useState('');
  const [premium, setPremium] = useState('');
  const [diesel, setDiesel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [pinCoords, setPinCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pinLabel, setPinLabel] = useState<string | null>(null);

  // Prefill when editing
  useEffect(() => {
    if (!existing) return;
    setStationName(existing.station_name);
    setRegular(existing.regular_cents != null ? (existing.regular_cents / 100).toFixed(2) : '');
    setPremium(existing.premium_cents != null ? (existing.premium_cents / 100).toFixed(2) : '');
    setDiesel(existing.diesel_cents != null ? (existing.diesel_cents / 100).toFixed(2) : '');
    setPinCoords({ latitude: existing.station_lat, longitude: existing.station_lng });
    // Reverse-geocode to show the registered address
    reverseGeocode(existing.station_lat, existing.station_lng)
      .then((name) => setPinLabel(name))
      .catch(() => { /* ignore */ });
  }, [existing]);

  const parseCents = (val: string): number | null => {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) return null;
    return Math.round(n * 100);
  };

  const handleSubmit = async () => {
    if (!stationName.trim()) {
      showAlert('Station Name', 'Please enter the gas station name.');
      return;
    }

    const regularCents = parseCents(regular);
    const premiumCents = parseCents(premium);
    const dieselCents = parseCents(diesel);

    if (!regularCents && !premiumCents && !dieselCents) {
      showAlert('Prices', 'Please enter at least one fuel price.');
      return;
    }
    if (!userId) {
      showAlert('Not Signed In', 'Please sign in to submit prices.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && existing) {
        await updateGasPrice({
          id: existing.id,
          stationName: stationName.trim(),
          stationLat: pinCoords?.latitude ?? existing.station_lat,
          stationLng: pinCoords?.longitude ?? existing.station_lng,
          regularCents: regularCents ?? null,
          premiumCents: premiumCents ?? null,
          dieselCents: dieselCents ?? null,
        }).unwrap();
        showAlert('Updated', 'Gas prices updated.');
      } else {
        await createGasPrice({
          reporterId: userId,
          stationName: stationName.trim(),
          stationLat: pinCoords?.latitude ?? location.latitude ?? 17.189,
          stationLng: pinCoords?.longitude ?? location.longitude ?? -88.497,
          regularCents: regularCents ?? undefined,
          premiumCents: premiumCents ?? undefined,
          dieselCents: dieselCents ?? undefined,
        }).unwrap();
        showAlert('Price Reported', 'Thank you for updating fuel prices!');
      }
      safeBack();
    } catch (err) {
      console.error('Gas price submit error:', err);
      showAlert('Error', 'Could not submit price. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader style={styles.header}>
        <Pressable
          onPress={safeBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Gas Prices' : 'Gas Prices'}</Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <TextInput
            label="Station Name"
            value={stationName}
            onChangeText={setStationName}
            placeholder="e.g. UNO Belize City"
            maxLength={100}
          />

          <Text style={styles.sectionLabel}>Prices per Belize gallon (BZD)</Text>

          <TextInput
            label="Regular"
            value={regular}
            onChangeText={setRegular}
            placeholder="e.g. 12.50"
            keyboardType="decimal-pad"
            maxLength={10}
          />

          <TextInput
            label="Premium"
            value={premium}
            onChangeText={setPremium}
            placeholder="e.g. 14.00"
            keyboardType="decimal-pad"
            maxLength={10}
          />

          <TextInput
            label="Diesel"
            value={diesel}
            onChangeText={setDiesel}
            placeholder="e.g. 11.75"
            keyboardType="decimal-pad"
            maxLength={10}
          />

          <Pressable style={styles.locationRow} onPress={() => setMapVisible(true)}>
            <Icon name="map-pin" size={18} color={colors.accent.green} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locationLabel} numberOfLines={2}>
                {pinLabel
                  ? pinLabel
                  : pinCoords
                    ? `${pinCoords.latitude.toFixed(5)}, ${pinCoords.longitude.toFixed(5)}`
                    : location.latitude
                      ? 'Current location'
                      : 'Default location'}
              </Text>
              {pinLabel && stationName.trim() && pinLabel.toLowerCase() !== stationName.trim().toLowerCase() ? (
                <Text style={styles.locationSub} numberOfLines={1}>Mapbox address</Text>
              ) : null}
            </View>
            <Text style={styles.locationAction}>{pinCoords ? 'Change' : 'Pick'}</Text>
          </Pressable>

          <MapPicker
            visible={mapVisible}
            onClose={() => setMapVisible(false)}
            initialCoords={pinCoords ?? undefined}
            onConfirm={(coords, name) => {
              setPinCoords(coords);
              setPinLabel(name);
              // Auto-suggest station name from first segment of reverse-geocode
              if (!stationName.trim() && name) {
                const firstPart = name.split(',')[0]?.trim();
                if (firstPart) setStationName(firstPart);
              }
              setMapVisible(false);
            }}
            title="Station Location"
          />

          <Button
            title={isEdit ? 'Save Changes' : 'Submit Prices'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={!stationName.trim()}
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
  },
  sectionLabel: {
    ...type.bodySm.bold,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  locationLabel: {
    ...type.bodySm.regular,
    color: c.text,
    flex: 1,
  },
  locationSub: {
    ...type.caption.regular,
    color: c.textMuted,
    marginTop: 2,
  },
  locationAction: {
    ...type.bodySm.bold,
    color: colors.accent.green,
  },
});
