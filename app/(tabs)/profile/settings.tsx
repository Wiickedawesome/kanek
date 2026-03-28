import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useGetMyProfileQuery, useUpdateProfileMutation } from '@/store/api/profilesApi';
import { isValidPhone } from '@/lib/helpers';
import type { RootState } from '@/store';
import type { Role } from '@/types/database';

export default function SettingsScreen() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: profile, isLoading } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [role, setRole] = useState<Role>('rider');

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name ?? '');
      setLastName(profile.last_name ?? '');
      setEmail(profile.email ?? '');
      setEmergencyContact(profile.emergency_contact ?? '');
      setRole(profile.role);
    }
  }, [profile]);

  const handleSave = useCallback(async () => {
    if (!userId) return;

    if (emergencyContact && !isValidPhone(emergencyContact)) {
      Alert.alert('Invalid Phone', 'Please enter a valid Belize phone number for emergency contact.');
      return;
    }

    try {
      await updateProfile({
        id: userId,
        updates: {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          email: email.trim() || null,
          emergency_contact: emergencyContact.trim() || null,
          role,
        },
      }).unwrap();
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch {
      Alert.alert('Error', 'Could not save profile. Please try again.');
    }
  }, [userId, firstName, lastName, email, emergencyContact, role, updateProfile]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent.green} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="navigation" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.field}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter first name"
            placeholderTextColor={colors.neutral[400]}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter last name"
            placeholderTextColor={colors.neutral[400]}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.neutral[400]}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Emergency Contact</Text>
          <TextInput
            style={styles.input}
            value={emergencyContact}
            onChangeText={setEmergencyContact}
            placeholder="+501 000 0000"
            placeholderTextColor={colors.neutral[400]}
            keyboardType="phone-pad"
          />
        </View>

        {/* Role selector */}
        <View style={styles.field}>
          <Text style={styles.label}>Role</Text>
          <View style={styles.roleRow}>
            <Pressable
              style={[styles.roleBtn, role === 'rider' && styles.roleBtnActive]}
              onPress={() => setRole('rider')}
            >
              <Text style={[styles.roleBtnText, role === 'rider' && styles.roleBtnTextActive]}>
                Rider
              </Text>
            </Pressable>
            <Pressable
              style={[styles.roleBtn, role === 'driver' && styles.roleBtnActive]}
              onPress={() => setRole('driver')}
            >
              <Text style={[styles.roleBtnText, role === 'driver' && styles.roleBtnTextActive]}>
                Driver
              </Text>
            </Pressable>
          </View>
          {role === 'driver' && profile?.role !== 'driver' && (
            <Text style={styles.driverNote}>
              Switching to driver requires ID verification. Upload your documents after saving.
            </Text>
          )}
        </View>

        {/* Phone (read-only) */}
        <View style={styles.field}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={[styles.input, styles.inputDisabled]}>
            <Text style={styles.disabledText}>{profile?.phone ?? '—'}</Text>
          </View>
          <Text style={styles.hint}>Phone number cannot be changed.</Text>
        </View>

        <Button
          title={isSaving ? 'Saving...' : 'Save Changes'}
          onPress={handleSave}
          disabled={isSaving}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral[50] },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.neutral[50] },
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

  field: { gap: spacing.xs },
  label: { ...typography.body2Bold, color: colors.forest[400] },
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
  inputDisabled: { backgroundColor: colors.neutral[100] },
  disabledText: { ...typography.body1, color: colors.neutral[500] },
  hint: { ...typography.caption, color: colors.neutral[400] },

  roleRow: { flexDirection: 'row', gap: spacing.md },
  roleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[0],
  },
  roleBtnActive: { borderColor: colors.accent.green, backgroundColor: '#e8f5e9' },
  roleBtnText: { ...typography.body1Bold, color: colors.neutral[500] },
  roleBtnTextActive: { color: colors.accent.green },
  driverNote: { ...typography.caption, color: colors.warning, marginTop: spacing.xs },
});
