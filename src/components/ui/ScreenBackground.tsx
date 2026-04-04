import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { colors } from '@/theme';
import { TopographicBg } from './TopographicBg';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ScreenBackground({ children, style }: ScreenBackgroundProps) {
  return (
    <View style={[styles.container, style]}>
      <TopographicBg />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
});
