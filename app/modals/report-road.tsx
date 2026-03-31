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
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { safeGoBack } from '@/lib/helpers';

const safeBack = () => safeGoBack('/(tabs)/profile/reports');
import { Button, TextInput , FilterChip } from '@/components/ui';
import { MapPicker } from '@/components/map';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useCreateRoadReportMutation } from '@/store/api/reportsApi';
import type { RootState } from '@/store';
import type { RoadReportType } from '@/types/database';

const REPORT_TYPES: { label: string; value: RoadReportType; icon: React.ComponentProps<typeof Icon>['name'] }[] = [
  { label: 'Accident', value: 'accident', icon: 'alert-triangle' },
  { label: 'Checkpoint', value: 'checkpoint', icon: 'shield-alert' },
  { label: 'Traffic', value: 'traffic', icon: 'clock' },
  { label: 'Flooding', value: 'flooding', icon: 'alert-triangle' },
  { label: 'Construction', value: 'construction', icon: 'construction' },
  { label: 'Road Damage', value: 'road_damage', icon: 'alert-triangle' },
];

export default function ReportRoadModal() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const location = useSelector((state: RootState) => state.location);
  const [createRoadReport] = useCreateRoadReportMutation();

  const [type, setType] = useState<RoadReportType | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [pinCoords, setPinCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pinLabel, setPinLabel] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!type) {
      showAlert('Select Type', 'Please select the type of road report.');
      return;
    }
    if (!userId) {
      showAlert('Not Signed In', 'Please sign in to submit a report.');
      return;
    }

    setSubmitting(true);
    try {
      await createRoadReport({
        reporterId: userId,
        type,
        lat: pinCoords?.latitude ?? location.latitude ?? 17.189,
        lng: pinCoords?.longitude ?? location.longitude ?? -88.497,
        description: description.trim() || undefined,
      }).unwrap();

      showAlert('Report Submitted', 'Thank you for helping the community!');
      safeBack();
    } catch (err) {
      console.error('Road report insert error:', err);
      const msg = err instanceof Error ? err.message : typeof err === 'object' && err !== null && 'error' in err ? String((err as { error: string }).error) : 'Could not submit report. Please try again.';
      showAlert('Error', msg);
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
        <Text style={styles.headerTitle}>Road Report</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.label}>What{"'"}s happening?</Text>
          <View style={styles.chips}>
            {REPORT_TYPES.map((rt) => (
              <FilterChip
                key={rt.value}
                label={rt.label}
                selected={type === rt.value}
                onPress={() => setType(rt.value)}
              />
            ))}
          </View>

          <TextInput
            label="Details (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Western Highway near Hattieville, water across both lanes"
            multiline
            numberOfLines={4}
            maxLength={500}
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
            title="Report Location"
          />

          <Button
            title="Submit Report"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!type}
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
  label: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
