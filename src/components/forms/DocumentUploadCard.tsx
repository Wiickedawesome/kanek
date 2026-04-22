import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Icon, type IconName } from '@/components/icons';
import { Button, Card } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { supabase } from '@/lib/supabase';
import { MAX_UPLOAD_SIZE } from '@/lib/constants';
import { showAlert } from '@/lib/alert';
import type { DriverDocumentType, ReviewStatus , Database } from '@/types/database';
import { DRIVER_DOC_LABELS } from '@/store/api/driverDocumentsApi';

type DriverDocumentRow = Database['public']['Tables']['driver_documents']['Row'];

interface Props {
  userId: string;
  documentType: DriverDocumentType;
  existingDoc: DriverDocumentRow | null;
  onUpsert: (args: {
    documentUrl: string;
    documentNumber: string | null;
    expirationDate: string | null;
  }) => Promise<void>;
}

function getStatusLabel(status: ReviewStatus | 'not_uploaded'): string {
  switch (status) {
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected — please re-upload';
    case 'pending': return 'Pending review';
    default: return 'Not uploaded';
  }
}

function getStatusColor(status: ReviewStatus | 'not_uploaded'): string {
  switch (status) {
    case 'approved': return colors.accent.green;
    case 'rejected': return colors.error;
    case 'pending': return colors.warning;
    default: return colors.neutral[400];
  }
}

function getStatusIcon(status: ReviewStatus | 'not_uploaded'): IconName {
  switch (status) {
    case 'approved': return 'circle-dot';
    case 'rejected': return 'alert-triangle';
    case 'pending': return 'clock';
    default: return 'clipboard-list';
  }
}

/** Whether this doc type requires an expiration date */
function requiresExpiration(_type: DriverDocumentType): boolean {
  return true;
}

