import React from 'react';
import { StyleSheet, View, Platform, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';

interface GlassViewProps {
  children?: React.ReactNode;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: StyleProp<ViewStyle>;
}

export function GlassView({ children, intensity = 80, tint = 'light', style }: GlassViewProps) {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webFallback, style]}>
        {children}
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} tint={tint} style={[styles.blur, style]}>
      <View style={styles.overlay}>
        {children}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blur: {
    overflow: 'hidden',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  webFallback: {
    backgroundColor: 'rgba(246, 246, 244, 0.92)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
