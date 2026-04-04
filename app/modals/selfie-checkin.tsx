import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui';
import { formatDateTime, safeGoBack } from '@/lib/helpers';
import { LinearGradient } from 'expo-linear-gradient';
import { TopographicBg } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import {
  useGetCheckinQuery,
  useSubmitCheckinMutation,
} from '@/store/api/checkinsApi';
import type { RootState } from '@/store';

export default function SelfieCheckinModal() {
  const { contractId } = useLocalSearchParams<{ contractId: string }>();
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  const { data: existingCheckin, isLoading } = useGetCheckinQuery(
    contractId ?? '',
    { skip: !contractId },
  );
  const [submitCheckin] = useSubmitCheckinMutation();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert(
        'Camera Permission',
        'Camera access is needed for check-in selfies.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      cameraType: ImagePicker.CameraType.front,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!imageUri || !userId || !contractId) return;

    setSubmitting(true);
    try {
      // Try to get current location
      let lat: number | undefined;
      let lng: number | undefined;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      await submitCheckin({
        driverId: userId,
        contractId,
        imageUri,
        lat,
        lng,
      }).unwrap();

      showAlert('Checked In', 'Your selfie check-in has been recorded.');
      router.back();
    } catch {
      showAlert('Error', 'Could not submit check-in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Already checked in
  if (!isLoading && existingCheckin) {
    return (
      <SafeAreaView style={styles.container}>
        <TopographicBg />
        <LinearGradient colors={[colors.forest[900], colors.forest[700]]} style={styles.header}>
          <Pressable onPress={() => safeGoBack('/(tabs)/activity/')} hitSlop={12}>
            <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
          </Pressable>
          <Text style={styles.headerTitle}>Check-In</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>
        <View style={styles.doneContainer}>
          <Icon name="shield-alert" size={48} color={colors.accent.green} />
          <Text style={styles.doneTitle}>Already Checked In</Text>
          <Image
            source={{ uri: existingCheckin.selfie_url }}
            style={styles.doneImage}
          />
          <Text style={styles.doneCaption}>
            {formatDateTime(existingCheckin.created_at)}
          </Text>
          <Button
            title="Go Back"
            variant="outline"
            onPress={() => safeGoBack('/(tabs)/activity/')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopographicBg />
      <LinearGradient colors={[colors.forest[900], colors.forest[700]]} style={styles.header}>
        <Pressable onPress={() => safeGoBack('/(tabs)/activity/')} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Selfie Check-In</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <View style={styles.content}>
        <Text style={styles.instruction}>
          Take a quick selfie to confirm you{"'"}re at the pickup location. This
          builds trust with riders.
        </Text>

        {imageUri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.preview} />
            <Pressable style={styles.retakeBtn} onPress={takeSelfie}>
              <Text style={styles.retakeText}>Retake</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.cameraPlaceholder} onPress={takeSelfie}>
            <Icon name="user" size={48} color={colors.neutral[300]} />
            <Text style={styles.placeholderText}>Tap to take selfie</Text>
          </Pressable>
        )}

        <Button
          title="Submit Check-In"
          onPress={handleSubmit}
          disabled={!imageUri}
          loading={submitting}
          style={styles.submitBtn}
        />
      </View>
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
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
  },
  instruction: {
    ...typography.body1,
    color: colors.forest[500],
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  cameraPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    borderWidth: 2,
    borderColor: colors.neutral[200],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  placeholderText: {
    ...typography.body2,
    color: colors.neutral[400],
    marginTop: spacing.sm,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  preview: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.lg,
  },
  retakeBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  retakeText: {
    ...typography.body2Bold,
    color: colors.accent.blue,
  },
  submitBtn: {
    width: '100%',
    marginTop: spacing.lg,
  },
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  doneTitle: {
    ...typography.h2,
    color: colors.forest[900],
  },
  doneImage: {
    width: 160,
    height: 160,
    borderRadius: borderRadius.lg,
  },
  doneCaption: {
    ...typography.caption,
    color: colors.neutral[500],
  },
});
