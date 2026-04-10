import { supabase } from './supabase';
import { BELIZE_BBOX } from './constants';

export const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN!;

/** @deprecated Use BELIZE_BBOX from '@/lib/constants' directly. Re-exported for backward compat. */
export const BELIZE_BOUNDS = BELIZE_BBOX;

/** Center of Belize for default map view */
export const BELIZE_CENTER = {
  latitude: 17.189,
  longitude: -88.497,
} as const;

export const BELIZE_ZOOM = 7;

// ── Mapbox Directions API ────────────────────────────────────────────

/** Belize pump prices are reported per imperial gallon. */
const BELIZE_GALLON_LITRES = 4.54609;

/**
 * Average vehicle fuel economy in Belize (km per litre).
 * Keep this a bit conservative because many rides are pickups/SUVs and
 * traffic, A/C usage, and road conditions make 8 km/L feel too optimistic.
 */
const AVG_KM_PER_LITRE = 7;

/**
 * Cushion route fuel estimates so they don't understate stop-and-go usage.
 * This is still a fuel estimate, not a full operating-cost model.
 */
const FUEL_ESTIMATE_BUFFER_MULTIPLIER = 1.1;

/**
 * Fallback regular fuel price in BZD per Belize/imperial gallon.
 * Calibrated to current March/April 2026 Belize pricing when no recent
 * crowd-reported gas prices are available in the database.
 */
const DEFAULT_REGULAR_BZD_PER_GALLON = 13.93;
const DEFAULT_FUEL_PRICE_PER_LITRE = DEFAULT_REGULAR_BZD_PER_GALLON / BELIZE_GALLON_LITRES;

/** How many days of gas price reports to consider "recent" */
const FUEL_PRICE_LOOKBACK_DAYS = 30;

/** Cached fuel price to avoid repeated DB calls within a session */
let _cachedFuelPrice: number | null = null;

/**
 * Fetch the current regular fuel price (BZD per Belize gallon → per litre) from
 * recent community `gas_prices` reports.  Uses the median of all reports
 * from the last 30 days.  Falls back to the single most recent report if
 * no reports exist in that window.
 */
async function getFuelPricePerLitre(): Promise<number> {
  if (_cachedFuelPrice !== null) return _cachedFuelPrice;

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - FUEL_PRICE_LOOKBACK_DAYS);

    const { data } = await supabase
      .from('gas_prices')
      .select('regular_cents')
      .not('regular_cents', 'is', null)
      .gte('reported_at', cutoff.toISOString())
      .order('reported_at', { ascending: false })
      .limit(50);

    const prices = (data ?? [])
      .map((r) => r.regular_cents as number)
      .filter((c) => c > 0);

    if (prices.length === 0) {
      // Fallback: grab the single most recent report ever
      const { data: latest } = await supabase
        .from('gas_prices')
        .select('regular_cents')
        .not('regular_cents', 'is', null)
        .order('reported_at', { ascending: false })
        .limit(1)
        .single();

      if (latest?.regular_cents) {
        // Stored as cents-per-Belize-gallon → convert to BZD/litre
        _cachedFuelPrice = latest.regular_cents / 100 / BELIZE_GALLON_LITRES;
        return _cachedFuelPrice;
      }
      // absolute fallback — should rarely happen
      _cachedFuelPrice = DEFAULT_FUEL_PRICE_PER_LITRE;
      return _cachedFuelPrice;
    }

    // Median of recent reports (cents per Belize gallon)
    prices.sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    const medianCents =
      prices.length % 2 === 0
        ? (prices[mid - 1] + prices[mid]) / 2
        : prices[mid];

    // Convert: cents → dollars, Belize gallon → litres
    _cachedFuelPrice = medianCents / 100 / BELIZE_GALLON_LITRES;
    return _cachedFuelPrice;
  } catch {
    _cachedFuelPrice = DEFAULT_FUEL_PRICE_PER_LITRE; // last-resort fallback
    return _cachedFuelPrice;
  }
}

