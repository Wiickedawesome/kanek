import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing, useTheme } from '@/theme';
import { Icon, type IconName } from '@/components/icons';
import { Text } from '@/components/ui/Text';

interface MetaItemProps {
  iconName: IconName;
  iconColor?: string;
  children: React.ReactNode;
}

/**
 * Standard "icon + small muted text" pair used in post-card meta rows
 * (rating, departure time, etc.).
 */
export const MetaItem = React.memo(function MetaItem({
  iconName,
  iconColor,
  children,
}: MetaItemProps) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      <Icon name={iconName} size={12} color={iconColor ?? c.textMuted} />
      <Text variant="bodySm" tone="muted">{children}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
