import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { profilesApi, useSetInitialRoleMutation } from '@/store/api/profilesApi';
import type { RootState, AppDispatch } from '@/store';

type RoleChoice = 'rider' | 'driver';

export default function RoleSelectScreen() {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch<AppDispatch>();
  const [selected, setSelected] = useState<RoleChoice | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [setInitialRole] = useSetInitialRoleMutation();

  const isFormValid = selected && firstName.trim() && lastName.trim();

  const handleContinue = async () => {
    if (!isFormValid || !user) return;
    setIsSaving(true);

    // Update name only — RLS policy blocks direct role changes
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      })
      .eq('id', user.id);

    if (error) {
      setIsSaving(false);
      showAlert('Error', error.message);
      return;
    }

    // Set role via SECURITY DEFINER RPC (bypasses RLS role protection)
    try {
      await setInitialRole(selected).unwrap();
    } catch (err: any) {
      setIsSaving(false);
      showAlert('Error', err?.data ?? 'Could not set role. Please try again.');
      return;
    }

    setIsSaving(false);

    // Invalidate cached profile so auth layout picks up the new name + role
    dispatch(profilesApi.util.invalidateTags([{ type: 'Profile', id: user.id }]));

    router.replace('/(auth)/id-upload');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Tell us about yourself</Text>
        <Text style={styles.subtitle}>Your name and how you plan to use kanek</Text>

        <Pressable onPress={handleSignOut} style={styles.notYou}>
          <Text style={styles.notYouText}>Not you? Sign in with a different number</Text>
        </Pressable>

        <TextInput
          style={styles.input}
          placeholder="First name"
          placeholderTextColor={colors.neutral[400]}
          value={firstName}
          onChangeText={setFirstName}
          maxLength={50}
          autoFocus
        />
        <TextInput
          style={styles.input}
          placeholder="Last name"
          placeholderTextColor={colors.neutral[400]}
          value={lastName}
          onChangeText={setLastName}
          maxLength={50}
        />

        <Pressable
          style={[styles.card, selected === 'rider' && styles.cardSelected]}
          onPress={() => setSelected('rider')}
        >
          <Icon name="compass" size={32} color={selected === 'rider' ? colors.accent.green : colors.forest[400]} />
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, selected === 'rider' && styles.cardTitleSelected]}>
              I need rides
            </Text>
            <Text style={styles.cardDesc}>Find rides, request errands, browse the board</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.card, selected === 'driver' && styles.cardSelected]}
          onPress={() => setSelected('driver')}
        >
          <Icon name="navigation" size={32} color={selected === 'driver' ? colors.accent.green : colors.forest[400]} />
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, selected === 'driver' && styles.cardTitleSelected]}>
              I drive
            </Text>
            <Text style={styles.cardDesc}>Post rides, accept bookings, run errands</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.button, (!isFormValid || isSaving) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!isFormValid || isSaving}
        >
          <Text style={styles.buttonText}>{isSaving ? 'Saving...' : 'Continue'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
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
  input: {
    ...typography.body1,
    color: colors.forest[900],
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: colors.accent.green,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  cardText: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  cardTitle: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  cardTitleSelected: {
    color: colors.accent.green,
  },
  cardDesc: {
    ...typography.body2,
    color: colors.neutral[500],
    marginTop: 2,
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
  notYou: {
    marginBottom: spacing.lg,
  },
  notYouText: {
    ...typography.body2,
    color: colors.accent.blue,
  },
});
