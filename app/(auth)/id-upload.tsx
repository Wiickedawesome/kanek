import React, { useState } from 'react';
import { Image, StyleSheet, Pressable, ScrollView, Platform, View } from 'react-native';
import { showAlert, showConfirm } from '@/lib/alert';
import { MAX_UPLOAD_SIZE } from '@/lib/constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useDispatch, useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { ScreenHeader, Button } from '@/components/ui';
import { readUploadFile } from '@/lib/uploadFile';
import { useAuth } from '@/hooks/useAuth';
import { profilesApi, useGetMyProfileQuery, useGetLatestRiderDocumentQuery, useDeleteAccountMutation } from '@/store/api/profilesApi';
import { CameraCapture, type CameraFacing } from '@/components/CameraCapture';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import type { AppDispatch, RootState } from '@/store';
import type { BelizeDistrict } from '@/types/database';
import { Text } from '@/components/ui/Text';

const BELIZE_DISTRICTS: { value: BelizeDistrict; label: string }[] = [
  { value: 'belize', label: 'Belize' },
  { value: 'cayo', label: 'Cayo' },
  { value: 'corozal', label: 'Corozal' },
  { value: 'orange_walk', label: 'Orange Walk' },
  { value: 'stann_creek', label: 'Stann Creek' },
  { value: 'toledo', label: 'Toledo' },
];

