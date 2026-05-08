import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { spacing, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { Icon, type IconName } from '@/components/icons';
import { Text } from '@/components/ui/Text';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const { c } = useTheme();
  const styles = createStyles(c);
  return (
    <Animated.View entering={FadeInUp.duration(400).springify()} style={styles.container}>
      {icon && (
        <View style={styles.iconContainer}>
          <Icon name={icon} size={32} color={c.textMuted} />
        </View>
      )}
      <Text variant="h3" style={styles.center}>{title}</Text>
      {message && (
        <Text variant="bodySm" tone="muted" style={styles.center}>
          {message}
        </Text>
      )}
      {action && <View style={styles.action}>{action}</View>}
    </Animated.View>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingTop: spacing.xxxl,
      paddingHorizontal: spacing.xxl,
      gap: spacing.md,
    },
    iconContainer: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    center: {
      textAlign: 'center',
    },
    action: {
      marginTop: spacing.lg,
    },
  });
