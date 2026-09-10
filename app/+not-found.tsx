import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui';
import { Text } from '@/components/ui/Text';
import { spacing, useTheme } from '@/theme';

export default function NotFoundScreen() {
  const { c } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: c.surfaceElevated }]}>
          <Icon name="compass" size={48} color={c.textMuted} />
        </View>

        <Text variant="h2" style={styles.title}>
          Screen Not Found
        </Text>

        <Text variant="body" tone="muted" style={styles.message}>
          The link you followed does not exist or may have been moved.
        </Text>

        <Button
          title="Go to Explore"
          size="lg"
          style={styles.button}
          onPress={() => router.replace('/(tabs)/explore')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  message: {
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 280,
  },
  button: {
    width: '100%',
    maxWidth: 240,
  },
});
