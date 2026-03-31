import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius } from '@/theme';
import type { RootState, AppDispatch } from '@/store';
import { dismissToast } from '@/store/slices/toastSlice';

export function InAppToast() {
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const toast = useSelector((s: RootState) => s.toast.current);
  const translateY = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (toast) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();

      timerRef.current = setTimeout(() => {
        hideToast();
      }, 4000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast]);

  const hideToast = () => {
    Animated.timing(translateY, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      dispatch(dismissToast());
    });
  };

  if (!toast) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }], paddingTop: insets.top + spacing.xs },
      ]}
    >
      <Pressable style={styles.content} onPress={hideToast}>
        <View style={styles.iconCircle}>
          <Icon name="bell" size={18} color={colors.neutral[0]} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
          {toast.body ? (
            <Text style={styles.body} numberOfLines={2}>{toast.body}</Text>
          ) : null}
        </View>
        <Icon name="x" size={16} color={colors.neutral[400]} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent.green,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.forest[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.body1Bold,
    color: colors.forest[900],
  },
  body: {
    ...typography.body2,
    color: colors.neutral[500],
  },
});
