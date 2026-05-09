import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, colors } from '@/theme';
import { Icon, type IconName } from '@/components/icons';
import type { PostType } from '@/types/database';

interface HeroGradientProps {
  type: PostType;
  height?: number;
}

const TYPE_PRESETS: Record<PostType, { colors: [string, string, string]; icon: IconName }> = {
  route_offer: {
    colors: ['#0f3a14', '#1c5826', colors.accent.green],
    icon: 'navigation',
  },
  route_request: {
    colors: ['#0e2548', '#1d3f78', colors.accent.blue],
    icon: 'map-pin',
  },
  errand: {
    colors: ['#5b2e06', '#a35a0a', '#fb8c00'],
    icon: 'clipboard-list',
  },
  package: {
    colors: ['#3c1452', '#6a2a91', '#a154d4'],
    icon: 'package',
  },
  job: {
    colors: ['#3a2f00', '#7a6300', colors.accent.yellow],
    icon: 'construction',
  },
};

/**
 * Type-themed gradient hero used when no map preview or photo is available
 * (errands, packages, jobs by default).
 */
export function HeroGradient({ type, height = 180 }: HeroGradientProps) {
  const preset = TYPE_PRESETS[type] ?? TYPE_PRESETS.errand;

  return (
    <View style={[styles.wrap, { height }]}>
      <LinearGradient
        colors={preset.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.iconWrap}>
        <Icon name={preset.icon} size={56} color="rgba(255,255,255,0.85)" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    opacity: 0.92,
  },
});
