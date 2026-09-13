import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector , useDispatch } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '@/components/icons';
import { Button, Card, ScreenHeader, ScreenLoader, useFloatingTabBarPad } from '@/components/ui';
import { DocumentUploadCard } from '@/components/forms/DocumentUploadCard';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { supabase } from '@/lib/supabase';
import { safeGoBack } from '@/lib/helpers';
import { MAX_UPLOAD_SIZE } from '@/lib/constants';
import { readUploadFile, getSafeUploadExtension } from '@/lib/uploadFile';
import {
  useGetLatestRiderDocumentQuery,
  useGetMyProfileQuery,
  useGetDriverDetailsQuery,
  profilesApi,
  useUpdateTaxiAssociationMutation,
} from '@/store/api/profilesApi';
import { BELIZE_TAXI_ASSOCIATIONS } from '@/data/taxiAssociations';
import {
  useGetDriverDocumentsQuery,
  useUpsertDriverDocumentMutation,
  REQUIRED_DRIVER_DOCS,
  areAllDriverDocsApproved,
  areAllDriverDocsUploaded,
} from '@/store/api/driverDocumentsApi';
import type { RootState , AppDispatch } from '@/store';
import type { ReviewStatus } from '@/types/database';
import { showAlert } from '@/lib/alert';
import { Text } from '@/components/ui/Text';

function getGovIdStatusLabel(status: ReviewStatus | 'not_uploaded'): string {
  switch (status) {
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected — please re-upload';
    case 'pending': return 'Pending review';
    default: return 'Not uploaded';
  }
}

function getGovIdStatusColor(status: ReviewStatus | 'not_uploaded'): string {
  switch (status) {
    case 'approved': return colors.accent.green;
    case 'rejected': return colors.error;
    case 'pending': return colors.warning;
    default: return '#6b7264';
  }
}

