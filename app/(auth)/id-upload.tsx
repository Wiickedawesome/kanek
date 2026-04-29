import React, { useState } from 'react';
import { Text, Image, StyleSheet, Pressable, ScrollView, Platform, View } from 'react-native';
import { showAlert, showConfirm } from '@/lib/alert';
import { MAX_UPLOAD_SIZE } from '@/lib/constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useDispatch, useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { ScreenHeader } from '@/components/ui';
import { readUploadFile } from '@/lib/uploadFile';
import { useAuth } from '@/hooks/useAuth';
import { profilesApi, useGetMyProfileQuery } from '@/store/api/profilesApi';
import { CameraCapture, type CameraFacing } from '@/components/CameraCapture';
import { colors, typography, spacing, borderRadius } from '@/theme';
import type { AppDispatch, RootState } from '@/store';

export default function IdUploadScreen() {
  const [idUri, setIdUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [webCamera, setWebCamera] = useState<{ facing: CameraFacing; target: 'id' | 'selfie' } | null>(null);
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch<AppDispatch>();
  const { signOut } = useAuth();
  const { data: profile } = useGetMyProfileQuery(user?.id ?? '', { skip: !user?.id });

  const handleExit = async () => {
    if (isUploading) return;

    const confirmed = await showConfirm(
      'Go back to sign in?',
      'This will sign you out so you can retry with a different account.',
    );

    if (!confirmed) return;

    await signOut();
    router.replace('/(auth)/login');
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
    if (!idUri || !selfieUri || !user || !profile) return;
    setIsUploading(true);
    const resolvedRole = profile.role;

    const idPath = `${user.id}/id-${Date.now()}.jpg`;
    const selfiePath = `${user.id}/selfie-${Date.now()}.jpg`;

    const [idOk, selfieOk] = await Promise.all([
      uploadImage(idUri, idPath),
      uploadImage(selfieUri, selfiePath),
    ]);

    if (!idOk || !selfieOk) {
      setIsUploading(false);
      return;
    }

    // Store ID document record. Selfie lives in the private documents bucket
    // at selfiePath for admin verification; it intentionally does NOT become
    // the profile avatar — users can upload that separately from their profile.
    const { error: docError } = await supabase.from('rider_documents').insert({
      user_id: user.id,
      document_url: idPath,
    });

    if (docError) {
      showAlert('Error', docError.message);
      setIsUploading(false);
      return;
    }

    dispatch(profilesApi.util.invalidateTags([
      { type: 'Profile', id: user.id },
      { type: 'RiderDocument', id: user.id },
    ]));

    setIsUploading(false);

    if (resolvedRole === 'driver') {
      router.push('/(auth)/driver-docs');
    } else {
      router.replace('/(tabs)/explore');
    }
  };

  const canSubmit = idUri && selfieUri && profile && !isUploading;

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader style={styles.header}>
        <Pressable onPress={() => { void handleExit(); }} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
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
            <Icon name="receipt" size={32} color={colors.forest[400]} />
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
            <Icon name="user" size={32} color={colors.forest[400]} />
            <Text style={styles.captureLabel}>Take Selfie</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.buttonText}>
            {isUploading ? 'Uploading...' : 'Submit for Review'}
          </Text>
        </Pressable>

        <Text style={styles.note}>
          Your documents have been submitted for review. You can keep using kanek while we verify them.
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.neutral[0],
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
    ...typography.h1,
    color: colors.forest[900],
  },
  subtitle: {
    ...typography.body1,
    color: colors.neutral[500],
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  changeAccount: {
    marginBottom: spacing.xxl,
  },
  changeAccountText: {
    ...typography.body2,
    color: colors.accent.blue,
  },
  sectionLabel: {
    ...typography.body1Bold,
    color: colors.forest[700],
    marginBottom: spacing.sm,
  },
  captureCard: {
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderStyle: 'dashed',
    marginBottom: spacing.xl,
  },
  captureLabel: {
    ...typography.body2Bold,
    color: colors.forest[400],
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
    ...typography.body2,
    color: colors.accent.blue,
    marginTop: spacing.sm,
  },
  button: {
    backgroundColor: colors.forest[600],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
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