export interface RouteInfo {
  /** Driving distance in kilometres */
  distance_km: number;
  /** Estimated travel time in minutes */
  duration_minutes: number;
  /** Estimated fuel cost in BZD cents */
  fuel_cost_cents: number;
  /** GeoJSON LineString geometry of the route */
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

/**
 * Calculate driving route between two points using Mapbox Directions API.
 * Returns distance, duration, fuel cost estimate, and route geometry.
 */
export async function calculateRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<RouteInfo> {
  const coords = `${originLng},${originLat};${destLng},${destLat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?geometries=geojson&overview=full&access_token=${MAPBOX_ACCESS_TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mapbox Directions error: ${res.status}`);
  }

  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) {
    throw new Error('No route found between these locations');
  }

  const distanceMeters: number = route.distance;
  const durationSeconds: number = route.duration;
  const geometry = route.geometry as RouteInfo['geometry'];

  const distance_km = distanceMeters / 1000;
  const duration_minutes = Math.round(durationSeconds / 60);

  // Fuel cost: distance_km / km_per_litre = litres × price_per_litre = BZD
  const fuelPricePerLitre = await getFuelPricePerLitre();
  const litresUsed = distance_km / AVG_KM_PER_LITRE;
  const fuelCostBZD = litresUsed * fuelPricePerLitre * FUEL_ESTIMATE_BUFFER_MULTIPLIER;
  const fuel_cost_cents = Math.round(fuelCostBZD * 100);

  return { distance_km, duration_minutes, fuel_cost_cents, geometry };
}

/** Format km to display string: "45.2 km" or "1.3 km" */
export function formatDistance(km: number): string {
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Format minutes to display string: "45 min" or "1 hr 20 min" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
}

// ── Reverse Geocoding ────────────────────────────────────────────────

import { findNearestPoi } from './belizePois';

/**
 * Reverse-geocode coordinates to a place name.
 * Checks local POI database first (instant, offline-capable), then
 * falls back to the Mapbox Geocoding API for broader coverage.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // Try local POI data first — instant, no network needed
  const nearbyPoi = findNearestPoi(lat, lng, 100);
  if (nearbyPoi) return nearbyPoi.place_name;

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
    `?access_token=${MAPBOX_ACCESS_TOKEN}&types=place,locality,neighborhood,address,poi&limit=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const data = await res.json();
    const feature = data.features?.[0];
    return feature?.place_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

// ── Mapbox Static Map URL builders ───────────────────────────────────

/** Max URL length for Mapbox Static Images API. */
const MAX_STATIC_URL_LENGTH = 8000;

/**
 * Downsample a coordinate array by keeping every Nth point plus
 * the first and last points, ensuring the route shape is preserved
 * while fitting within URL length limits.
 */
function simplifyCoordinates(
  coords: [number, number][],
  maxPoints: number,
): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const result: [number, number][] = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  result.push(coords[coords.length - 1]); // always include last point
  return result;
}

/**
 * Build a Mapbox Static Image URL showing the driving route between two
 * points. Uses the actual route geometry when available, otherwise falls
 * back to a straight line. Automatically simplifies geometry to stay
 * within URL length limits.
 */
export function buildRouteMapUrl(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  opts: {
    width: number;
    height: number;
    routeGeometry?: { type: string; coordinates: [number, number][] } | null;
    padding?: number;
  },
): string {
  const { width, height, routeGeometry, padding = 50 } = opts;

  let lineCoords: [number, number][] = routeGeometry?.coordinates ?? [
    [originLng, originLat],
    [destLng, destLat],
  ];

  // Start with at most 100 points and reduce further if the URL is too long
  lineCoords = simplifyCoordinates(lineCoords, 100);

  const buildUrl = (coords: [number, number][]): string => {
    const geojson = encodeURIComponent(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: {
              stroke: '#51c152',
              'stroke-width': 4,
              'stroke-opacity': 0.9,
            },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [originLng, originLat] },
            properties: { 'marker-size': 'small', 'marker-color': '#51c152' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [destLng, destLat] },
            properties: { 'marker-size': 'small', 'marker-color': '#ffffff' },
          },
        ],
      }),
    );

    return (
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/geojson(${geojson})` +
      `/auto/${width}x${height}?padding=${padding}&access_token=${MAPBOX_ACCESS_TOKEN}`
    );
  };

  let url = buildUrl(lineCoords);

  // Progressively reduce points until URL fits within limits
  let maxPoints = 100;
  while (url.length > MAX_STATIC_URL_LENGTH && maxPoints > 10) {
    maxPoints = Math.floor(maxPoints / 2);
    lineCoords = simplifyCoordinates(lineCoords, maxPoints);
    url = buildUrl(lineCoords);
  }

  return url;
}
