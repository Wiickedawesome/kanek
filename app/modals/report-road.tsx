import React, { useState } from 'react';
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
import { Icon } from '@/components/icons';
import { Button, TextInput , FilterChip } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { supabase } from '@/lib/supabase';
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

  const [type, setType] = useState<RoadReportType | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!type) {
      Alert.alert('Select Type', 'Please select the type of road report.');
      return;
    }
    if (!userId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('road_reports').insert({
        reporter_id: userId,
        type,
        lat: location.latitude ?? 17.189,
        lng: location.longitude ?? -88.497,
        description: description.trim() || null,
      });

      if (error) throw error;

      Alert.alert('Report Submitted', 'Thank you for helping the community!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="navigation" size={24} color={colors.neutral[0]} />
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

          <View style={styles.locationNote}>
            <Icon name="map-pin" size={16} color={colors.forest[400]} />
            <Text style={styles.locationText}>
              {location.latitude
                ? 'Using your current location'
                : 'Location unavailable — using default'}
            </Text>
          </View>

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
  locationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locationText: {
    ...typography.body2,
    color: colors.forest[400],
  },
});
