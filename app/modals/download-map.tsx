import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
} from 'react-native';
import { showAlert, showConfirm } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons';
import { Button, ScreenHeader } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { safeGoBack } from '@/lib/helpers';
import {
  OFFLINE_REGIONS,
  downloadOfflinePack,
  deleteOfflinePack,
  getOfflinePacks,
  type OfflineRegionKey,
  type DownloadProgress,
} from '@/lib/offline';

interface RegionItem {
  key: OfflineRegionKey;
  name: string;
  downloaded: boolean;
}

export default function DownloadMapModal() {
  const [downloadedPacks, setDownloadedPacks] = useState<string[]>([]);
  const [activeDownload, setActiveDownload] = useState<OfflineRegionKey | null>(null);
  const [progress, setProgress] = useState(0);
  const unsubRef = useRef<(() => void) | null>(null);

  const loadPacks = useCallback(async () => {
    const packs = await getOfflinePacks();
    setDownloadedPacks(packs);
  }, []);

  useEffect(() => {
    loadPacks();
    return () => {
      unsubRef.current?.();
    };
  }, [loadPacks]);

  const regions: RegionItem[] = Object.entries(OFFLINE_REGIONS).map(
    ([key, region]) => ({
      key: key as OfflineRegionKey,
      name: region.name,
      downloaded: downloadedPacks.includes(key),
    }),
  );

  const handleDownload = (regionKey: OfflineRegionKey) => {
    if (activeDownload) return;
    setActiveDownload(regionKey);
    setProgress(0);

    const unsub = downloadOfflinePack(
      regionKey,
      (p: DownloadProgress) => {
        setProgress(Math.round(p.percentage));
      },
      () => {
        setActiveDownload(null);
        setProgress(0);
        loadPacks();
      },
      (error: Error) => {
        setActiveDownload(null);
        setProgress(0);
        showAlert('Download Failed', error.message);
      },
    );

    unsubRef.current = unsub;
  };

  const handleDelete = async (regionKey: OfflineRegionKey, name: string) => {
    const confirmed = await showConfirm(
      'Delete Map',
      `Remove "${name}" offline data? You can re-download anytime.`,
    );
    if (confirmed) {
      await deleteOfflinePack(regionKey);
      loadPacks();
    }
  };

  const renderItem = ({ item }: { item: RegionItem }) => {
    const isDownloading = activeDownload === item.key;

    return (
      <View style={styles.regionRow}>
        <View style={styles.regionInfo}>
          <Icon name="map-pin" size={20} color={colors.forest[700]} />
          <Text style={styles.regionName}>{item.name}</Text>
        </View>

        {isDownloading ? (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{progress}%</Text>
          </View>
        ) : item.downloaded ? (
          <Pressable
            style={styles.deleteBtn}
            onPress={() => handleDelete(item.key, item.name)}
            hitSlop={8}
          >
            <Icon name="chevron-right" size={16} color={colors.error} />
            <Text style={styles.deleteBtnText}>Remove</Text>
          </Pressable>
        ) : (
          <Button
            title="Download"
            onPress={() => handleDownload(item.key)}
            size="sm"
            disabled={activeDownload !== null}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader style={styles.header}>
        <Pressable onPress={() => safeGoBack('/(tabs)/explore/')} hitSlop={12}>
          <Icon name="chevron-left" size={24} color={colors.neutral[0]} />
        </Pressable>
        <Text style={styles.headerTitle}>Offline Maps</Text>
        <View style={{ width: 24 }} />
      </ScreenHeader>

      <View style={styles.content}>
        <Text style={styles.description}>
          Download maps for offline use. Works even without internet in rural areas.
        </Text>

        <FlatList
          data={regions}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />

        <Text style={styles.storageNote}>
          Each district is ~20–40 MB. {"\"All of Belize\""} is ~150 MB.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.neutral[0],
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  description: {
    ...typography.body1,
    color: colors.neutral[500],
  },
  list: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  regionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  regionName: {
    ...typography.body1,
    color: colors.forest[900],
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: 120,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.neutral[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.green,
    borderRadius: 3,
  },
  progressText: {
    ...typography.body2,
    color: colors.accent.green,
    width: 36,
    textAlign: 'right',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  deleteBtnText: {
    ...typography.body2,
    color: colors.error,
  },
  separator: {
    height: 1,
    backgroundColor: colors.neutral[100],
  },
  storageNote: {
    ...typography.body2,
    color: colors.neutral[400],
    textAlign: 'center',
  },
});
