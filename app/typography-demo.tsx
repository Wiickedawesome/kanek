import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { spacing } from '@/theme';
import type { TypographyVariant, TypographyWeight } from '@/theme/typography';
import type { TextTone } from '@/theme/ThemeContext';

const VARIANTS: { variant: TypographyVariant; weights: string[] }[] = [
  { variant: 'display', weights: ['bold'] },
  { variant: 'h1', weights: ['bold'] },
  { variant: 'h2', weights: ['bold'] },
  { variant: 'h3', weights: ['bold', 'semibold', 'medium'] },
  { variant: 'subtitle', weights: ['bold', 'semibold', 'medium', 'regular'] },
  { variant: 'body', weights: ['bold', 'semibold', 'medium', 'regular'] },
  { variant: 'bodySm', weights: ['bold', 'semibold', 'medium', 'regular'] },
  { variant: 'caption', weights: ['semibold', 'medium', 'regular'] },
  { variant: 'overline', weights: ['medium'] },
];

const TONES: TextTone[] = ['text', 'subtle', 'muted', 'accent', 'danger'];

/**
 * Dev-only demo of the type scale. Visit `/typography-demo` in the app.
 */
export default function TypographyDemo() {
  const { c, scheme } = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="overline" tone="muted">Theme · {scheme}</Text>
        <Text variant="h1" style={{ marginTop: spacing.xs }}>Typography</Text>
        <Text variant="body" tone="muted" style={{ marginTop: spacing.xs }}>
          Every variant × weight pair, then every tone on body.
        </Text>

        <View style={styles.section}>
          {VARIANTS.map(({ variant, weights }) => (
            <View key={variant} style={styles.row}>
              <Text variant="overline" tone="subtle" style={styles.label}>
                {variant}
              </Text>
              {weights.map((w) => (
                <Text
                  key={w}
                  variant={variant}
                  weight={w as TypographyWeight<typeof variant>}
                  style={{ marginTop: spacing.xs }}
                >
                  {variant} · {w} — Sphinx of black quartz
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text variant="overline" tone="subtle" style={styles.label}>tones</Text>
          {TONES.map((tone) => (
            <Text key={tone} variant="body" weight="medium" tone={tone} style={{ marginTop: spacing.xs }}>
              tone · {tone} — quick brown fox
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  section: { marginTop: spacing.xl },
  row: { marginBottom: spacing.md },
  label: { marginBottom: spacing.xs },
});