export default function DocumentsScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const tabBarPad = useFloatingTabBarPad();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const dispatch = useDispatch<AppDispatch>();
  const { data: profile } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const { data: riderDocument, isLoading: riderDocLoading } = useGetLatestRiderDocumentQuery(
    userId ?? '',
    { skip: !userId },
  );
  const { data: driverDocs = [], isLoading: driverDocsLoading } = useGetDriverDocumentsQuery(
    userId ?? '',
    { skip: !userId },
  );
  const [upsertDriverDoc] = useUpsertDriverDocumentMutation();
  const [updateTaxiAssociation] = useUpdateTaxiAssociationMutation();
  const [govIdUploading, setGovIdUploading] = useState(false);
  const { data: driverDetails } = useGetDriverDetailsQuery(userId ?? '', { skip: !userId });

  // Taxi affiliation manager state
  const [assocExpanded, setAssocExpanded] = useState(false);
  const [assocSearch, setAssocSearch] = useState('');
  const [assocMemberId, setAssocMemberId] = useState('');
  const [assocSaving, setAssocSaving] = useState(false);

  const isDriver = profile?.role === 'driver';
  const currentAssoc = driverDetails?.taxi_association_name ?? null;
  const assocVerified = driverDetails?.taxi_association_verified ?? false;
  const existingAssocCard = driverDocs.find((d) => d.document_type === 'taxi_association_card') ?? null;

  const filteredAssociations = useMemo(() => {
    const q = assocSearch.trim().toLowerCase();
    if (!q) return BELIZE_TAXI_ASSOCIATIONS;
    return BELIZE_TAXI_ASSOCIATIONS.filter(
      (a) => a.name.toLowerCase().includes(q) || a.district.toLowerCase().includes(q),
    );
  }, [assocSearch]);

  const handleSaveAssociation = useCallback(async (associationName: string | null, associationId: string | null) => {
    if (!userId) return;
    setAssocSaving(true);
    try {
      await updateTaxiAssociation({
        associationName,
        associationId,
        memberId: associationName ? assocMemberId.trim() || null : null,
      }).unwrap();
      setAssocExpanded(false);
      setAssocSearch('');
      setAssocMemberId('');
      showAlert(
        'Affiliation Updated',
        associationName
          ? `Affiliation set to "${associationName}". Verification was reset — an admin will re-review.`
          : 'Taxi affiliation removed. Verification badge cleared.',
      );
    } catch (err) {
      showAlert('Update Failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setAssocSaving(false);
    }
  }, [assocMemberId, updateTaxiAssociation, userId]);
  const govIdStatus: ReviewStatus | 'not_uploaded' = riderDocument?.review_status ?? 'not_uploaded';

  // Summary for drivers
  const approvedCount = driverDocs.filter((d) => d.review_status === 'approved').length;
  const totalRequired = REQUIRED_DRIVER_DOCS.length;
  const allDocsApproved = areAllDriverDocsApproved(driverDocs);
  const allDocsUploaded = areAllDriverDocsUploaded(driverDocs);

  const handleGovernmentIdUpload = useCallback(async () => {
    if (!userId) return;

    setGovIdUploading(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission needed', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_UPLOAD_SIZE) {
        showAlert('File too large', 'Document must be under 5 MB.');
        return;
      }

      const { arrayBuffer, mimeType } = await readUploadFile(asset.uri, asset.mimeType);
      const ext = getSafeUploadExtension(asset.uri, mimeType);
      const filePath = `${userId}/government-id-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(filePath, arrayBuffer, {
          contentType: mimeType || 'image/jpeg',
          upsert: true,
        });
      if (uploadErr) throw uploadErr;

      const payload = {
        document_url: filePath,
        verified: false,
        review_status: 'pending' as ReviewStatus,
        reviewed_by: null,
        rejection_reason: null,
        uploaded_at: new Date().toISOString(),
      };

      if (riderDocument) {
        const { error } = await supabase
          .from('rider_documents')
          .update(payload)
          .eq('id', riderDocument.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rider_documents').insert({
          user_id: userId,
          ...payload,
        });
        if (error) throw error;
      }

      dispatch(profilesApi.util.invalidateTags([
        { type: 'RiderDocument', id: userId },
      ]));
      showAlert('Uploaded', 'Government ID submitted for review.');
    } catch (err) {
      showAlert('Upload Failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setGovIdUploading(false);
    }
  }, [dispatch, riderDocument, userId]);

  if (!profile || riderDocLoading || driverDocsLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ScreenLoader />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="My Documents" onBack={() => safeGoBack('/(tabs)/profile/')} />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPad }]}>
        <Text style={styles.subtitle}>
          Keep your verification documents up to date here. Replacing a rejected document automatically sends it back for review.
        </Text>

        {/* Government ID — required for everyone */}
        <Card style={styles.govIdCard}>
          <View style={styles.govIdInfo}>
            <Icon
              name={govIdStatus === 'approved' ? 'circle-dot' : govIdStatus === 'rejected' ? 'alert-triangle' : 'clipboard-list'}
              size={20}
              color={getGovIdStatusColor(govIdStatus)}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.docName}>Government ID</Text>
              <Text style={[styles.statusText, { color: getGovIdStatusColor(govIdStatus) }]}>
                {getGovIdStatusLabel(govIdStatus)}
              </Text>
              {riderDocument?.rejection_reason && (
                <Text style={styles.rejectionText}>{riderDocument.rejection_reason}</Text>
              )}
            </View>
          </View>
          <Button
            title={govIdUploading ? 'Uploading...' : govIdStatus === 'not_uploaded' ? 'Upload' : 'Replace'}
            variant={govIdStatus === 'not_uploaded' ? 'primary' : 'outline'}
            onPress={handleGovernmentIdUpload}
            disabled={govIdUploading}
            style={styles.uploadBtn}
          />
        </Card>

        {/* Driver Documents Section — visible to all users */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Driver Documents</Text>
          <Text style={styles.sectionSubtitle}>
            {allDocsApproved
              ? 'All documents approved'
              : allDocsUploaded
                ? `${approvedCount}/${totalRequired} approved — review in progress`
                : isDriver
                  ? `${approvedCount}/${totalRequired} approved — upload remaining documents`
                  : 'Upload these to become a driver'}
          </Text>
        </View>

        {REQUIRED_DRIVER_DOCS.map((docType) => {
          const existingDoc = driverDocs.find((d) => d.document_type === docType) ?? null;
          return (
            <DocumentUploadCard
              key={docType}
              userId={userId!}
              documentType={docType}
              existingDoc={existingDoc}
              onUpsert={async ({ documentUrl, documentNumber, expirationDate }) => {
                await upsertDriverDoc({
                  profileId: userId!,
                  documentType: docType,
                  documentUrl,
                  documentNumber,
                  expirationDate,
                }).unwrap();
              }}
            />
          );
        })}

        {/* Taxi Association manager — drivers only */}
        {isDriver && (
          <Card style={styles.assocCard}>
            <View style={styles.assocHeader}>
              <View style={styles.govIdInfo}>
                <Icon
                  name="taxi-verified"
                  size={20}
                  color={currentAssoc ? (assocVerified ? '#F59E0B' : colors.warning) : '#6b7264'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>Taxi Association</Text>
                  <Text style={[styles.statusText, { color: currentAssoc ? (assocVerified ? '#F59E0B' : colors.warning) : '#6b7264' }]}>
                    {!currentAssoc
                      ? 'Not affiliated — optional'
                      : assocVerified
                        ? `${currentAssoc} — Verified`
                        : `${currentAssoc} — In review`}
                  </Text>
                </View>
              </View>
              <Button
                title={currentAssoc ? 'Change / Remove' : 'Add'}
                variant={currentAssoc ? 'outline' : 'primary'}
                onPress={() => setAssocExpanded((v) => !v)}
                style={styles.uploadBtn}
              />
            </View>

            {assocExpanded && (
              <View style={styles.assocEditor}>
                {currentAssoc && (
                  <Pressable
                    style={styles.assocRemoveBtn}
                    disabled={assocSaving}
                    onPress={() => handleSaveAssociation(null, null)}
                  >
                    <Text style={styles.assocRemoveText}>Remove affiliation (clears badge)</Text>
                  </Pressable>
                )}
                <Text style={styles.assocHint}>Search your association or co-op:</Text>
                <TextInput
                  style={styles.assocSearchInput}
                  placeholder="Search by name or district"
                  placeholderTextColor="#6b7264"
                  value={assocSearch}
                  onChangeText={setAssocSearch}
                  maxLength={100}
                />
                <ScrollView
                  style={styles.assocList}
                  nestedScrollEnabled
                >
                  {filteredAssociations.map((a) => (
                    <Pressable
                      key={a.name}
                      style={styles.assocRow}
                      disabled={assocSaving}
                      onPress={() => handleSaveAssociation(a.name, null)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.assocRowName}>{a.name}</Text>
                        <Text style={styles.assocRowDistrict}>{a.district}</Text>
                      </View>
                      {currentAssoc === a.name && (
                        <Icon name="circle-dot" size={14} color={colors.accent.green} />
                      )}
                    </Pressable>
                  ))}
                  {filteredAssociations.length === 0 && (
                    <Pressable
                      style={styles.assocRow}
                      disabled={assocSaving}
                      onPress={() =>
                        handleSaveAssociation(assocSearch.trim(), null)
                      }
                    >
                      <Text style={styles.assocRowName}>
                        Use custom: &quot;{assocSearch.trim()}&quot;
                      </Text>
                    </Pressable>
                  )}
                </ScrollView>
                <TextInput
                  style={styles.assocSearchInput}
                  placeholder="Member ID / Permit number (optional)"
                  placeholderTextColor="#6b7264"
                  value={assocMemberId}
                  onChangeText={setAssocMemberId}
                  maxLength={50}
                />
                <Text style={styles.assocHint}>
                  Changing or removing your affiliation resets verification — an admin will re-review
                  your taxi card.
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Taxi association card upload — only when affiliated (or already uploaded) */}
        {(isDriver && currentAssoc) && (
          <DocumentUploadCard
            key="taxi_association_card"
            userId={userId!}
            documentType="taxi_association_card"
            existingDoc={existingAssocCard}
            onUpsert={async ({ documentUrl, documentNumber, expirationDate }) => {
              await upsertDriverDoc({
                profileId: userId!,
                documentType: 'taxi_association_card',
                documentUrl,
                documentNumber,
                expirationDate,
              }).unwrap();
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...type.h3.bold, color: c.text, flex: 1, textAlign: 'center' },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.lg },
  subtitle: { ...type.bodySm.regular, color: c.textMuted, marginBottom: spacing.sm },

  govIdCard: { padding: spacing.lg, gap: spacing.md },
  govIdInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  docName: { ...type.body.bold, color: c.text },
  statusText: { ...type.caption.regular, marginTop: 2 },
  rejectionText: { ...type.caption.regular, color: colors.error, marginTop: spacing.xs },
  uploadBtn: { alignSelf: 'flex-start' },

  sectionHeader: { gap: spacing.xs, marginTop: spacing.sm },
  sectionTitle: { ...type.h3.bold, color: c.text },
  sectionSubtitle: { ...type.bodySm.regular, color: c.textMuted },

  assocCard: { padding: spacing.lg, gap: spacing.md },
  assocHeader: { gap: spacing.md },
  assocEditor: { gap: spacing.sm },
  assocRemoveBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  assocRemoveText: { ...type.caption.regular, color: colors.error },
  assocHint: { ...type.caption.regular, color: c.textMuted },
  assocSearchInput: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...type.body.regular,
    color: c.text,
    backgroundColor: c.bg,
  },
  assocList: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.sm,
    maxHeight: 220,
  },
  assocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  assocRowName: { ...type.body.regular, color: c.text },
  assocRowDistrict: { ...type.caption.regular, color: c.textMuted },
});
