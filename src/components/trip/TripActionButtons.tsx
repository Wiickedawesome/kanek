import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from '@/components/ui';
import { spacing } from '@/theme';
import { getNextEvent, isSequenceComplete } from '@/lib/tripEvents';
import { showConfirm } from '@/lib/alert';
import type { PostType } from '@/types/database';

interface Props {
  postType: PostType;
  completedEventTypes: string[];
  onTriggerEvent: (eventType: string) => Promise<void>;
  isLoading: boolean;
}

export function TripActionButtons({
  postType,
  completedEventTypes,
  onTriggerEvent,
  isLoading,
}: Props) {
  const nextEvent = getNextEvent(postType, completedEventTypes);
  const allDone = isSequenceComplete(postType, completedEventTypes);

  const handlePress = useCallback(async () => {
    if (!nextEvent) return;
    const confirmed = await showConfirm(
      nextEvent.label,
      `Mark as "${nextEvent.label}"? The other party will be notified.`,
    );
    if (confirmed) {
      await onTriggerEvent(nextEvent.type);
    }
  }, [nextEvent, onTriggerEvent]);

  // All events done or no sequence defined — parent handles "Complete" button
  if (allDone || !nextEvent) return null;

  return (
    <View style={styles.container}>
      <Button
        title={isLoading ? 'Updating...' : nextEvent.label}
        onPress={handlePress}
        disabled={isLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
});
