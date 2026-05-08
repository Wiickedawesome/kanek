import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/icons';
import { colors, type, spacing, borderRadius, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import type { Database } from '@/types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

interface ProfileCardProps {
  profile: ProfileRow;
  /** Compact mode hides stats */
  compact?: boolean;
}

export function ProfileCard({ profile, compact }: ProfileCardProps) {
  const { c } = useTheme();
  const styles = createStyles(c);
  const fullName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'User';

  return (
    <View style={styles.container}>
      <Avatar uri={profile.avatar_url} name={fullName} size={compact ? 'md' : 'lg'} />
      <View style={styles.info}>
        <Text style={styles.name}>{fullName}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {profile.role === 'driver' ? 'Driver' : 'Rider'}
          </Text>
        </View>
        {!compact && (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Icon name="star" size={14} color={colors.accent.green} />
              <Text style={styles.statText}>{(profile.rating_avg ?? 0).toFixed(1)}</Text>
            </View>
            <View style={styles.stat}>
              <Icon name="clock" size={14} color={c.textMuted} />
              <Text style={styles.statText}>{profile.punctuality_pct}%</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1, gap: spacing.xs },
  name: { ...type.body.bold, color: c.text },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.forest[600],
  },
  roleText: { ...type.caption.regular, color: c.textInverse, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { ...type.caption.regular, color: c.textMuted },
});
