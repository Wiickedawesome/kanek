import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '@/components/icons';
import { Button, Card } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { supabase } from '@/lib/supabase';
import { safeGoBack } from '@/lib/helpers';
import { MAX_UPLOAD_SIZE } from '@/lib/constants';
import { profilesApi, useGetDriverDetailsQuery, useGetLatestRiderDocumentQuery, useGetMyProfileQuery } from '@/store/api/profilesApi';
import type { AppDispatch, RootState } from '@/store';
import type { ReviewStatus } from '@/types/database';
import { showAlert } from '@/lib/alert';

type DocStatus = 'not_uploaded' | ReviewStatus;

function getStatusLabel(status: DocStatus): string {
  switch (status) {
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected — please re-upload';
    case 'pending': return 'Uploaded — pending review';
    default: return 'Not uploaded';
  }
}

function getStatusColor(status: DocStatus): string {
  switch (status) {
    case 'approved': return colors.accent.green;
    case 'rejected': return colors.error;
    case 'pending': return colors.warning;
    default: return colors.neutral[400];
  }
}

function getActionLabel(status: DocStatus): string {
  return status === 'not_uploaded' ? 'Upload' : 'Replace';
}

interface DocumentCard {
  key: string;
  name: string;
  status: DocStatus;
  reason?: string | null;
  onPress: () => Promise<void>;
}

