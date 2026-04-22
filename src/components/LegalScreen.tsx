import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons';
import { ScreenHeader } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { safeGoBack } from '@/lib/helpers';

interface LegalScreenProps {
  backFallback: string;
  title: string;
  sections: { heading: string; body: string }[];
  lastUpdated: string;
  contactEmail?: string;
}

/**
 * Shared legal page used for Privacy Policy, Terms of Service, etc.
 * Thin route wrappers pass content via props.
 */
export function LegalScreen({ backFallback, title, sections, lastUpdated, contactEmail }: LegalScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader style={styles.header}>
        <Pressable onPress={() => safeGoBack(backFallback)} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>

        {sections.map((section, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        {contactEmail && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Contact Us</Text>
            <Text style={styles.sectionBody}>
              If you have any questions, contact us at:
            </Text>
            <Pressable onPress={() => Linking.openURL(`mailto:${contactEmail}`)}>
              <Text style={styles.emailLink}>{contactEmail}</Text>
            </Pressable>
          </View>
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
  },
  headerTitle: { ...typography.h3, color: colors.neutral[0], flex: 1, textAlign: 'center' },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  lastUpdated: { ...typography.caption, color: colors.neutral[400] },
  section: { gap: spacing.xs },
  sectionHeading: { ...typography.body1Bold, color: colors.forest[900] },
  sectionBody: { ...typography.body2, color: colors.neutral[500], lineHeight: 22 },
  emailLink: { ...typography.body2Bold, color: colors.accent.blue },
});

