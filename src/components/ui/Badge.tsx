import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography, borderRadius, spacing } from '@/theme';
import { Icon, type IconName } from '@/components/icons';
import type { PostType } from '@/types/database';

interface BadgeProps {
  label: string;
  icon?: IconName;
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
}

export function Badge({
  label,
  icon,
  color = colors.forest[900],
  backgroundColor = colors.neutral[200],
  style,
}: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor }, style]}>
      {icon && <Icon name={icon} size={14} color={color} />}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const postTypeBadgeConfig: Record<PostType, { label: string; icon: IconName; color: string; bg: string }> = {
  route_offer: {
    label: 'Driver Offering',
    icon: 'circle-dot',
    color: colors.forest[600],
    bg: '#e8f5e9',
  },
  route_request: {
    label: 'Riders Looking',
    icon: 'circle-dot',
    color: colors.accent.blue,
    bg: '#e3f2fd',
  },
  errand: {
    label: 'Errand',
    icon: 'package',
    color: '#7b5e00',
    bg: '#fff8e1',
  },
  package: {
    label: 'Package',
    icon: 'package',
    color: '#4a148c',
    bg: '#f3e5f5',
  },
  job: {
    label: 'Job',
    icon: 'clipboard-list',
    color: colors.forest[700],
    bg: colors.neutral[100],
  },
};

export function PostTypeBadge({ type, style }: { type: PostType; style?: ViewStyle }) {
  const config = postTypeBadgeConfig[type];
  return (
    <Badge
      label={config.label}
      icon={config.icon}
      color={config.color}
      backgroundColor={config.bg}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
  },
});
