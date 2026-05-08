import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { Icon } from '@/components/icons';
import { colors, type, shadows } from '@/theme';
import type { PostType } from '@/types/database';
import { Text } from '@/components/ui/Text';

interface PostPinProps {
  id: string;
  coordinate: [number, number]; // [longitude, latitude]
  type: PostType;
  title: string;
  onPress?: (id: string) => void;
}

const PIN_CONFIG: Record<PostType, { icon: React.ComponentProps<typeof Icon>['name']; color: string }> = {
  route_offer: { icon: 'navigation', color: colors.accent.green },
  route_request: { icon: 'compass', color: colors.forest[500] },
  errand: { icon: 'package', color: colors.warning },
  package: { icon: 'package', color: colors.forest[400] },
  job: { icon: 'construction', color: colors.forest[600] },
};

export function PostPin({ id, coordinate, type, title, onPress }: PostPinProps) {
  const config = PIN_CONFIG[type] ?? PIN_CONFIG.errand;

  return (
    <MapboxGL.MarkerView id={id} coordinate={coordinate}>
      <Pressable onPress={() => onPress?.(id)} style={styles.container}>
        <View style={[styles.pin, { backgroundColor: config.color }]}>
          <Icon name={config.icon} size={16} color={colors.neutral[0]} />
        </View>
        <Text style={styles.label} numberOfLines={1}>
          {title}
        </Text>
      </Pressable>
    </MapboxGL.MarkerView>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', width: 100 },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  label: {
    ...type.caption.regular,
    color: colors.forest[900],
    marginTop: 2,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 4,
    borderRadius: 2,
  },
});
