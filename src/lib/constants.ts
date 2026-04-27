/** Phone must be +501 + exactly 7 digits */
export const PHONE_REGEX = /^\+501[0-9]{7}$/;

/** Belize bounding box */
export const BELIZE_BBOX = {
  north: 18.497,
  south: 15.889,
  east: -87.485,
  west: -89.225,
} as const;

/** Max file size for ID uploads (5 MB) */
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

/** Minimum image width for ID photos */
export const MIN_IMAGE_WIDTH = 640;

export const POST_TYPES = ['route_offer', 'route_request', 'errand', 'package', 'job'] as const;

export const MAX_SEATS = 20;
export const MAX_PRICE_CENTS = 999_900;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_NAME_LENGTH = 50;
export const MAX_TITLE_LENGTH = 100;

/** Launch flag: E-Kyash is deferred until the later payments rollout. */
export const ENABLE_EKYASH = false;
export const EKYASH_COMING_SOON_MESSAGE = 'E-Kyash is coming soon and is not part of this launch yet.';
export const ENABLE_EMAIL_AUTH = process.env.EXPO_PUBLIC_ENABLE_EMAIL_AUTH !== 'false';
export const ENABLE_GOOGLE_AUTH = process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';
export const ENABLE_APPLE_AUTH = process.env.EXPO_PUBLIC_ENABLE_APPLE_AUTH === 'true';
export const SOS_DELIVERY_METHOD = 'email' as const;

/** Number of top routes to show on explore feed */
export const TOP_ROUTES_LIMIT = 10;

/** Number of gas prices to show on explore feed */
export const GAS_PRICES_LIMIT = 5;

/** Center coordinates per district (derived from offline region bounds) */
export const DISTRICT_CENTERS: Record<
  import('@/types/database').BelizeDistrict,
  { latitude: number; longitude: number }
> = {
  belize: { latitude: 17.50, longitude: -88.35 },
  cayo: { latitude: 17.125, longitude: -88.875 },
  corozal: { latitude: 18.22, longitude: -88.45 },
  orange_walk: { latitude: 17.975, longitude: -88.725 },
  stann_creek: { latitude: 16.80, longitude: -88.425 },
  toledo: { latitude: 16.25, longitude: -88.75 },
};

/** Labels for district chips */
export const BELIZE_DISTRICTS: { key: import('@/types/database').BelizeDistrict; label: string }[] = [
  { key: 'belize', label: 'Belize' },
  { key: 'cayo', label: 'Cayo' },
  { key: 'corozal', label: 'Corozal' },
  { key: 'orange_walk', label: 'Orange Walk' },
  { key: 'stann_creek', label: 'Stann Creek' },
  { key: 'toledo', label: 'Toledo' },
];

/** Preset distance radius options in km */
export const DISTANCE_PRESETS = [5, 10, 25, 50] as const;

/** Default zoom when centering on user position or district */
export const DEFAULT_NEARBY_ZOOM = 11;
