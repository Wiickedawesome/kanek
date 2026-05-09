import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Icon } from '@/components/icons';
import { Button, ScreenHeader } from '@/components/ui';
import { formatDateTime, safeGoBack } from '@/lib/helpers';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import {
  useGetCheckinQuery,
  useSubmitCheckinMutation,
} from '@/store/api/checkinsApi';
import { useSendMessageMutation } from '@/store/api/messagesApi';
import type { RootState } from '@/store';
import { Text } from '@/components/ui/Text';

export default function SelfieCheckinModal() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const { contractId } = useLocalSearchParams<{ contractId: string }>();
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  const { data: existingCheckin, isLoading } = useGetCheckinQuery(
    contractId ?? '',
    { skip: !contractId },
  );
  const [submitCheckin] = useSubmitCheckinMutation();
  const [sendMessage] = useSendMessageMutation();

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

      // Notify the other party via a system message in the contract thread.
      // The DB trigger trg_message_notification creates a notification row for them.
      try {
        await sendMessage({
          contractId,
          senderId: userId,
          body: 'Driver has checked in at the pickup location.',
        }).unwrap();
      } catch {
        // Best-effort — don't block on notification failure
      }

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
        <ScreenHeader title="Check-In" onBack={() => safeGoBack('/(tabs)/activity/')} />
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
      <ScreenHeader title="Selfie Check-In" onBack={() => safeGoBack('/(tabs)/activity/')} />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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
            <Icon name="user" size={48} color={c.textMuted} />
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
      </ScrollView>
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
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    alignItems: 'center',
  },
  instruction: {
    ...type.body.regular,
    color: c.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  cameraPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.lg,
    backgroundColor: c.bg,
    borderWidth: 2,
    borderColor: c.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  placeholderText: {
    ...type.bodySm.regular,
    color: c.textMuted,
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
    ...type.bodySm.bold,
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
    ...type.h2.bold,
    color: c.text,
  },
  doneImage: {
    width: 160,
    height: 160,
    borderRadius: borderRadius.lg,
  },
  doneCaption: {
    ...type.caption.regular,
    color: c.textMuted,
  },
});