export default function IdUploadScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const [idUri, setIdUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [district, setDistrict] = useState<BelizeDistrict | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [webCamera, setWebCamera] = useState<{ facing: CameraFacing; target: 'id' | 'selfie' } | null>(null);
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch<AppDispatch>();
  const { signOut } = useAuth();
  const { data: profile } = useGetMyProfileQuery(user?.id ?? '', { skip: !user?.id });
  const { data: latestRiderDoc } = useGetLatestRiderDocumentQuery(user?.id ?? '', {
    skip: !user?.id,
  });
  const [deleteAccount] = useDeleteAccountMutation();
  const hasSubmittedBefore = !!latestRiderDoc;

  const handleBack = () => {
    if (isUploading) return;
    // Pre-submit: photos are local state only — going back is lossless.
    router.replace('/(auth)/role-select');
  };

  const handleExit = async () => {
    if (isUploading) return;

    // Pre-submit: nothing was written yet — a plain sign-out is enough.
    if (!hasSubmittedBefore) {
      const confirmed = await showConfirm(
        'Use a different account?',
        'You will be signed out. Your account is kept.',
      );
      if (!confirmed) return;
      await signOut();
      router.replace('/(auth)/login');
      return;
    }

    // Post-submit (re-uploading after rejection): offer Cancel Application —
    // soft-deletes the signup draft; user has 90 days to sign back in.
    const confirmed = await showConfirm(
      'Cancel application?',
      'Your submitted documents will be removed and your account marked for deletion. You have 90 days to change your mind by signing back in.',
    );
    if (!confirmed) return;

    try {
      await deleteAccount().unwrap();
      await signOut();
      router.replace('/(auth)/welcome');
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'Could not cancel application.');
    }
  };

  const requestCamera = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true; // Permission is requested inline by getUserMedia
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Camera access is required');
      return false;
    }
    return true;
  };

  const takeIdPhoto = async () => {
    if (!(await requestCamera())) return;
    if (Platform.OS === 'web') {
      setWebCamera({ facing: 'back', target: 'id' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      mediaTypes: ['images'],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_UPLOAD_SIZE) {
        showAlert('File too large', 'Image must be under 5 MB');
        return;
      }
      setIdUri(asset.uri);
    }
  };

  const takeSelfie = async () => {
    if (!(await requestCamera())) return;
    if (Platform.OS === 'web') {
      setWebCamera({ facing: 'front', target: 'selfie' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      cameraType: ImagePicker.CameraType.front,
      mediaTypes: ['images'],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_UPLOAD_SIZE) {
        showAlert('File too large', 'Image must be under 5 MB');
        return;
      }
      setSelfieUri(asset.uri);
    }
  };

  const handleWebCapture = (dataUrl: string) => {
    if (!webCamera) return;
    if (webCamera.target === 'id') setIdUri(dataUrl);
    else setSelfieUri(dataUrl);
    setWebCamera(null);
  };

  const uploadImage = async (uri: string, path: string): Promise<boolean> => {
    try {
      const { arrayBuffer, mimeType } = await readUploadFile(uri, 'image/jpeg');

      const { error } = await supabase.storage
        .from('documents')
        .upload(path, arrayBuffer, {
          contentType: mimeType || 'image/jpeg',
          upsert: true,
        });

      if (error) {
        showAlert('Upload failed', error.message);
        return false;
      }

      return true;
    } catch (error) {
      showAlert('Upload failed', error instanceof Error ? error.message : 'Please try again.');
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!idUri || !selfieUri || !user || !profile || !district) return;
    setIsUploading(true);

    const idPath = `${user.id}/id-${Date.now()}.jpg`;
    const selfiePath = `${user.id}/selfie-${Date.now()}.jpg`;

    try {
      setUploadStatus('Uploading ID photo...');
      const idOk = await uploadImage(idUri, idPath);
      if (!idOk) return;

      setUploadStatus('Uploading selfie...');
      const selfieOk = await uploadImage(selfieUri, selfiePath);
      if (!selfieOk) return;

      setUploadStatus('Saving verification record...');
      const { error: docError } = await supabase.from('rider_documents').insert({
        user_id: user.id,
        document_url: idPath,
      });

      if (docError) {
        showAlert('Error', docError.message);
        return;
      }

      // Persist the chosen district on the profile so the feed, map, and
      // admin can use it for riders and drivers alike.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ district })
        .eq('id', user.id);

      if (profileError) {
        showAlert('Error', `Could not save your district: ${profileError.message}`);
        return;
      }

      dispatch(profilesApi.util.invalidateTags([
        { type: 'Profile', id: user.id },
        { type: 'RiderDocument', id: user.id },
      ]));

      // Refetch the profile directly from the DB — the Redux cache can be up
      // to 300s stale (keepUnusedDataFor), and the driver branch depends on
      // the fresh role set in role-select.
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const resolvedRole = freshProfile?.role ?? profile.role;

      if (resolvedRole === 'driver') {
        router.push('/(auth)/driver-docs');
      } else {
        router.replace('/(tabs)/explore');
      }
    } finally {
      setIsUploading(false);
      setUploadStatus(null);
    }
  };

  const canSubmit = idUri && selfieUri && district && profile && !isUploading;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to role selection"
        >
          <Icon name="chevron-left" size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Identity Verification</Text>
        <View style={styles.headerSpacer} />
      </ScreenHeader>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Text style={styles.title}>Verify your identity</Text>
        <Text style={styles.subtitle}>
          Take a photo of your government-issued ID and a selfie. Both are required.
        </Text>

        <Pressable onPress={() => { void handleExit(); }} style={styles.changeAccount}>
          <Text style={styles.changeAccountText}>Use a different account</Text>
        </Pressable>

        {/* ID Photo */}
        <Text style={styles.sectionLabel}>Government ID</Text>
        {idUri ? (
          <Pressable onPress={takeIdPhoto} style={styles.preview}>
            <Image source={{ uri: idUri }} style={styles.previewImage} />
            <Text style={styles.changeText}>Tap to retake</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.captureCard} onPress={takeIdPhoto}>
            <Icon name="receipt" size={32} color={c.textMuted} />
            <Text style={styles.captureLabel}>Take ID Photo</Text>
          </Pressable>
        )}

        {/* Selfie */}
        <Text style={styles.sectionLabel}>Selfie</Text>
        {selfieUri ? (
          <Pressable onPress={takeSelfie} style={styles.preview}>
            <Image source={{ uri: selfieUri }} style={styles.previewImage} />
            <Text style={styles.changeText}>Tap to retake</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.captureCard} onPress={takeSelfie}>
            <Icon name="user" size={32} color={c.textMuted} />
            <Text style={styles.captureLabel}>Take Selfie</Text>
          </Pressable>
        )}

        {/* District */}
        <Text style={styles.sectionLabel}>Your District</Text>
        <View style={styles.districtWrap}>
          {BELIZE_DISTRICTS.map((entry) => {
            const selected = district === entry.value;
            return (
              <Pressable
                key={entry.value}
                onPress={() => setDistrict(entry.value)}
                accessibilityRole="button"
                accessibilityLabel={`Select district ${entry.label}`}
                style={[
                  styles.districtChip,
                  selected && styles.districtChipSelected,
                ]}
              >
                <Text style={[styles.districtChipText, selected && styles.districtChipTextSelected]}>
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button
          title={uploadStatus ?? (isUploading ? 'Uploading...' : 'Submit for Review')}
          onPress={handleSubmit}
          loading={isUploading}
          disabled={!canSubmit}
        />

        <Text style={styles.note}>
          Your documents will be reviewed securely. You can keep browsing kanek while we verify your account.
        </Text>
      </ScrollView>

      <CameraCapture
        visible={!!webCamera}
        facing={webCamera?.facing ?? 'back'}
        onCapture={handleWebCapture}
        onCancel={() => setWebCamera(null)}
      />
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
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
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
    marginBottom: spacing.xxl,
  },
  changeAccountText: {
    ...type.bodySm.regular,
    color: colors.accent.blue,
  },
  sectionLabel: {
    ...type.body.bold,
    color: c.text,
    marginBottom: spacing.sm,
  },
  captureCard: {
    backgroundColor: c.bg,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
    borderStyle: 'dashed',
    marginBottom: spacing.xl,
  },
  captureLabel: {
    ...type.bodySm.bold,
    color: c.textMuted,
    marginTop: spacing.sm,
  },
  preview: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
  },
  changeText: {
    ...type.bodySm.regular,
    color: colors.accent.blue,
    marginTop: spacing.sm,
  },
  districtWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  districtChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  districtChipSelected: {
    backgroundColor: c.chipSelectedBg,
    borderColor: c.chipSelectedBg,
  },
  districtChipText: {
    ...type.bodySm.regular,
    color: c.text,
  },
  districtChipTextSelected: {
    ...type.bodySm.bold,
    color: c.chipSelectedText,
  },
  note: {
    ...type.caption.regular,
    color: c.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
