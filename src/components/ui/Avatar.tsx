import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { colors, type, shadows, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { Text } from '@/components/ui/Text';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: AvatarSize;
  style?: ViewStyle;
}

const sizeMap: Record<AvatarSize, number> = { sm: 32, md: 40, lg: 56 };

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function Avatar({ uri, name, size = 'md', style }: AvatarProps) {
  const { c } = useTheme();
  const styles = createStyles(c);
  const dim = sizeMap[size];
  const ringWidth = size === 'lg' ? 2.5 : 2;
  const [imgError, setImgError] = React.useState(false);

  // Reset error state when URI changes
  React.useEffect(() => {
    setImgError(false);
  }, [uri]);

  const showImage = !!uri && !imgError;

  if (showImage) {
    return (
      <View
        style={[
          styles.ring,
          {
            width: dim + ringWidth * 2,
            height: dim + ringWidth * 2,
            borderRadius: (dim + ringWidth * 2) / 2,
            borderWidth: ringWidth,
          },
          style,
        ]}
      >
        <Image
          source={{ uri }}
          style={[
            styles.image,
            { width: dim, height: dim, borderRadius: dim / 2 },
          ]}
          contentFit="cover"
          transition={300}
          recyclingKey={uri}
          placeholder={{ blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH' }}
          onError={() => setImgError(true)}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.ring,
        {
          width: dim + ringWidth * 2,
          height: dim + ringWidth * 2,
          borderRadius: (dim + ringWidth * 2) / 2,
          borderWidth: ringWidth,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.fallback,
          { width: dim, height: dim, borderRadius: dim / 2 },
        ]}
      >
        <Text style={[styles.initials, size === 'sm' && styles.initialsSmall]}>
          {getInitials(name)}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  ring: {
    borderColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.sm,
  },
  image: {
    backgroundColor: c.border,
  },
  fallback: {
    backgroundColor: colors.forest[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...type.bodySm.bold,
    color: '#ffffff',
  },
  initialsSmall: {
    ...type.caption.regular,
    fontWeight: '700',
  },
});