export default function DocumentsScreen() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const dispatch = useDispatch<AppDispatch>();
  const { data: profile } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const { data: riderDocument, isLoading: riderDocumentLoading } = useGetLatestRiderDocumentQuery(
    userId ?? '',
    { skip: !userId },
  );
  const { data: driverDetails, isLoading: driverDetailsLoading } = useGetDriverDetailsQuery(userId ?? '', { skip: !userId });
  const [uploading, setUploading] = useState<string | null>(null);

  const isDriver = profile?.role === 'driver';

  const invalidateVerificationQueries = useCallback(() => {
    if (!userId) return;
    dispatch(profilesApi.util.invalidateTags([
      { type: 'Profile', id: userId },
      { type: 'RiderDocument', id: userId },
      { type: 'DriverDetails', id: userId },
    ]));
  }, [dispatch, userId]);

  const uploadDocument = useCallback(async (key: string) => {
    if (!userId) return null;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Please allow access to your photo library to upload documents.');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });

    if (result.canceled || !result.assets.length) return null;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_UPLOAD_SIZE) {
      showAlert('File too large', 'Document must be under 5 MB');
      return null;
    }

    const ext = asset.uri.split('.').pop() ?? 'jpg';
    const filePath = `${userId}/${key}-${Date.now()}.${ext}`;

    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    const { error } = await supabase.storage
      .from('documents')
      .upload(filePath, arrayBuffer, {
        contentType: asset.mimeType ?? 'image/jpeg',
        upsert: true,
      });

    if (error) throw error;
    return filePath;
  }, [userId]);

  const handleGovernmentIdUpload = useCallback(async () => {
    if (!userId) return;

    setUploading('government-id');
    try {
      const filePath = await uploadDocument('government-id');
      if (!filePath) return;

      const riderPayload = {
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
          .update(riderPayload)
          .eq('id', riderDocument.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rider_documents').insert({
          user_id: userId,
          ...riderPayload,
        });
        if (error) throw error;
      }

      if (isDriver && driverDetails) {
        const { error } = await supabase
          .from('driver_details')
          .update({
            id_document_url: filePath,
            review_status: 'pending',
            verified: false,
            verified_at: null,
            verified_by: null,
            rejection_reason: null,
          })
          .eq('id', userId);
        if (error) throw error;
      }

      invalidateVerificationQueries();
      showAlert('Uploaded', 'Government ID submitted for review.');
    } catch (error) {
      showAlert('Upload Failed', error instanceof Error ? error.message : 'Could not upload document. Please try again.');
    } finally {
      setUploading(null);
    }
  }, [driverDetails, invalidateVerificationQueries, isDriver, riderDocument, uploadDocument, userId]);

  const handleDriverDocumentUpload = useCallback(async (field: 'license_url' | 'insurance_url') => {
    if (!userId) return;
    if (!driverDetails) {
      router.push('/(auth)/driver-docs');
      return;
    }

    const uploadKey = field === 'license_url' ? 'driver-license' : 'driver-insurance';
    const docLabel = field === 'license_url' ? "Driver's License" : 'Vehicle Insurance';

    setUploading(uploadKey);
    try {
      const filePath = await uploadDocument(uploadKey);
      if (!filePath) return;

      const { error } = await supabase
        .from('driver_details')
        .update({
          ...(field === 'license_url' ? { license_url: filePath } : { insurance_url: filePath }),
          review_status: 'pending',
          verified: false,
          verified_at: null,
          verified_by: null,
          rejection_reason: null,
        })
        .eq('id', userId);

      if (error) throw error;

      invalidateVerificationQueries();
      showAlert('Uploaded', `${docLabel} submitted for review.`);
    } catch (error) {
      showAlert('Upload Failed', error instanceof Error ? error.message : 'Could not upload document. Please try again.');
    } finally {
      setUploading(null);
    }
  }, [driverDetails, invalidateVerificationQueries, uploadDocument, userId]);

  const documents = useMemo<DocumentCard[]>(() => {
    const items: DocumentCard[] = [
      {
        key: 'government-id',
        name: 'Government ID',
        status: riderDocument?.review_status ?? 'not_uploaded',
        reason: riderDocument?.rejection_reason ?? null,
        onPress: handleGovernmentIdUpload,
      },
    ];

    if (isDriver && driverDetails) {
      items.push(
        {
          key: 'driver-license',
          name: "Driver's License",
          status: driverDetails.license_url ? driverDetails.review_status : 'not_uploaded',
          reason: driverDetails.rejection_reason,
          onPress: () => handleDriverDocumentUpload('license_url'),
        },
        {
          key: 'driver-insurance',
          name: 'Vehicle Insurance',
          status: driverDetails.insurance_url ? driverDetails.review_status : 'not_uploaded',
          reason: driverDetails.rejection_reason,
          onPress: () => handleDriverDocumentUpload('insurance_url'),
        },
      );
    }

    return items;
  }, [driverDetails, handleDriverDocumentUpload, handleGovernmentIdUpload, isDriver, riderDocument]);

  if (!profile || riderDocumentLoading || (isDriver && driverDetailsLoading)) {
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
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack('/(tabs)/profile/')} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>My Documents</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          Keep your verification documents up to date here. Replacing a rejected document automatically sends it back for review.
        </Text>

        {isDriver && !driverDetails && (
          <Card style={styles.pendingCard}>
            <Icon name="navigation" size={20} color={colors.accent.green} />
            <View style={styles.pendingCardText}>
              <Text style={styles.pendingCardTitle}>Driver verification is not complete yet</Text>
              <Text style={styles.pendingCardBody}>Finish your driver document submission to unlock license and insurance reviews.</Text>
            </View>
            <Button title="Continue" onPress={() => router.push('/(auth)/driver-docs')} />
          </Card>
        )}

        {documents.map((doc) => {
          const isCurrentlyUploading = uploading === doc.key;

          return (
            <Card key={doc.key} style={styles.docCard}>
              <View style={styles.docInfo}>
                <Icon
                  name={doc.status === 'approved' ? 'circle-dot' : doc.status === 'rejected' ? 'alert-triangle' : 'clipboard-list'}
                  size={20}
                  color={getStatusColor(doc.status)}
                />
                <View style={styles.docText}>
                  <Text style={styles.docName}>{doc.name}</Text>
                  <Text style={[styles.docStatus, { color: getStatusColor(doc.status) }]}> 
                    {getStatusLabel(doc.status)}
                  </Text>
                  {doc.reason ? <Text style={styles.docReason}>{doc.reason}</Text> : null}
                </View>
              </View>
              <Button
                title={isCurrentlyUploading ? 'Uploading...' : getActionLabel(doc.status)}
                variant={doc.status === 'not_uploaded' ? 'primary' : 'outline'}
                onPress={doc.onPress}
                disabled={isCurrentlyUploading}
                style={styles.uploadBtn}
              />
            </Card>
          );
        })}

        {!isDriver && (
          <Card style={styles.driverPromo}>
            <Icon name="navigation" size={24} color={colors.forest[400]} />
            <Text style={styles.promoText}>
              Want to drive? Switch to driver in Account Settings to unlock additional document uploads.
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
    backgroundColor: colors.forest[900],
  },
  headerTitle: { ...typography.h3, color: colors.neutral[0], flex: 1, textAlign: 'center' },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  subtitle: { ...typography.body2, color: colors.forest[400], marginBottom: spacing.sm },

  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pendingCardText: {
    flex: 1,
    gap: spacing.xs,
  },
  pendingCardTitle: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  pendingCardBody: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  docCard: { padding: spacing.lg, gap: spacing.md },
  docInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  docText: { flex: 1 },
  docName: { ...typography.body1Bold, color: colors.forest[900] },
  docStatus: { ...typography.caption, color: colors.neutral[400], marginTop: 2 },
  docReason: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  uploadBtn: { alignSelf: 'flex-start' },

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
