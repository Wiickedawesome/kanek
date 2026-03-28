export const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN!;

/** Belize bounding box — reject coordinates outside */
export const BELIZE_BOUNDS = {
  north: 18.497,
  south: 15.889,
  east: -87.485,
  west: -89.225,
} as const;

/** Center of Belize for default map view */
export const BELIZE_CENTER = {
  latitude: 17.189,
  longitude: -88.497,
} as const;

export const BELIZE_ZOOM = 7;
