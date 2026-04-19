import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius } from '@/theme';
import type { AccountStatus } from '@/types/database';

interface VerificationStatusProps {
  status: AccountStatus;
}

const STATUS_CONFIG: Record<AccountStatus, { label: string; icon: React.ComponentProps<typeof Icon>['name']; bg: string; fg: string }> = {
  pending: { label: 'Pending', icon: 'clock', bg: '#fff3e0', fg: colors.warning },
  active: { label: 'Verified', icon: 'circle-dot', bg: '#e8f5e9', fg: colors.accent.green },
  restricted: { label: 'Restricted', icon: 'alert-triangle', bg: '#fff3e0', fg: colors.warning },
  suspended: { label: 'Suspended', icon: 'shield-alert', bg: '#ffebee', fg: colors.error },
  suspended_pending_deletion: { label: 'Deleting', icon: 'shield-alert', bg: '#ffebee', fg: colors.error },
  dormant: { label: 'Dormant', icon: 'clock', bg: '#f5f5f5', fg: colors.neutral[400] },
};

export function VerificationStatus({ status }: VerificationStatusProps) {
  const config = STATUS_CONFIG[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Icon name={config.icon} size={14} color={config.fg} />
      <Text style={[styles.text, { color: config.fg }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    minHeight: 28,
  },
  text: { ...typography.caption, fontWeight: '600' },
});