/** Convert DD/MM/YYYY → YYYY-MM-DD for storage */
function toISODate(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert YYYY-MM-DD → DD/MM/YYYY for display */
function toDisplayDate(isoDate: string): string {
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

/** Label for the document number field */
function numberFieldLabel(type: DriverDocumentType): string {
  switch (type) {
    case 'drivers_license': return 'License Number';
    case 'vehicle_insurance': return 'Policy Number';
    case 'vehicle_registration': return 'Registration Number';
    case 'police_record': return 'Record Number';
  }
}

export function DocumentUploadCard({ userId, documentType, existingDoc, onUpsert }: Props) {
  const status: ReviewStatus | 'not_uploaded' = existingDoc?.review_status ?? 'not_uploaded';
  const [expanded, setExpanded] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [docNumber, setDocNumber] = useState(existingDoc?.document_number ?? '');
  const [expirationDate, setExpirationDate] = useState(
    existingDoc?.expiration_date ? toDisplayDate(existingDoc.expiration_date) : '',
  );
  const [uploading, setUploading] = useState(false);

  const label = DRIVER_DOC_LABELS[documentType];

  const pickImage = useCallback(async (useCamera: boolean) => {
    // On web, browser handles permissions natively — skip expo permission check
    if (Platform.OS !== 'web') {
      const permRequest = useCamera
        ? ImagePicker.requestCameraPermissionsAsync
        : ImagePicker.requestMediaLibraryPermissionsAsync;

      const { status: perm } = await permRequest();
      if (perm !== 'granted') {
        showAlert('Permission needed', `Please allow ${useCamera ? 'camera' : 'photo library'} access.`);
        return;
      }
    }

    const launcher = useCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await launcher({
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

    setImageUri(asset.uri);
    if (!expanded) setExpanded(true);
  }, [expanded]);

  const handleSubmit = useCallback(async () => {
    if (!imageUri && !existingDoc) {
      showAlert('Missing photo', 'Please take or select a photo of the document.');
      return;
    }

    if (requiresExpiration(documentType) && !expirationDate.trim()) {
      showAlert('Missing expiration', 'Please enter the expiration date.');
      return;
    }

    // Validate date format DD/MM/YYYY
    if (expirationDate.trim()) {
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      if (!dateRegex.test(expirationDate.trim())) {
        showAlert('Invalid date', 'Expiration date must be DD/MM/YYYY format.');
        return;
      }
    }

    setUploading(true);
    try {
      let documentUrl = existingDoc?.document_url ?? '';

      if (imageUri) {
        // Upload new image
        const ext = imageUri.split('.').pop() ?? 'jpg';
        const filePath = `${userId}/${documentType}-${Date.now()}.${ext}`;

        const response = await fetch(imageUri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        const { error } = await supabase.storage
          .from('documents')
          .upload(filePath, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (error) throw error;
        documentUrl = filePath;
      }

      await onUpsert({
        documentUrl,
        documentNumber: docNumber.trim() || null,
        expirationDate: expirationDate.trim() ? toISODate(expirationDate.trim()) : null,
      });

      setImageUri(null);
      setExpanded(false);
      showAlert('Submitted', `${label} submitted for review.`);
    } catch (err) {
      showAlert('Upload failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  }, [imageUri, existingDoc, documentType, expirationDate, userId, onUpsert, docNumber, label]);

  const showExpirationWarning = existingDoc?.expiration_date && new Date(existingDoc.expiration_date) < new Date();

  return (
    <Card style={styles.card}>
      {/* Header row — always visible */}
      <Pressable style={styles.headerRow} onPress={() => setExpanded(!expanded)}>
        <Icon
          name={getStatusIcon(status)}
          size={20}
          color={getStatusColor(status)}
        />
        <View style={styles.headerText}>
          <Text style={styles.docName}>{label}</Text>
          <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
            {getStatusLabel(status)}
          </Text>
          {existingDoc?.expiration_date && (
            <Text style={[styles.expText, showExpirationWarning && styles.expExpired]}>
              Expires: {toDisplayDate(existingDoc.expiration_date)}
            </Text>
          )}
          {existingDoc?.rejection_reason && (
            <Text style={styles.rejectionText}>{existingDoc.rejection_reason}</Text>
          )}
        </View>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.forest[400]}
        />
      </Pressable>

      {/* Expanded form */}
      {expanded && (
        <View style={styles.formArea}>
          {/* Image preview / capture */}
          {imageUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <Pressable style={styles.removeBtn} onPress={() => setImageUri(null)}>
                <Icon name="x" size={16} color={colors.neutral[0]} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.captureRow}>
              <Pressable style={styles.captureBtn} onPress={() => pickImage(true)}>
                <Icon name="circle-dot" size={24} color={colors.forest[600]} />
                <Text style={styles.captureBtnText}>Take Photo</Text>
              </Pressable>
              <Pressable style={styles.captureBtn} onPress={() => pickImage(false)}>
                <Icon name="external-link" size={24} color={colors.forest[600]} />
                <Text style={styles.captureBtnText}>Gallery</Text>
              </Pressable>
            </View>
          )}

          {/* Document number */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{numberFieldLabel(documentType)}</Text>
            <TextInput
              style={styles.input}
              value={docNumber}
              onChangeText={setDocNumber}
              placeholder="Optional"
              placeholderTextColor={colors.neutral[400]}
              autoCapitalize="characters"
              maxLength={30}
            />
          </View>

          {/* Expiration date */}
          {requiresExpiration(documentType) && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Expiration Date</Text>
              <TextInput
                style={styles.input}
                value={expirationDate}
                onChangeText={setExpirationDate}
              placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.neutral[400]}
                keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
                maxLength={10}
              />
            </View>
          )}

          {/* Submit */}
          <Button
            title={uploading ? 'Submitting...' : existingDoc ? 'Replace & Resubmit' : 'Submit for Review'}
            onPress={handleSubmit}
            disabled={uploading || (!imageUri && !existingDoc)}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  docName: { ...typography.body1Bold, color: colors.forest[900] },
  statusText: { ...typography.caption, marginTop: 2 },
  expText: { ...typography.caption, color: colors.forest[400], marginTop: 2 },
  expExpired: { color: colors.error },
  rejectionText: { ...typography.caption, color: colors.error, marginTop: spacing.xs },

  formArea: { marginTop: spacing.lg, gap: spacing.md },

  previewContainer: { position: 'relative' },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[200],
  },
  removeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: borderRadius.pill,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  captureRow: { flexDirection: 'row', gap: spacing.md },
  captureBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderStyle: 'dashed',
    backgroundColor: colors.neutral[100],
  },
  captureBtnText: { ...typography.caption, color: colors.forest[600] },

  field: { gap: spacing.xs },
  fieldLabel: { ...typography.body2Bold, color: colors.forest[400] },
  input: {
    ...typography.body1,
    color: colors.forest[900],
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  hint: { ...typography.caption, color: colors.forest[400], fontStyle: 'italic' },
});
