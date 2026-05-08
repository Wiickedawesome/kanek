import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing, useTheme } from '@/theme';
import { Icon, type IconName } from '@/components/icons';
import { Text } from '@/components/ui/Text';
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
  color,
  backgroundColor,
  style,
}: BadgeProps) {
  const { c } = useTheme();
  const fg = color ?? c.text;
  const bg = backgroundColor ?? c.surfaceElevated;
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon && <Icon name={icon} size={14} color={fg} />}
      <Text variant="caption" weight="semibold" style={{ color: fg }}>{label}</Text>
    </View>
  );
}

type PostTypePalette = { label: string; icon: IconName; lightFg: string; lightBg: string; darkFg: string; darkBg: string };

const postTypeBadgeConfig: Record<PostType, PostTypePalette> = {
  route_offer: {
    label: 'Driver Offering',
    icon: 'circle-dot',
    lightFg: colors.forest[600],
    lightBg: '#e8f5e9',
    darkFg: colors.accent.neonGreen,
    darkBg: 'rgba(81, 193, 82, 0.18)',
  },
  route_request: {
    label: 'Riders Looking',
    icon: 'circle-dot',
    lightFg: colors.accent.blue,
    lightBg: '#e3f2fd',
    darkFg: '#7da0ff',
    darkBg: 'rgba(73, 103, 246, 0.22)',
  },
  errand: {
    label: 'Errand',
    icon: 'package',
    lightFg: '#7b5e00',
    lightBg: '#fff8e1',
    darkFg: '#ffd76d',
    darkBg: 'rgba(255, 193, 7, 0.18)',
  },
  package: {
    label: 'Package',
    icon: 'package',
    lightFg: '#4a148c',
    lightBg: '#f3e5f5',
    darkFg: '#d8a3ff',
    darkBg: 'rgba(156, 39, 176, 0.22)',
  },
  job: {
    label: 'Job',
    icon: 'clipboard-list',
    lightFg: colors.forest[700],
    lightBg: colors.neutral[100],
    darkFg: '#e0e0e0',
    darkBg: 'rgba(255, 255, 255, 0.08)',
  },
};

export function PostTypeBadge({
  type,
  style,
  variant = 'default',
}: {
  type: PostType;
  style?: ViewStyle;
  /**
   * `default` — themed pastel/translucent background; used inline.
   * `overlay` — translucent glass background; used on top of a hero image.
   */
  variant?: 'default' | 'overlay';
}) {
  const { isDark } = useTheme();
  const config = postTypeBadgeConfig[type];
  if (variant === 'overlay') {
    return (
      <Badge
        label={config.label}
        icon={config.icon}
        color="#ffffff"
        backgroundColor="rgba(20,40,0,0.55)"
        style={style}
      />
    );
  }
  return (
    <Badge
      label={config.label}
      icon={config.icon}
      color={isDark ? config.darkFg : config.lightFg}
      backgroundColor={isDark ? config.darkBg : config.lightBg}
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
  },
});
