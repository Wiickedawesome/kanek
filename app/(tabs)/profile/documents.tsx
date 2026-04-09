import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '@/components/icons';
import { Button, Card, ScreenHeader } from '@/components/ui';
import { DocumentUploadCard } from '@/components/forms/DocumentUploadCard';
import { colors, typography, spacing
} from '@/theme';
import { supabase } from '@/lib/supabase';
import { safeGoBack } from '@/lib/helpers';
import { MAX_UPLOAD_SIZE } from '@/lib/constants';
import {
  useGetLatestRiderDocumentQuery,
  useGetMyProfileQuery,
  profilesApi,
} from '@/store/api/profilesApi';
import {
  useGetDriverDocumentsQuery,
  useUpsertDriverDocumentMutation,
  REQUIRED_DRIVER_DOCS,
  areAllDriverDocsApproved,
  areAllDriverDocsUploaded,
} from '@/store/api/driverDocumentsApi';
import type { RootState } from '@/store';
import type { ReviewStatus } from '@/types/database';
import { showAlert } from '@/lib/alert';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';

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
    default: return colors.neutral[400];
  }
}

export default function DocumentsScreen() {
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
  const [govIdUploading, setGovIdUploading] = useState(false);

  const isDriver = profile?.role === 'driver';
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

      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const filePath = `${userId}/government-id-${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(filePath, arrayBuffer, {
          contentType: asset.mimeType ?? 'image/jpeg',
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
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent.green} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader style={styles.header}>
        <Pressable onPress={() => safeGoBack('/(tabs)/profile/')} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>My Documents</Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

      <ScrollView contentContainerStyle={styles.scrollContent}>
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

        {/* Driver Documents Section */}
        {isDriver && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Driver Documents</Text>
              <Text style={styles.sectionSubtitle}>
                {allDocsApproved
                  ? 'All documents approved'
                  : allDocsUploaded
                    ? `${approvedCount}/${totalRequired} approved — review in progress`
                    : `${approvedCount}/${totalRequired} approved — upload remaining documents`}
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
          </>
        )}

        {/* Promo for riders */}
        {!isDriver && (
          <Card style={styles.driverPromo}>
            <Icon name="navigation" size={24} color={colors.forest[400]} />
            <Text style={styles.promoText}>
              Want to drive? Switch to driver in Account Settings — you'll need to upload and get all driver documents approved first.
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.h3, color: colors.neutral[0], flex: 1, textAlign: 'center' },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  subtitle: { ...typography.body2, color: colors.forest[400], marginBottom: spacing.sm },

  govIdCard: { padding: spacing.lg, gap: spacing.md },
  govIdInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  docName: { ...typography.body1Bold, color: colors.forest[900] },
  statusText: { ...typography.caption, marginTop: 2 },
  rejectionText: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  uploadBtn: { alignSelf: 'flex-start' },

  sectionHeader: { gap: spacing.xs, marginTop: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.forest[900] },
  sectionSubtitle: { ...typography.body2, color: colors.forest[400] },

  driverPromo: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.forest[400],
    borderStyle: 'dashed',
  },
  promoText: { ...typography.body2, color: colors.forest[400], flex: 1 },
});
