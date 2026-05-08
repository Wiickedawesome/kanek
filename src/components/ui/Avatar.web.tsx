import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { colors, type, shadows } from '@/theme';

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
  const dim = sizeMap[size];
  const ringWidth = size === 'lg' ? 2.5 : 2;
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [uri]);

  const showImage = !!uri && !imgError;

  return (
    <View
      style={[
        styles.ring,
        {
          width: dim + ringWidth * 2,
          height: dim + ringWidth * 2,
          borderRadius: (dim + ringWidth * 2) / 2,
          borderWidth: ringWidth,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={[
            styles.image,
            { width: dim, height: dim, borderRadius: dim / 2 },
          ]}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  image: {
    backgroundColor: colors.neutral[200],
  },
  fallback: {
    backgroundColor: colors.forest[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...type.bodySm.bold,
    color: colors.neutral[0],
  },
  initialsSmall: {
    ...type.caption.regular,
    fontWeight: '700',
  },
});
