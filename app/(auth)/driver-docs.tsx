import React, { useState, useMemo } from 'react';
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
import { BELIZE_TAXI_ASSOCIATIONS, type TaxiAssociation } from '@/data/taxiAssociations';
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
  const { c, isDark } = useTheme();
  const styles = createStyles(c, isDark);
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

  // Taxi Association states
  const [belongsToAssociation, setBelongsToAssociation] = useState(false);
  const [assocSearch, setAssocSearch] = useState('');
  const [selectedAssociation, setSelectedAssociation] = useState<TaxiAssociation | null>(null);
  const [isCustomAssociation, setIsCustomAssociation] = useState(false);
  const [customAssociationName, setCustomAssociationName] = useState('');
  const [memberId, setMemberId] = useState('');

  const filteredAssociations = useMemo(() => {
    if (!assocSearch.trim()) return BELIZE_TAXI_ASSOCIATIONS.slice(0, 5);
    const q = assocSearch.toLowerCase();
    return BELIZE_TAXI_ASSOCIATIONS.filter(
      (a) => a.name.toLowerCase().includes(q) || a.district.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [assocSearch]);

  const hasUploadedLicense = driverDocs.some(
    (d) => d.document_type === 'drivers_license' && !!d.document_url
  );

  const hasUploadedAssocCard = driverDocs.some(
    (d) => d.document_type === 'taxi_association_card' && !!d.document_url
  );

  const isAssocValid =
    !belongsToAssociation ||
    ((selectedAssociation !== null || customAssociationName.trim().length > 0) &&
      hasUploadedAssocCard);

  const isFormValid =
    vehicle.make.trim() &&
    vehicle.model.trim() &&
    vehicle.year.trim() &&
    vehicle.color.trim() &&
    vehicle.plate.trim() &&
    hasUploadedLicense &&
    isAssocValid;

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

      const finalAssocName = belongsToAssociation
        ? isCustomAssociation
          ? customAssociationName.trim()
          : selectedAssociation?.name ?? null
        : null;

      // Look up DB id for the selected association if available
      let assocId: string | null = null;
      if (finalAssocName) {
        const { data: dbAssoc } = await supabase
          .from('taxi_associations')
          .select('id')
          .eq('name', finalAssocName)
          .maybeSingle();
        if (dbAssoc?.id) {
          assocId = dbAssoc.id;
        }
      }

      const { error } = await supabase.from('driver_details').upsert({
        id: user.id,
        id_document_url: latestRiderDoc?.document_url ?? null,
        vehicle_make: vehicle.make.trim(),
        vehicle_model: vehicle.model.trim(),
        vehicle_year: parseInt(vehicle.year, 10) || 0,
        vehicle_color: vehicle.color.trim(),
        vehicle_plate: vehicle.plate.trim().toUpperCase(),
        taxi_association_id: assocId,
        taxi_association_name: finalAssocName,
        taxi_association_member_id: belongsToAssociation && memberId.trim() ? memberId.trim() : null,
        taxi_association_verified: false,
        taxi_association_verified_at: null,
        taxi_association_verified_by: null,
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

        {/* Taxi Association (Optional) */}
        <Text style={styles.sectionLabel}>Taxi Association & Co-op (Optional)</Text>
        <View style={styles.assocContainer}>
          <Pressable
            style={[styles.assocToggleRow, belongsToAssociation && styles.assocToggleRowActive]}
            onPress={() => setBelongsToAssociation(!belongsToAssociation)}
          >
            <View style={styles.assocToggleLeft}>
              <View style={styles.assocIconWrap}>
                <Icon name="taxi-verified" size={20} color="#F59E0B" />
              </View>
              <View style={styles.assocToggleTextWrap}>
                <Text style={styles.assocToggleTitle}>Belong to a Taxi Association?</Text>
                <Text style={styles.assocToggleSubtitle}>
                  Earn an official golden badge to build trust and get more ride requests.
                </Text>
              </View>
            </View>
            <View style={[styles.checkbox, belongsToAssociation && styles.checkboxActive]}>
              {belongsToAssociation && <Icon name="check" size={14} color="#ffffff" />}
            </View>
          </Pressable>

          {belongsToAssociation && (
            <View style={styles.assocDetailsWrap}>
              {/* Association Selection */}
              {selectedAssociation && !isCustomAssociation ? (
                <View style={styles.selectedAssocCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedAssocName}>{selectedAssociation.name}</Text>
                    <Text style={styles.selectedAssocDistrict}>{selectedAssociation.district}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setSelectedAssociation(null);
                      setAssocSearch('');
                    }}
                    style={styles.changeAssocBtn}
                  >
                    <Text style={styles.changeAssocBtnText}>Change</Text>
                  </Pressable>
                </View>
              ) : isCustomAssociation ? (
                <View style={{ marginBottom: spacing.sm }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter association / stand name"
                    placeholderTextColor={c.textMuted}
                    value={customAssociationName}
                    onChangeText={setCustomAssociationName}
                    maxLength={100}
                  />
                  <Pressable
                    onPress={() => {
                      setIsCustomAssociation(false);
                      setCustomAssociationName('');
                      setAssocSearch('');
                    }}
                    style={{ alignSelf: 'flex-start', marginTop: 2, marginBottom: spacing.xs }}
                  >
                    <Text style={styles.linkText}>Choose from registered list instead</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ marginBottom: spacing.sm }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Search 26 Belize associations (e.g. Airport, Placencia)"
                    placeholderTextColor={c.textMuted}
                    value={assocSearch}
                    onChangeText={setAssocSearch}
                    maxLength={80}
                  />
                  {filteredAssociations.length > 0 && (
                    <View style={styles.suggestionsList}>
                      {filteredAssociations.map((assoc) => (
                        <Pressable
                          key={assoc.name}
                          style={styles.suggestionItem}
                          onPress={() => {
                            setSelectedAssociation(assoc);
                            setAssocSearch('');
                          }}
                        >
                          <Text style={styles.suggestionName} numberOfLines={1}>
                            {assoc.name}
                          </Text>
                          <Text style={styles.suggestionDistrict}>{assoc.district}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <Pressable
                    onPress={() => {
                      setIsCustomAssociation(true);
                      setSelectedAssociation(null);
                      setAssocSearch('');
                    }}
                    style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
                  >
                    <Text style={styles.linkText}>
                      {"Can't find your association? Enter manually"}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Optional Member ID */}
              <TextInput
                style={styles.input}
                placeholder="Member ID / Permit # (Optional)"
                placeholderTextColor={c.textMuted}
                value={memberId}
                onChangeText={setMemberId}
                maxLength={40}
              />

              {/* Mandatory document upload for association decal/card */}
              <Text style={styles.assocDocLabel}>
                Association Card or Vehicle Decal Photo (Required for Badge)
              </Text>
              {user && (
                <DocumentUploadCard
                  userId={user.id}
                  documentType="taxi_association_card"
                  existingDoc={driverDocs.find((d) => d.document_type === 'taxi_association_card') ?? null}
                  onUpsert={async ({ documentUrl, documentNumber, expirationDate }) => {
                    await upsertDriverDoc({
                      profileId: user.id,
                      documentType: 'taxi_association_card',
                      documentUrl,
                      documentNumber: documentNumber || memberId.trim() || null,
                      expirationDate,
                    }).unwrap();
                  }}
                />
              )}

              {!hasUploadedAssocCard && (
                <Text style={styles.missingDocWarning}>
                  * Upload of association card or taxi decal is required to verify your badge.
                </Text>
              )}
            </View>
          )}
        </View>

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

const createStyles = (c: SemanticColors, isDark: boolean) =>
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
    borderWidth: 1,
    borderColor: c.border,
  },
  assocContainer: {
    marginBottom: spacing.lg,
  },
  assocToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.06)',
    borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.20)',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  assocToggleRowActive: {
    borderColor: '#F59E0B',
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.10)',
  },
  assocToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  assocIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.20)' : 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assocToggleTextWrap: {
    flex: 1,
  },
  assocToggleTitle: {
    ...type.bodySm.bold,
    color: c.text,
  },
  assocToggleSubtitle: {
    ...type.caption.regular,
    color: c.textMuted,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
  },
  checkboxActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  assocDetailsWrap: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  selectedAssocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.25)',
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  selectedAssocName: {
    ...type.bodySm.bold,
    color: isDark ? '#FBBF24' : '#D97706',
  },
  selectedAssocDistrict: {
    ...type.caption.regular,
    color: c.textMuted,
    marginTop: 2,
  },
  changeAssocBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  changeAssocBtnText: {
    ...type.caption.medium,
    color: c.text,
  },
  suggestionsList: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.sm,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  suggestionName: {
    ...type.bodySm.medium,
    color: c.text,
  },
  suggestionDistrict: {
    ...type.caption.regular,
    color: c.textMuted,
    marginTop: 1,
  },
  linkText: {
    ...type.caption.regular,
    color: colors.accent.blue,
  },
  assocDocLabel: {
    ...type.caption.semibold,
    color: c.text,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
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
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
});
