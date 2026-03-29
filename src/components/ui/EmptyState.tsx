import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/theme';
import { Icon, type IconName } from '@/components/icons';

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon && (
        <Icon name={icon} size={48} color={colors.neutral[300]} />
      )}
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.forest[900],
    textAlign: 'center',
  },
  message: {
    ...typography.body2,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.lg,
  },
});
