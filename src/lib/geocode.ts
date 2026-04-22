/**
 * Shared geocoding — merges instant local Belize POI results with Mapbox API results.
 * Used by LocationInput and MapPicker to avoid duplicated geocoding logic.
 */

import { MAPBOX_ACCESS_TOKEN } from '@/lib/mapbox';
import { BELIZE_BBOX } from '@/lib/constants';
import { searchLocalPois } from '@/lib/belizePois';

export interface GeocodeSuggestion {
  id: string;
  place_name: string;
  lat: number;
  lng: number;
  /** 'local' for POI data, 'mapbox' for API results */
  source: 'local' | 'mapbox';
}

/**
 * Search for places by combining local Belize POIs (instant) with Mapbox Geocoding v5 (async).
 * Local results are returned first in the merged array.
 */
export async function searchPlaces(
  query: string,
  options: { limit?: number; minChars?: number } = {},
): Promise<GeocodeSuggestion[]> {
  const { limit = 6, minChars = 2 } = options;
  if (query.length < minChars) return [];

  // 1. Instant local results
  const localResults = searchLocalPois(query, limit);
  const local: GeocodeSuggestion[] = localResults.map((r) => ({
    id: r.id,
    place_name: r.place_name,
    lat: r.lat,
    lng: r.lng,
    source: 'local' as const,
  }));

  // 2. Mapbox API results (run in parallel with local search above, but local is sync)
  let mapbox: GeocodeSuggestion[] = [];
  try {
    const bbox = `${BELIZE_BBOX.west},${BELIZE_BBOX.south},${BELIZE_BBOX.east},${BELIZE_BBOX.north}`;
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${MAPBOX_ACCESS_TOKEN}&bbox=${bbox}&country=BZ&limit=${limit}` +
      `&types=place,locality,neighborhood,address,poi`;

    const res = await fetch(url);
    const data = await res.json();
    mapbox = (data.features ?? []).map(
      (f: { id: string; place_name: string; center: [number, number] }) => ({
        id: f.id,
        place_name: f.place_name,
        lat: f.center[1],
        lng: f.center[0],
        source: 'mapbox' as const,
      }),
    );
  } catch {
    // Network failure — still return local results
  }

  // 3. Merge: local first, then mapbox, deduplicated by proximity + name similarity
  return deduplicateResults([...local, ...mapbox], limit);
}

/**
 * Remove near-duplicate results (same name within ~100m).
 * Keeps the first occurrence (local results preferred since they come first).
 */
function deduplicateResults(items: GeocodeSuggestion[], limit: number): GeocodeSuggestion[] {
  const kept: GeocodeSuggestion[] = [];

  for (const item of items) {
    if (kept.length >= limit) break;

    const nameLower = item.place_name.toLowerCase();
    const isDuplicate = kept.some((k) => {
      // Same-ish name and within ~200m
      const nameOverlap =
        nameLower.includes(k.place_name.toLowerCase().split(',')[0]) ||
        k.place_name.toLowerCase().includes(nameLower.split(',')[0]);
      if (!nameOverlap) return false;

      const dlat = Math.abs(item.lat - k.lat);
      const dlng = Math.abs(item.lng - k.lng);
      return dlat < 0.002 && dlng < 0.002; // ~200m
    });

    if (!isDuplicate) {
      kept.push(item);
    }
  }

  return kept;
}
