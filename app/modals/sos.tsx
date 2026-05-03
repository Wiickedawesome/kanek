import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { safeGoBack } from '@/lib/helpers';
import { useSOS } from '@/hooks/useSOS';

export default function SOSModal() {
  const { triggerSOS, isSending } = useSOS();

  return (
    <SafeAreaView style={styles.container}>
      {/* Close */}
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack('/(tabs)/activity/')} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Emergency</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.sosCircle}>
          <Icon name="shield-alert" size={64} color={colors.neutral[0]} />
        </View>

        <Text style={styles.title}>Emergency SOS</Text>
        <Text style={styles.description}>
          This will send your current GPS location to your emergency contact
          by email.
        </Text>

        <Button
          title={isSending ? 'Sending...' : 'Send SOS Alert'}
          onPress={triggerSOS}
          loading={isSending}
          size="lg"
          style={styles.sosButton}
        />

        <Pressable
          style={styles.callRow}
          onPress={() => Linking.openURL('tel:911')}
        >
          <Icon name="phone" size={20} color={colors.accent.blue} />
          <Text style={styles.callText}>Call 911 directly</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.error,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.neutral[0],
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  sosCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.neutral[0],
    textAlign: 'center',
  },
  description: {
    ...typography.body1,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
  },
  sosButton: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  callText: {
    ...typography.body1Bold,
    color: colors.neutral[0],
    textDecorationLine: 'underline',
  },
});
