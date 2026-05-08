import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Icon } from '@/components/icons';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { AccountStatus } from '@/types/database';
import { Text } from '@/components/ui/Text';

interface VerificationStatusProps {
  status: AccountStatus;
}

const LIGHT_CONFIG: Record<AccountStatus, { label: string; icon: React.ComponentProps<typeof Icon>['name']; bg: string; fg: string }> = {
  pending: { label: 'Pending', icon: 'clock', bg: '#fff3e0', fg: colors.warning },
  active: { label: 'Verified', icon: 'circle-dot', bg: '#e8f5e9', fg: colors.accent.green },
  restricted: { label: 'Restricted', icon: 'alert-triangle', bg: '#fff3e0', fg: colors.warning },
  suspended: { label: 'Suspended', icon: 'shield-alert', bg: '#ffebee', fg: colors.error },
  suspended_pending_deletion: { label: 'Deleting', icon: 'shield-alert', bg: '#ffebee', fg: colors.error },
  dormant: { label: 'Dormant', icon: 'clock', bg: '#f5f5f5', fg: colors.neutral[400] },
};

const DARK_CONFIG: typeof LIGHT_CONFIG = {
  pending: { label: 'Pending', icon: 'clock', bg: 'rgba(255, 193, 7, 0.18)', fg: '#ffd76d' },
  active: { label: 'Verified', icon: 'circle-dot', bg: 'rgba(81, 193, 82, 0.18)', fg: colors.accent.neonGreen },
  restricted: { label: 'Restricted', icon: 'alert-triangle', bg: 'rgba(255, 193, 7, 0.18)', fg: '#ffd76d' },
  suspended: { label: 'Suspended', icon: 'shield-alert', bg: 'rgba(211, 47, 47, 0.22)', fg: '#ff8a8a' },
  suspended_pending_deletion: { label: 'Deleting', icon: 'shield-alert', bg: 'rgba(211, 47, 47, 0.22)', fg: '#ff8a8a' },
  dormant: { label: 'Dormant', icon: 'clock', bg: 'rgba(255, 255, 255, 0.08)', fg: 'rgba(255, 255, 255, 0.62)' },
};

export function VerificationStatus({ status }: VerificationStatusProps) {
  const { isDark } = useTheme();
  const config = (isDark ? DARK_CONFIG : LIGHT_CONFIG)[status];

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
  text: { ...type.caption.regular, fontWeight: '600' },
});
