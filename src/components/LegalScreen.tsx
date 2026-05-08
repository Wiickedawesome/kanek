import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons';
import { ScreenHeader, useFloatingTabBarPad } from '@/components/ui';
import { colors, type, spacing, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
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
  const { c } = useTheme();
  const styles = createStyles(c);
  const tabBarPad = useFloatingTabBarPad();
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader style={styles.header}>
        <Pressable onPress={() => safeGoBack(backFallback)} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPad }]}>
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

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...type.h3.bold, color: c.text, flex: 1, textAlign: 'center' },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  lastUpdated: { ...type.caption.regular, color: c.textMuted },
  section: { gap: spacing.xs },
  sectionHeading: { ...type.body.bold, color: c.text },
  sectionBody: { ...type.bodySm.regular, color: c.textMuted, lineHeight: 22 },
  emailLink: { ...type.bodySm.bold, color: colors.accent.blue },
});

