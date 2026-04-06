import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { colors, borderRadius, spacing } from '@/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** Individual skeleton bone with shimmer animation */
export function Skeleton({ width = '100%', height = 16, radius = 6, style }: SkeletonProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.bezier(0.4, 0, 0.6, 1) }),
      -1,
      false,
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0.3, 0.7, 0.3]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius: radius,
          backgroundColor: colors.neutral[200],
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Skeleton mimicking a feed card (route/errand/job) */
export function FeedCardSkeleton() {
  return (
    <View style={skeletonStyles.card}>
      {/* Badge row */}
      <View style={skeletonStyles.row}>
        <Skeleton width={72} height={22} radius={borderRadius.pill} />
        <Skeleton width={60} height={22} radius={borderRadius.pill} />
      </View>
      {/* Title */}
      <Skeleton width="75%" height={18} radius={4} />
      {/* Route info */}
      <View style={skeletonStyles.row}>
        <Skeleton width={14} height={14} radius={7} />
        <Skeleton width="60%" height={14} radius={4} />
      </View>
      {/* Footer */}
      <View style={[skeletonStyles.row, skeletonStyles.footer]}>
        <Skeleton width={80} height={14} radius={4} />
        <Skeleton width={50} height={14} radius={4} />
      </View>
    </View>
  );
}

/** Skeleton for top route compact card */
export function TopRouteCardSkeleton() {
  return (
    <View style={skeletonStyles.topRouteCard}>
      <Skeleton width={140} height={90} radius={borderRadius.md} />
      <View style={skeletonStyles.topRouteText}>
        <Skeleton width={100} height={14} radius={4} />
        <Skeleton width={60} height={12} radius={4} />
      </View>
    </View>
  );
}

/** Skeleton for a profile header area */
export function ProfileSkeleton() {
  return (
    <View style={skeletonStyles.profileContainer}>
      <Skeleton width={72} height={72} radius={36} />
      <Skeleton width={140} height={20} radius={4} style={{ marginTop: spacing.md }} />
      <Skeleton width={100} height={14} radius={4} />
      <View style={[skeletonStyles.row, { marginTop: spacing.lg }]}>
        <Skeleton width={60} height={24} radius={borderRadius.md} />
        <Skeleton width={80} height={24} radius={borderRadius.md} />
        <Skeleton width={70} height={24} radius={borderRadius.md} />
      </View>
    </View>
  );
}

/** Multiple feed card skeletons for a loading list */
export function FeedListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={skeletonStyles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <FeedCardSkeleton key={i} />
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  footer: {
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    marginTop: spacing.xs,
  },
  topRouteCard: {
    width: 140,
    gap: spacing.sm,
  },
  topRouteText: {
    gap: spacing.xs,
  },
  profileContainer: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  list: {
    gap: spacing.md,
  },
});

