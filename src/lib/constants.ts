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

/** Number of top routes to show on explore feed */
export const TOP_ROUTES_LIMIT = 10;

/** Number of gas prices to show on explore feed */
export const GAS_PRICES_LIMIT = 5;
