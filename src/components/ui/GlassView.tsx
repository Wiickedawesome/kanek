import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '@/theme';

interface GlassViewProps {
  intensity?: number;
  tint?: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function GlassView({
  intensity = 60,
  tint = 'light',
  style,
  children,
}: GlassViewProps) {
  // Flatten style to extract borderRadius for overflow clipping
  const flatStyle = StyleSheet.flatten(style) ?? {};
  const { borderRadius: br, ...restStyle } = flatStyle;

  // Web: BlurView uses CSS backdrop-filter which works well
  // Native: expo-blur uses native blur views
  const isDark = tint === 'dark';

  return (
    <View style={[
      styles.wrapper,
      isDark && styles.wrapperDark,
      br != null && { borderRadius: br },
      restStyle,
    ]}>
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, isDark ? styles.overlayDark : styles.overlay]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glass.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.glass.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      default: {
        shadowColor: colors.glass.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
    }),
  },
  overlay: {
    backgroundColor: colors.glass.background,
  },
  wrapperDark: {
    borderColor: colors.glass.darkBorder,
  },
  overlayDark: {
    backgroundColor: colors.glass.darkBackground,
  },
});
