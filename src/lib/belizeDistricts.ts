import type { BelizeDistrict } from '@/types/database';

/**
 * Approximate district boundary polygons for Belize.
 * Coordinates are [longitude, latitude] (GeoJSON convention).
 * Simplified shapes — accurate enough for map overlay visualization.
 */
const DISTRICT_POLYGONS: Record<BelizeDistrict, number[][]> = {
  corozal: [
    [-88.82, 18.08], [-88.82, 18.50], [-87.49, 18.50],
    [-87.49, 17.80], [-88.35, 17.80], [-88.82, 18.08],
  ],
  orange_walk: [
    [-89.22, 17.35], [-89.22, 18.50], [-88.82, 18.50],
    [-88.82, 18.08], [-88.35, 17.80], [-88.35, 17.35], [-89.22, 17.35],
  ],
  belize: [
    [-88.35, 17.80], [-87.49, 17.80], [-87.49, 16.90],
    [-88.10, 16.90], [-88.50, 17.10], [-88.35, 17.35], [-88.35, 17.80],
  ],
  cayo: [
    [-89.22, 16.50], [-89.22, 17.35], [-88.35, 17.35],
    [-88.50, 17.10], [-88.10, 16.90], [-88.50, 16.50], [-89.22, 16.50],
  ],
  stann_creek: [
    [-88.10, 16.90], [-87.49, 16.90], [-87.49, 16.10],
    [-88.50, 16.10], [-88.50, 16.50], [-88.10, 16.90],
  ],
  toledo: [
    [-89.22, 15.89], [-89.22, 16.50], [-88.50, 16.50],
    [-88.50, 16.10], [-87.49, 16.10], [-87.49, 15.89], [-89.22, 15.89],
  ],
};

export function getDistrictBoundariesGeoJSON(
  highlightDistrict?: BelizeDistrict | null,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = (
    Object.entries(DISTRICT_POLYGONS) as [BelizeDistrict, number[][]][]
  ).map(([key, coords]) => ({
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
    properties: {
      district: key,
      highlighted: key === (highlightDistrict ?? ''),
    },
  }));

  return { type: 'FeatureCollection', features };
}
