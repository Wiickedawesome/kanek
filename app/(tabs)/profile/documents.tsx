import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { Icon } from '@/components/icons';
import { Button, Card } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { supabase } from '@/lib/supabase';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';
import type { RootState } from '@/store';

interface DocItem {
  name: string;
  bucket: string;
  path: string;
  uploaded: boolean;
}

const REQUIRED_DOCS: DocItem[] = [
  { name: 'Government-Issued ID', bucket: 'id-docs', path: 'id-front', uploaded: false },
  { name: 'Driver License (Front)', bucket: 'driver-docs', path: 'license-front', uploaded: false },
  { name: 'Driver License (Back)', bucket: 'driver-docs', path: 'license-back', uploaded: false },
  { name: 'Vehicle Registration', bucket: 'driver-docs', path: 'registration', uploaded: false },
  { name: 'Vehicle Insurance', bucket: 'driver-docs', path: 'insurance', uploaded: false },
];

export default function DocumentsScreen() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: profile } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadedPaths, setUploadedPaths] = useState<Set<string>>(new Set());

  const isDriver = profile?.role === 'driver';
  const docs = isDriver ? REQUIRED_DOCS : REQUIRED_DOCS.slice(0, 1);

  const handleUpload = useCallback(async (doc: DocItem) => {
    if (!userId) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to upload documents.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });

    if (result.canceled || !result.assets.length) return;

    setUploading(doc.path);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const filePath = `${userId}/${doc.path}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const { error } = await supabase.storage
        .from(doc.bucket)
        .upload(filePath, arrayBuffer, {
          contentType: asset.mimeType ?? 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      setUploadedPaths((prev) => new Set(prev).add(doc.path));
      Alert.alert('Uploaded', `${doc.name} has been uploaded for verification.`);
    } catch {
      Alert.alert('Upload Failed', 'Could not upload document. Please try again.');
    } finally {
      setUploading(null);
    }
  }, [userId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>My Documents</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>
          Upload your verification documents. {isDriver ? 'Drivers must submit all documents.' : 'Government ID is required for all users.'}
        </Text>

        {docs.map((doc) => {
          const isUploaded = uploadedPaths.has(doc.path);
          const isCurrentlyUploading = uploading === doc.path;

          return (
            <Card key={doc.path} style={styles.docCard}>
              <View style={styles.docInfo}>
                <Icon
                  name={isUploaded ? 'circle-dot' : 'clipboard-list'}
                  size={20}
                  color={isUploaded ? colors.accent.green : colors.neutral[400]}
                />
                <View style={styles.docText}>
                  <Text style={styles.docName}>{doc.name}</Text>
                  <Text style={styles.docStatus}>
                    {isUploaded ? 'Uploaded — pending review' : 'Not uploaded'}
                  </Text>
                </View>
              </View>
              <Button
                title={isCurrentlyUploading ? 'Uploading...' : isUploaded ? 'Replace' : 'Upload'}
                variant={isUploaded ? 'outline' : 'primary'}
                onPress={() => handleUpload(doc)}
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

  docCard: { padding: spacing.lg, gap: spacing.md },
  docInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  docText: { flex: 1 },
  docName: { ...typography.body1Bold, color: colors.forest[900] },
  docStatus: { ...typography.caption, color: colors.neutral[400], marginTop: 2 },
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
