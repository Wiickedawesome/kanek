import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Icon } from '@/components/icons';
import { showAlert } from '@/lib/alert';
import { spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { Text } from '@/components/ui/Text';

interface TaxiVerifiedBadgeProps {
  associationName?: string | null;
  memberId?: string | null;
  district?: string | null;
  variant?: 'compact' | 'pill' | 'banner';
  onPress?: () => void;
  style?: object;
}

const GOLD_COLOR = '#F59E0B'; // Amber / Gold
const GOLD_DARK = '#D97706';
const GOLD_BG = 'rgba(245, 158, 11, 0.14)';
const GOLD_BORDER = 'rgba(245, 158, 11, 0.40)';

export const TaxiVerifiedBadge = React.memo(function TaxiVerifiedBadge({
  associationName,
  memberId,
  district,
  variant = 'compact',
  onPress,
  style,
}: TaxiVerifiedBadgeProps) {
  const { c, isDark } = useTheme();
  const styles = createStyles(c, isDark);

  const displayName = associationName?.trim() || 'Official Taxi Association';

  const handleDefaultPress = () => {
    showAlert(
      'Verified Taxi Operator',
      `This driver is verified as an active member of ${displayName}${
        memberId ? ` (Member #${memberId})` : ''
      }${district ? ` in ${district}` : ''}. Credentials have been reviewed by Kanek.`
    );
  };

  const pressAction = onPress ?? handleDefaultPress;

  if (variant === 'compact') {
    return (
      <Pressable
        accessibilityLabel="Verified Taxi Driver"
        accessibilityHint="Tap for verification details"
        onPress={pressAction}
        style={[styles.compactBadge, style]}
        hitSlop={6}
      >
        <Icon name="taxi-verified" size={16} color={isDark ? GOLD_COLOR : GOLD_DARK} />
      </Pressable>
    );
  }

  if (variant === 'pill') {
    return (
      <Pressable
        accessibilityLabel={`Verified Taxi Driver: ${displayName}`}
        onPress={pressAction}
        style={[styles.pillBadge, style]}
      >
        <Icon name="taxi-verified" size={15} color={isDark ? GOLD_COLOR : GOLD_DARK} />
        <Text variant="caption" weight="semibold" style={styles.pillText} numberOfLines={1}>
          {associationName ? displayName : 'Verified Taxi'}
        </Text>
      </Pressable>
    );
  }

  // Banner variant for Trust Profile / Profile detail
  return (
    <View style={[styles.bannerCard, style]}>
      <View style={styles.bannerHeader}>
        <View style={styles.bannerIconWrap}>
          <Icon name="taxi-verified" size={22} color={isDark ? GOLD_COLOR : GOLD_DARK} />
        </View>
        <View style={styles.bannerTextWrap}>
          <View style={styles.bannerTitleRow}>
            <Text variant="bodySm" weight="bold" style={styles.bannerTitle}>
              Verified Taxi Operator
            </Text>
            <View style={styles.verifiedTag}>
              <Text variant="caption" weight="semibold" style={styles.verifiedTagText}>
                VERIFIED
              </Text>
            </View>
          </View>
          <Text variant="bodySm" weight="medium" style={styles.associationName} numberOfLines={2}>
            {displayName}
          </Text>
          {(memberId || district) && (
            <Text variant="caption" weight="regular" style={styles.bannerMeta}>
              {memberId ? `Member #${memberId}` : ''}
              {memberId && district ? ' • ' : ''}
              {district ? district : ''}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
});

const createStyles = (c: SemanticColors, isDark: boolean) =>
  StyleSheet.create({
    compactBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 3,
      borderRadius: borderRadius.pill,
      backgroundColor: GOLD_BG,
      borderWidth: 1,
      borderColor: GOLD_BORDER,
    },
    pillBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: borderRadius.pill,
      backgroundColor: GOLD_BG,
      borderWidth: 1,
      borderColor: GOLD_BORDER,
    },
    pillText: {
      color: isDark ? GOLD_COLOR : GOLD_DARK,
    },
    bannerCard: {
      backgroundColor: GOLD_BG,
      borderColor: GOLD_BORDER,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginVertical: spacing.sm,
    },
    bannerHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    bannerIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.20)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: GOLD_BORDER,
    },
    bannerTextWrap: {
      flex: 1,
    },
    bannerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.xs,
      marginBottom: 2,
    },
    bannerTitle: {
      color: isDark ? GOLD_COLOR : GOLD_DARK,
    },
    verifiedTag: {
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.20)',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: borderRadius.sm,
    },
    verifiedTagText: {
      fontSize: 10,
      color: isDark ? GOLD_COLOR : GOLD_DARK,
      letterSpacing: 0.5,
    },
    associationName: {
      color: c.text,
      marginTop: 1,
    },
    bannerMeta: {
      color: c.textMuted,
      marginTop: 2,
    },
  });
