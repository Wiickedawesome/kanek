import React, { useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { showAlert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/icons';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { profilesApi, useSetInitialRoleMutation } from '@/store/api/profilesApi';
import type { RootState, AppDispatch } from '@/store';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui';

type RoleChoice = 'rider' | 'driver';

export default function RoleSelectScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
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

    // Invalidate the cached profile so downstream screens refetch with the
    // fresh role/name; keepUnusedDataFor (300s) is too long for onboarding,
    // so also write the updated row straight into the cache.
    dispatch(profilesApi.util.invalidateTags([{ type: 'Profile', id: user.id }]));
    dispatch(profilesApi.util.updateQueryData('getMyProfile', user.id, (draft) => {
      draft.role = selected;
      draft.first_name = firstName.trim();
      draft.last_name = lastName.trim();
    }));

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
          <Text style={styles.notYouText}>Not you? Sign in with a different account</Text>
        </Pressable>

        <TextInput
          style={styles.input}
          placeholder="First name"
          placeholderTextColor={c.textMuted}
          value={firstName}
          onChangeText={setFirstName}
          maxLength={50}
          autoFocus
        />
        <TextInput
          style={styles.input}
          placeholder="Last name"
          placeholderTextColor={c.textMuted}
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

        <Button
          title={isSaving ? 'Saving...' : 'Continue'}
          onPress={handleContinue}
          loading={isSaving}
          disabled={!isFormValid || isSaving}
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  title: {
    ...type.h1.bold,
    color: c.text,
  },
  subtitle: {
    ...type.body.regular,
    color: c.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
  input: {
    ...type.body.regular,
    color: c.text,
    backgroundColor: c.bg,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: colors.accent.green,
    backgroundColor: c.surface,
  },
  cardText: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  cardTitle: {
    ...type.body.bold,
    color: c.text,
  },
  cardTitleSelected: {
    color: colors.accent.green,
  },
  cardDesc: {
    ...type.bodySm.regular,
    color: c.textMuted,
    marginTop: 2,
  },
  notYou: {
    marginBottom: spacing.lg,
  },
  notYouText: {
    ...type.bodySm.regular,
    color: colors.accent.blue,
  },
});
