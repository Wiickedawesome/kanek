import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { MAX_UPLOAD_SIZE } from '@/lib/constants';
import type { RootState } from '@/store';

export default function IdUploadScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { role } = useLocalSearchParams<{ role?: string }>();
  const user = useSelector((state: RootState) => state.auth.user);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_UPLOAD_SIZE) {
        showAlert('File too large', 'ID photo must be under 5 MB');
        return;
      }
      setImageUri(asset.uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Camera access is required to take a photo of your ID');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!imageUri || !user) return;
    setIsUploading(true);

    const fileName = `${user.id}/id-${Date.now()}.jpg`;
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    const { error } = await supabase.storage
      .from('documents')
      .upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });

    if (error) {
      showAlert('Upload failed', error.message);
      setIsUploading(false);
      return;
    }

    // Store document record
    await supabase.from('rider_documents').insert({
      user_id: user.id,
      document_url: fileName,
    });

    setIsUploading(false);

    if (role === 'driver') {
      router.push('/(auth)/driver-docs');
    } else {
      router.replace('/(tabs)/explore');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Verify your identity</Text>
        <Text style={styles.subtitle}>
          Upload a photo of your government-issued ID. This helps keep the community safe.
        </Text>

        {imageUri ? (
          <Pressable onPress={pickImage} style={styles.preview}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            <Text style={styles.changeText}>Tap to change</Text>
          </Pressable>
        ) : (
          <View style={styles.uploadOptions}>
            <Pressable style={styles.uploadCard} onPress={takePhoto}>
              <Icon name="user" size={32} color={colors.forest[400]} />
              <Text style={styles.uploadLabel}>Take Photo</Text>
            </Pressable>

            <Pressable style={styles.uploadCard} onPress={pickImage}>
              <Icon name="receipt" size={32} color={colors.forest[400]} />
              <Text style={styles.uploadLabel}>From Gallery</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={[styles.button, (!imageUri || isUploading) && styles.buttonDisabled]}
          onPress={handleUpload}
          disabled={!imageUri || isUploading}
        >
          <Text style={styles.buttonText}>
            {isUploading ? 'Uploading...' : 'Submit for Review'}
          </Text>
        </Pressable>

        <Text style={styles.note}>
          Your ID will be reviewed by the kanek team. Your account will be activated once verified.
        </Text>
      </View>
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
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
  uploadOptions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  uploadCard: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderStyle: 'dashed',
  },
  uploadLabel: {
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
