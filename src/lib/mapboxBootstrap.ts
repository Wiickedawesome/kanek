/**
 * Single Mapbox token bootstrap.
 *
 * Imported once from `app/_layout.tsx`. Calling `MapboxGL.setAccessToken`
 * from multiple component modules is fragile — if any of those modules is
 * imported before the token is in `process.env`, the SDK silently
 * authenticates with `undefined` and tiles never load (looks like a
 * "broken" map). Centralising it here keeps the contract obvious.
 */
import { Platform } from 'react-native';
import { MAPBOX_ACCESS_TOKEN } from '@/lib/mapbox';

let initialized = false;

export function initMapbox(): void {
  if (initialized) return;
  initialized = true;

  if (!MAPBOX_ACCESS_TOKEN) {
    // Loud warning — empty token means no tiles render anywhere.
    console.warn(
      '[mapbox] EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is empty. Maps will not render.',
    );
    return;
  }

  if (Platform.OS === 'web') {
    // mapbox-gl reads its access token at map-create time
    // (see ExploreMapContent.web.tsx / MapPickerContent.web.tsx). No init
    // needed here.
    return;
  }

  // Native — @rnmapbox/maps requires an explicit setAccessToken before any
  // MapView mounts.
  // Lazy-require so web bundles never pull in the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MapboxGL = require('@rnmapbox/maps').default;
  MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);
}
