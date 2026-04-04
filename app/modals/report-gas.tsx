import React, { useState } from 'react';
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
import { Icon } from '@/components/icons';
import { safeGoBack } from '@/lib/helpers';
import { Button, TextInput } from '@/components/ui';
import { MapPicker } from '@/components/map';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useCreateGasPriceMutation } from '@/store/api/reportsApi';
import type { RootState } from '@/store';

const safeBack = () => safeGoBack('/(tabs)/profile/reports');

export default function ReportGasModal() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const location = useSelector((state: RootState) => state.location);
  const [createGasPrice] = useCreateGasPriceMutation();

  const [stationName, setStationName] = useState('');
  const [regular, setRegular] = useState('');
  const [premium, setPremium] = useState('');
  const [diesel, setDiesel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [pinCoords, setPinCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pinLabel, setPinLabel] = useState<string | null>(null);

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
      safeBack();
    } catch (err) {
      console.error('Gas price insert error:', err);
      showAlert('Error', 'Could not submit price. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={safeBack} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Gas Prices</Text>
        <View style={{ width: 24 }} />
      </View>

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
          />

          <TextInput
            label="Premium"
            value={premium}
            onChangeText={setPremium}
            placeholder="e.g. 14.00"
            keyboardType="decimal-pad"
          />

          <TextInput
            label="Diesel"
            value={diesel}
            onChangeText={setDiesel}
            placeholder="e.g. 11.75"
            keyboardType="decimal-pad"
          />

          <Pressable style={styles.locationRow} onPress={() => setMapVisible(true)}>
            <Icon name="map-pin" size={18} color={colors.accent.green} />
            <Text style={styles.locationLabel} numberOfLines={1}>
              {pinLabel
                ? pinLabel
                : location.latitude
                  ? 'Current location'
                  : 'Default location'}
            </Text>
            <Text style={styles.locationAction}>Change</Text>
          </Pressable>

          <MapPicker
            visible={mapVisible}
            onClose={() => setMapVisible(false)}
            onConfirm={(coords, name) => {
              setPinCoords(coords);
              setPinLabel(name);
              setMapVisible(false);
            }}
            title="Station Location"
          />

          <Button
            title="Submit Prices"
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
  },
  sectionLabel: {
    ...typography.body2Bold,
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  locationLabel: {
    ...typography.body2,
    color: colors.forest[900],
    flex: 1,
  },
  locationAction: {
    ...typography.body2Bold,
    color: colors.accent.green,
  },
});
