/**
 * Local Belize POI search — instant results from 7,794 OSM points of interest.
 * Data covers stores, restaurants, hotels, schools, government offices, gas stations, etc.
 */

import poisRaw from '@/data/belize-pois.json';

interface RawPoi {
  n: string; // name
  c: string; // category
  lt: number; // latitude
  ln: number; // longitude
  a?: string; // address
  p?: string; // phone
  h?: string; // hours
}

export interface PoiResult {
  id: string;
  place_name: string;
  lat: number;
  lng: number;
  category: string;
}

/** Human-readable labels for POI categories */
export const POI_CATEGORY_LABELS: Record<string, string> = {
  store: 'Store',
  restaurant: 'Restaurant',
  services: 'Services',
  hotel: 'Hotel',
  school: 'School',
  worship: 'Place of Worship',
  supermarket: 'Supermarket',
  government: 'Government',
  bar: 'Bar',
  attraction: 'Attraction',
  park: 'Park',
  food_shop: 'Food Shop',
  hospital: 'Hospital',
  bank: 'Bank',
  gas_station: 'Gas Station',
  transport: 'Transport',
  cafe: 'Cafe',
  pharmacy: 'Pharmacy',
  community: 'Community',
  market: 'Market',
};

// ── Lazy-init search index (deferred from import time) ───────────

const pois = poisRaw as RawPoi[];

/** Lowercase name + category for fast matching — built on first use */
let _searchIndex: { lowerName: string; lowerCategory: string }[] | null = null;

function getSearchIndex() {
  if (!_searchIndex) {
    _searchIndex = pois.map((p) => ({
      lowerName: p.n.toLowerCase(),
      lowerCategory: p.c.toLowerCase(),
    }));
  }
  return _searchIndex;
}

// ── Nearest POI (for reverse geocoding) ─────────────────────────

/** Approximate metres per degree at Belize's latitude (~17°N) */
const METRES_PER_DEG_LAT = 111_320;
const METRES_PER_DEG_LNG = 111_320 * Math.cos((17 * Math.PI) / 180);

/**
 * Find the closest POI to a coordinate, within a radius (metres).
 * Returns null if nothing is nearby. Uses simple Euclidean on lat/lng
 * which is accurate enough for short distances at Belize's latitude.
 */
export function findNearestPoi(
  lat: number,
  lng: number,
  radiusMetres = 100,
): PoiResult | null {
  let bestDist = Infinity;
  let bestIdx = -1;

  for (let i = 0; i < pois.length; i++) {
    const dLat = (pois[i].lt - lat) * METRES_PER_DEG_LAT;
    const dLng = (pois[i].ln - lng) * METRES_PER_DEG_LNG;
    const dist = dLat * dLat + dLng * dLng; // squared — skip sqrt for perf
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  if (bestIdx === -1) return null;

  const radiusSq = radiusMetres * radiusMetres;
  if (bestDist > radiusSq) return null;

  const poi = pois[bestIdx];
  const label = POI_CATEGORY_LABELS[poi.c] ?? poi.c;
  const parts = [poi.n];
  if (poi.a) parts.push(poi.a);
  parts.push(label);

  return {
    id: `local-poi-nearest-${poi.lt}-${poi.ln}`,
    place_name: parts.join(', '),
    lat: poi.lt,
    lng: poi.ln,
    category: poi.c,
  };
}

// ── Search ──────────────────────────────────────────────────────

/**
 * Search local Belize POIs by name. Returns instant results (no network).
 * Scores: exact prefix > word-boundary match > substring match.
 */
export function searchLocalPois(query: string, limit = 5): PoiResult[] {
  if (query.length < 2) return [];

  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/);

  const scored: { poi: RawPoi; score: number }[] = [];

  const idx = getSearchIndex();
  for (let i = 0; i < pois.length; i++) {
    const { lowerName, lowerCategory } = idx[i];

    // Skip if none of the query words appear in name or category
    if (!words.some((w) => lowerName.includes(w) || lowerCategory.includes(w))) continue;

    let score = 0;

    // Exact prefix match on full query (best)
    if (lowerName.startsWith(q)) {
      score = 100;
    }
    // Word boundary match — name contains a word starting with query
    else if (lowerName.includes(` ${q}`) || lowerName.includes(`(${q}`)) {
      score = 80;
    }
    // All query words present in name
    else if (words.every((w) => lowerName.includes(w))) {
      score = 60;
    }
    // Category match + partial name match
    else if (lowerCategory.includes(q) || words.some((w) => lowerCategory === w)) {
      score = 40;
    }
    // Partial substring
    else {
      score = 20;
    }

    // Shorter names score slightly higher (more specific)
    score += Math.max(0, 10 - lowerName.length / 10);

    scored.push({ poi: pois[i], score });
  }

  // Sort by score descending, then alphabetically
  scored.sort((a, b) => b.score - a.score || a.poi.n.localeCompare(b.poi.n));

  return scored.slice(0, limit).map(({ poi }, idx) => {
    const label = POI_CATEGORY_LABELS[poi.c] ?? poi.c;
    const parts = [poi.n];
    if (poi.a) parts.push(poi.a);
    parts.push(label);

    return {
      id: `local-poi-${idx}-${poi.lt}-${poi.ln}`,
      place_name: parts.join(', '),
      lat: poi.lt,
      lng: poi.ln,
      category: poi.c,
    };
  });
}
