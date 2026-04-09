import React, { useState } from 'react';
import {
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useDispatch, useSelector } from 'react-redux';
import { profilesApi } from '@/store/api/profilesApi';
import { DocumentUploadCard } from '@/components/forms/DocumentUploadCard';
import {
  useGetDriverDocumentsQuery,
  useUpsertDriverDocumentMutation,
} from '@/store/api/driverDocumentsApi';
import { colors, typography, spacing, borderRadius } from '@/theme';
import type { AppDispatch, RootState } from '@/store';
import type { DriverDocumentType } from '@/types/database';

const ONBOARDING_DOCS: DriverDocumentType[] = ['drivers_license', 'vehicle_insurance'];

interface VehicleInfo {
  make: string;
  model: string;
  year: string;
  color: string;
  plate: string;
}

export default function DriverDocsScreen() {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch<AppDispatch>();
  const { data: driverDocs = [] } = useGetDriverDocumentsQuery(
    user?.id ?? '',
    { skip: !user?.id },
  );
  const [upsertDriverDoc] = useUpsertDriverDocumentMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleInfo>({
    make: '',
    model: '',
    year: '',
    color: '',
    plate: '',
  });

  const isFormValid =
    vehicle.make.trim() &&
    vehicle.model.trim() &&
    vehicle.year.trim() &&
    vehicle.color.trim() &&
    vehicle.plate.trim();

  const handleSubmit = async () => {
    if (!isFormValid || !user) return;
    setIsSubmitting(true);

    try {
      const { data: latestRiderDoc } = await supabase
        .from('rider_documents')
        .select('document_url')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await supabase.from('driver_details').upsert({
        id: user.id,
        id_document_url: latestRiderDoc?.document_url ?? null,
        vehicle_make: vehicle.make.trim(),
        vehicle_model: vehicle.model.trim(),
        vehicle_year: parseInt(vehicle.year, 10),
        vehicle_color: vehicle.color.trim(),
        vehicle_plate: vehicle.plate.trim().toUpperCase(),
        verified: false,
        verified_at: null,
        verified_by: null,
        rejection_reason: null,
        review_status: 'pending',
      });

      if (error) throw error;

      dispatch(profilesApi.util.invalidateTags([
        { type: 'DriverDetails', id: user.id },
      ]));

      router.replace('/(tabs)/explore');
    } catch (err) {
      showAlert('Submission failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Driver documents</Text>
        <Text style={styles.subtitle}>
          Upload your license and insurance, and tell us about your vehicle. You can upload remaining documents later from My Documents.
        </Text>

        {/* Document uploads via DocumentUploadCard */}
        {user && ONBOARDING_DOCS.map((docType) => {
          const existingDoc = driverDocs.find((d) => d.document_type === docType) ?? null;
          return (
            <View key={docType} style={styles.cardWrapper}>
              <DocumentUploadCard
                userId={user.id}
                documentType={docType}
                existingDoc={existingDoc}
                onUpsert={async ({ documentUrl, documentNumber, expirationDate }) => {
                  await upsertDriverDoc({
                    profileId: user.id,
                    documentType: docType,
                    documentUrl,
                    documentNumber,
                    expirationDate,
                  }).unwrap();
                }}
              />
            </View>
          );
        })}

        {/* Vehicle info */}
        <Text style={styles.sectionLabel}>Vehicle Information</Text>

        <TextInput
          style={styles.input}
          placeholder="Make (e.g. Toyota)"
          placeholderTextColor={colors.neutral[400]}
          value={vehicle.make}
          onChangeText={(t) => setVehicle((v) => ({ ...v, make: t }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Model (e.g. Hilux)"
          placeholderTextColor={colors.neutral[400]}
          value={vehicle.model}
          onChangeText={(t) => setVehicle((v) => ({ ...v, model: t }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Year (e.g. 2019)"
          placeholderTextColor={colors.neutral[400]}
          value={vehicle.year}
          onChangeText={(t) => setVehicle((v) => ({ ...v, year: t }))}
          keyboardType="number-pad"
          maxLength={4}
        />
        <TextInput
          style={styles.input}
          placeholder="Color (e.g. White)"
          placeholderTextColor={colors.neutral[400]}
          value={vehicle.color}
          onChangeText={(t) => setVehicle((v) => ({ ...v, color: t }))}
        />
        <TextInput
          style={styles.input}
          placeholder="License Plate"
          placeholderTextColor={colors.neutral[400]}
          value={vehicle.plate}
          onChangeText={(t) => setVehicle((v) => ({ ...v, plate: t }))}
          autoCapitalize="characters"
        />

        <Pressable
          style={[styles.button, (!isFormValid || isSubmitting) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!isFormValid || isSubmitting}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Submitting...' : 'Continue'}
          </Text>
        </Pressable>

        <Text style={styles.note}>
          You can upload remaining documents (vehicle registration, police record) later from My Documents in your profile.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
  },
  title: {
    ...typography.h1,
    color: colors.forest[900],
  },
  subtitle: {
    ...typography.body1,
    color: colors.neutral[500],
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.body1Bold,
    color: colors.forest[900],
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body1,
    color: colors.forest[900],
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.forest[600],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    ...typography.body1Bold,
    color: colors.neutral[0],
  },
  note: {
    ...typography.caption,
    color: colors.neutral[400],
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
