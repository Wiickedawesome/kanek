import MapboxGL from '@rnmapbox/maps';
import NetInfo from '@react-native-community/netinfo';
import { BELIZE_BOUNDS } from '@/lib/mapbox';

/** Predefined regions for offline download */
export const OFFLINE_REGIONS = {
  all_belize: {
    name: 'All of Belize',
    bounds: [
      [BELIZE_BOUNDS.west, BELIZE_BOUNDS.south], // SW
      [BELIZE_BOUNDS.east, BELIZE_BOUNDS.north], // NE
    ] as [[number, number], [number, number]],
    minZoom: 6,
    maxZoom: 14,
  },
  belize_district: {
    name: 'Belize District',
    bounds: [
      [-88.55, 17.35],
      [-88.15, 17.65],
    ] as [[number, number], [number, number]],
    minZoom: 10,
    maxZoom: 14,
  },
  cayo: {
    name: 'Cayo District',
    bounds: [
      [-89.20, 16.80],
      [-88.55, 17.45],
    ] as [[number, number], [number, number]],
    minZoom: 10,
    maxZoom: 14,
  },
  orange_walk: {
    name: 'Orange Walk',
    bounds: [
      [-89.05, 17.65],
      [-88.40, 18.30],
    ] as [[number, number], [number, number]],
    minZoom: 10,
    maxZoom: 14,
  },
  stann_creek: {
    name: 'Stann Creek',
    bounds: [
      [-88.70, 16.50],
      [-88.15, 17.10],
    ] as [[number, number], [number, number]],
    minZoom: 10,
    maxZoom: 14,
  },
  corozal: {
    name: 'Corozal District',
    bounds: [
      [-88.70, 18.10],
      [-88.20, 18.50],
    ] as [[number, number], [number, number]],
    minZoom: 10,
    maxZoom: 14,
  },
  toledo: {
    name: 'Toledo District',
    bounds: [
      [-89.20, 15.89],
      [-88.30, 16.50],
    ] as [[number, number], [number, number]],
    minZoom: 10,
    maxZoom: 14,
  },
} as const;

export type OfflineRegionKey = keyof typeof OFFLINE_REGIONS;

export interface DownloadProgress {
  percentage: number;
  completedTileCount: number;
  completedTileSize: number;
  completedResourceCount: number;
  completedResourceSize: number;
  requiredResourceCount: number;
}

/**
 * Download an offline map pack.
 * Returns a function to unsubscribe from progress updates.
 */
export function downloadOfflinePack(
  regionKey: OfflineRegionKey,
  onProgress: (progress: DownloadProgress) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
): () => void {
  const region = OFFLINE_REGIONS[regionKey];

  const pack = MapboxGL.offlineManager.createPack(
    {
      name: regionKey,
      styleURL: MapboxGL.StyleURL.Street,
      bounds: region.bounds,
      minZoom: region.minZoom,
      maxZoom: region.maxZoom,
    },
    (_, status) => {
      if (status) {
        onProgress(status as unknown as DownloadProgress);
        if (status.percentage === 100) {
          onComplete();
        }
      }
    },
    (_, error) => {
      if (error) {
        onError(new Error(error.message ?? 'Download failed'));
      }
    },
  );

  return () => {
    // Pause if user navigates away
    void pack;
  };
}

/** Delete a downloaded offline pack */
export async function deleteOfflinePack(regionKey: OfflineRegionKey): Promise<void> {
  await MapboxGL.offlineManager.deletePack(regionKey);
}

/** Get list of downloaded packs */
export async function getOfflinePacks(): Promise<string[]> {
  const packs = await MapboxGL.offlineManager.getPacks();
  return packs?.map((p: { name: string }) => p.name) ?? [];
}

/** Check if device is online */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
}
