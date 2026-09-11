import React, { useState } from 'react';
import {
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { showAlert, showConfirm } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useDispatch, useSelector } from 'react-redux';
import { profilesApi } from '@/store/api/profilesApi';
import { Icon } from '@/components/icons';
import { DocumentUploadCard } from '@/components/forms/DocumentUploadCard';
import { ScreenHeader, Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import {
  useGetDriverDocumentsQuery,
  useUpsertDriverDocumentMutation,
} from '@/store/api/driverDocumentsApi';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import type { AppDispatch, RootState } from '@/store';
import type { DriverDocumentType } from '@/types/database';
import { Text } from '@/components/ui/Text';

const ONBOARDING_DOCS: DriverDocumentType[] = ['drivers_license', 'vehicle_insurance'];

interface VehicleInfo {
  make: string;
  model: string;
  year: string;
  color: string;
  plate: string;
}

export default function DriverDocsScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch<AppDispatch>();
  const { signOut } = useAuth();
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

  const hasUploadedLicense = driverDocs.some(
    (d) => d.document_type === 'drivers_license' && !!d.document_url
  );

  const isFormValid =
    vehicle.make.trim() &&
    vehicle.model.trim() &&
    vehicle.year.trim() &&
    vehicle.color.trim() &&
    vehicle.plate.trim() &&
    hasUploadedLicense;

  const handleExit = async () => {
    if (isSubmitting) return;

    const confirmed = await showConfirm(
      'Go back to sign in?',
      'This will sign you out so you can retry with a different account.',
    );

    if (!confirmed) return;

    await signOut();
    router.replace('/(auth)/login');
  };

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
        vehicle_year: parseInt(vehicle.year, 10) || 0,
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
      <ScreenHeader style={styles.header}>
        <Pressable
          onPress={() => { void handleExit(); }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Exit and sign out"
        >
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Driver Documents</Text>
        <View style={styles.headerSpacer} />
      </ScreenHeader>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Driver documents</Text>
        <Text style={styles.subtitle}>
          Upload your license and insurance, and tell us about your vehicle. You can upload remaining documents later from My Documents.
        </Text>

        <Pressable onPress={() => { void handleExit(); }} style={styles.changeAccount}>
          <Text style={styles.changeAccountText}>Use a different account</Text>
        </Pressable>

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
          placeholderTextColor={c.textMuted}
          value={vehicle.make}
          onChangeText={(t) => setVehicle((v) => ({ ...v, make: t }))}
          maxLength={50}
        />
        <TextInput
          style={styles.input}
          placeholder="Model (e.g. Hilux)"
          placeholderTextColor={c.textMuted}
          value={vehicle.model}
          onChangeText={(t) => setVehicle((v) => ({ ...v, model: t }))}
          maxLength={50}
        />
        <TextInput
          style={styles.input}
          placeholder="Year (e.g. 2019)"
          placeholderTextColor={c.textMuted}
          value={vehicle.year}
          onChangeText={(t) => setVehicle((v) => ({ ...v, year: t }))}
          keyboardType="number-pad"
          maxLength={4}
        />
        <TextInput
          style={styles.input}
          placeholder="Color (e.g. White)"
          placeholderTextColor={c.textMuted}
          value={vehicle.color}
          onChangeText={(t) => setVehicle((v) => ({ ...v, color: t }))}
          maxLength={30}
        />
        <TextInput
          style={styles.input}
          placeholder="License Plate"
          placeholderTextColor={c.textMuted}
          value={vehicle.plate}
          onChangeText={(t) => setVehicle((v) => ({ ...v, plate: t }))}
          autoCapitalize="characters"
          maxLength={20}
        />

        {!hasUploadedLicense && (
          <Text style={styles.missingDocWarning}>
            {"* Driver's license upload is required to continue."}
          </Text>
        )}

        <Button
          title={isSubmitting ? 'Submitting...' : 'Continue'}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!isFormValid || isSubmitting}
        />

        <Text style={styles.note}>
          You can upload remaining documents (vehicle registration) later from My Documents in your profile.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...type.h3.bold,
    color: c.text,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 24,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  title: {
    ...type.h1.bold,
    color: c.text,
  },
  subtitle: {
    ...type.body.regular,
    color: c.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  changeAccount: {
    marginBottom: spacing.xl,
  },
  changeAccountText: {
    ...type.bodySm.regular,
    color: colors.accent.blue,
  },
  sectionLabel: {
    ...type.body.bold,
    color: c.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: c.bg,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...type.body.regular,
    color: c.text,
    marginBottom: spacing.sm,
  },
  note: {
    ...type.caption.regular,
    color: c.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  missingDocWarning: {
    ...type.caption.regular,
    color: colors.warning,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
