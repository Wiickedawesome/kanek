import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius } from '@/theme';

type RoleChoice = 'rider' | 'driver';

export default function RoleSelectScreen() {
  const [selected, setSelected] = useState<RoleChoice | null>(null);

  const handleContinue = () => {
    if (!selected) return;
    router.push({ pathname: '/(auth)/id-upload', params: { role: selected } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>How will you use kanek?</Text>
        <Text style={styles.subtitle}>You can always do both later</Text>

        <Pressable
          style={[styles.card, selected === 'rider' && styles.cardSelected]}
          onPress={() => setSelected('rider')}
        >
          <Icon name="compass" size={32} color={selected === 'rider' ? colors.accent.green : colors.forest[400]} />
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, selected === 'rider' && styles.cardTitleSelected]}>
              I need rides
            </Text>
            <Text style={styles.cardDesc}>Find routes, request errands, browse the board</Text>
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
            <Text style={styles.cardDesc}>Post routes, accept bookings, run errands</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.button, !selected && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selected}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
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
    backgroundColor: colors.neutral[0],
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
});
