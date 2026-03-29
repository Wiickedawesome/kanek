import React, { useState } from 'react';
import {
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { MAX_UPLOAD_SIZE } from '@/lib/constants';
import type { RootState } from '@/store';

interface VehicleInfo {
  make: string;
  model: string;
  year: string;
  color: string;
  plate: string;
}

export default function DriverDocsScreen() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [licenseUri, setLicenseUri] = useState<string | null>(null);
  const [insuranceUri, setInsuranceUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleInfo>({
    make: '',
    model: '',
    year: '',
    color: '',
    plate: '',
  });

  const pickDocument = async (setter: (uri: string) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_UPLOAD_SIZE) {
        showAlert('File too large', 'Document must be under 5 MB');
        return;
      }
      setter(asset.uri);
    }
  };

  const uploadFile = async (uri: string, name: string): Promise<string | null> => {
    if (!user) return null;
    const fileName = `${user.id}/${name}-${Date.now()}.jpg`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    const { error } = await supabase.storage
      .from('documents')
      .upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });

    if (error) {
      showAlert('Upload failed', error.message);
      return null;
    }
    return fileName;
  };

  const isFormValid =
    licenseUri &&
    insuranceUri &&
    vehicle.make.trim() &&
    vehicle.model.trim() &&
    vehicle.year.trim() &&
    vehicle.color.trim() &&
    vehicle.plate.trim();

  const handleSubmit = async () => {
    if (!isFormValid || !user) return;
    setIsSubmitting(true);

    const [licensePath, insurancePath] = await Promise.all([
      uploadFile(licenseUri!, 'license'),
      uploadFile(insuranceUri!, 'insurance'),
    ]);

    if (!licensePath || !insurancePath) {
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from('driver_details').insert({
      id: user.id,
      license_url: licensePath,
      insurance_url: insurancePath,
      vehicle_make: vehicle.make.trim(),
      vehicle_model: vehicle.model.trim(),
      vehicle_year: parseInt(vehicle.year, 10),
      vehicle_color: vehicle.color.trim(),
      vehicle_plate: vehicle.plate.trim().toUpperCase(),
    });

    if (error) {
      showAlert('Submission failed', error.message);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    router.replace('/(tabs)/explore');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Driver documents</Text>
        <Text style={styles.subtitle}>
          Upload your license and insurance, and tell us about your vehicle.
        </Text>

        {/* License upload */}
        <Text style={styles.sectionLabel}>Driver&apos;s License</Text>
        <Pressable
          style={styles.uploadArea}
          onPress={() => pickDocument(setLicenseUri)}
        >
          {licenseUri ? (
            <Image source={{ uri: licenseUri }} style={styles.docImage} />
          ) : (
            <>
              <Icon name="user" size={28} color={colors.forest[400]} />
              <Text style={styles.uploadText}>Tap to upload</Text>
            </>
          )}
        </Pressable>

        {/* Insurance upload */}
        <Text style={styles.sectionLabel}>Vehicle Insurance</Text>
        <Pressable
          style={styles.uploadArea}
          onPress={() => pickDocument(setInsuranceUri)}
        >
          {insuranceUri ? (
            <Image source={{ uri: insuranceUri }} style={styles.docImage} />
          ) : (
            <>
              <Icon name="shield-alert" size={28} color={colors.forest[400]} />
              <Text style={styles.uploadText}>Tap to upload</Text>
            </>
          )}
        </Pressable>

        {/* Vehicle info */}
        <Text style={styles.sectionLabel}>Vehicle Information</Text>

        <TextInput
          style={styles.input}
          placeholder="Make (e.g. Toyota)"
          placeholderTextColor={colors.neutral[400]}
          value={vehicle.make}
          onChangeText={(t) => setVehicle((v) => ({ ...v, make: t }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Model (e.g. Hilux)"
          placeholderTextColor={colors.neutral[400]}
          value={vehicle.model}
          onChangeText={(t) => setVehicle((v) => ({ ...v, model: t }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Year (e.g. 2019)"
          placeholderTextColor={colors.neutral[400]}
          value={vehicle.year}
          onChangeText={(t) => setVehicle((v) => ({ ...v, year: t }))}
          keyboardType="number-pad"
          maxLength={4}
        />
        <TextInput
          style={styles.input}
          placeholder="Color (e.g. White)"
          placeholderTextColor={colors.neutral[400]}
          value={vehicle.color}
          onChangeText={(t) => setVehicle((v) => ({ ...v, color: t }))}
        />
        <TextInput
          style={styles.input}
          placeholder="License Plate"
          placeholderTextColor={colors.neutral[400]}
          value={vehicle.plate}
          onChangeText={(t) => setVehicle((v) => ({ ...v, plate: t }))}
          autoCapitalize="characters"
        />

        <Pressable
          style={[styles.button, (!isFormValid || isSubmitting) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!isFormValid || isSubmitting}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Submitting...' : 'Submit for Review'}
          </Text>
        </Pressable>

        <Text style={styles.note}>
          Documents will be reviewed by the kanek team. You&apos;ll be notified once approved.
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
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxxl,
  },
  title: {
    ...typography.h1,
    color: colors.forest[900],
  },
  subtitle: {
    ...typography.body1,
    color: colors.neutral[500],
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.body1Bold,
    color: colors.forest[900],
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  uploadArea: {
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  uploadText: {
    ...typography.body2,
    color: colors.forest[400],
    marginTop: spacing.xs,
  },
  docImage: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.sm,
  },
  input: {
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body1,
    color: colors.forest[900],
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.forest[600],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    marginTop: spacing.xl,
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
