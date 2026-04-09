import React, { useState } from 'react';
import { Text, Image, StyleSheet, Pressable, ScrollView } from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useDispatch, useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { profilesApi, useGetMyProfileQuery } from '@/store/api/profilesApi';
import { uploadProfileAvatar } from '@/lib/avatar';
import { colors, typography, spacing, borderRadius } from '@/theme';
import type { AppDispatch, RootState } from '@/store';

export default function IdUploadScreen() {
  const [idUri, setIdUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch<AppDispatch>();
  const { data: profile } = useGetMyProfileQuery(user?.id ?? '', { skip: !user?.id });

  const requestCamera = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Camera access is required');
      return false;
    }
    return true;
  };

  const takeIdPhoto = async () => {
    if (!(await requestCamera())) return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setIdUri(result.assets[0].uri);
    }
  };

  const takeSelfie = async () => {
    if (!(await requestCamera())) return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]) {
      setSelfieUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string, path: string): Promise<boolean> => {
    const response = await fetch(uri);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('documents')
      .upload(path, blob, { contentType: 'image/jpeg' });

    if (error) {
      showAlert('Upload failed', error.message);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!idUri || !selfieUri || !user) return;
    setIsUploading(true);
    const resolvedRole = profile?.role ?? 'rider';

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

    // Store ID document record
    const { error: docError } = await supabase.from('rider_documents').insert({
      user_id: user.id,
      document_url: idPath,
    });

    if (docError) {
      showAlert('Error', docError.message);
      setIsUploading(false);
      return;
    }

    // Save selfie as avatar in the public avatars bucket
    const avatarUrl = await uploadProfileAvatar({
      userId: user.id,
      uri: selfieUri,
      mimeType: 'image/jpeg',
    });
    await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);

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

  const canSubmit = idUri && selfieUri && !isUploading;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Text style={styles.title}>Verify your identity</Text>
        <Text style={styles.subtitle}>
          Take a photo of your government-issued ID and a selfie. Both are required.
        </Text>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
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
    marginBottom: spacing.xxl,
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
