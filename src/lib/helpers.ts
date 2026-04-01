import { Linking, Platform, ActionSheetIOS, Alert } from 'react-native';
import { router } from 'expo-router';
import { PHONE_REGEX, BELIZE_BBOX } from './constants';

const BZ_LOCALE = 'en-BZ';

interface OpenMapsLocation {
  lat: number;
  lng: number;
  label?: string;
}

/** Open a location or route in an external maps app (Google Maps, Apple Maps, Waze). */
export function openInMaps(
  origin?: OpenMapsLocation | null,
  destination?: OpenMapsLocation | null,
) {
  if (!origin && !destination) return;

  // Build URLs for each maps provider
  const googleMapsUrl = buildGoogleMapsUrl(origin, destination);
  const appleMapsUrl = buildAppleMapsUrl(origin, destination);
  const wazeUrl = buildWazeUrl(destination ?? origin!);

  const options: { label: string; url: string }[] = [
    { label: 'Google Maps', url: googleMapsUrl },
    { label: 'Waze', url: wazeUrl },
  ];
  if (Platform.OS === 'ios') {
    options.unshift({ label: 'Apple Maps', url: appleMapsUrl });
  }

  if (Platform.OS === 'web') {
    // Web: just open Google Maps
    Linking.openURL(googleMapsUrl);
    return;
  }

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...options.map((o) => o.label), 'Cancel'],
        cancelButtonIndex: options.length,
        title: 'Open in Maps',
      },
      (idx) => {
        if (idx < options.length) Linking.openURL(options[idx].url);
      },
    );
  } else {
    // Android: use Alert with buttons
    Alert.alert(
      'Open in Maps',
      undefined,
      [
        ...options.map((o) => ({
          text: o.label,
          onPress: () => Linking.openURL(o.url),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }
}

function buildGoogleMapsUrl(
  origin?: OpenMapsLocation | null,
  destination?: OpenMapsLocation | null,
): string {
  if (origin && destination) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
  }
  const loc = destination ?? origin!;
  const q = loc.label ? encodeURIComponent(loc.label) : `${loc.lat},${loc.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function buildAppleMapsUrl(
  origin?: OpenMapsLocation | null,
  destination?: OpenMapsLocation | null,
): string {
  if (origin && destination) {
    return `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${destination.lat},${destination.lng}&dirflg=d`;
  }
  const loc = destination ?? origin!;
  return `https://maps.apple.com/?q=${loc.label ? encodeURIComponent(loc.label) : `${loc.lat},${loc.lng}`}&ll=${loc.lat},${loc.lng}`;
}

function buildWazeUrl(loc: OpenMapsLocation): string {
  return `https://waze.com/ul?ll=${loc.lat},${loc.lng}&navigate=yes`;
}

/** Format phone for display: +5016001234 → 600-1234 */
export function formatPhone(phone: string): string {
  const digits = phone.replace('+501', '');
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

/** Validate Belize phone number */
export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone);
}

/** Strip spaces, dashes, and parens from a phone string for validation */
export function normalizePhone(raw: string): string | null {
  const stripped = raw.replace(/[\s\-()]/g, '').trim();
  return stripped || null;
}

/** Check if coordinates are within Belize */
export function isInBelize(lat: number, lng: number): boolean {
  return (
    lat >= BELIZE_BBOX.south &&
    lat <= BELIZE_BBOX.north &&
    lng >= BELIZE_BBOX.west &&
    lng <= BELIZE_BBOX.east
  );
}

/** Format cents to BZD display: 1500 → "$15.00" */
export function formatBZD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Strip non-numeric chars, allow one decimal point. Use as onChangeText filter. */
export function sanitizeDecimal(text: string): string {
  let result = text.replace(/[^0-9.]/g, '');
  const dotIdx = result.indexOf('.');
  if (dotIdx !== -1) {
    result = result.slice(0, dotIdx + 1) + result.slice(dotIdx + 1).replace(/\./g, '');
    // Limit to 2 decimal places
    const decimals = result.slice(dotIdx + 1);
    if (decimals.length > 2) {
      result = result.slice(0, dotIdx + 3);
    }
  }
  return result;
}

/** Strip non-digit chars. Use as onChangeText filter for integer fields. */
export function sanitizeInteger(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

/** Parse DD/MM/YYYY + HH:MM into a Date. Returns null if invalid. */
export function parseBZDateTime(ddmmyyyy: string, hhmm: string): Date | null {
  const parts = ddmmyyyy.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${hhmm}`;
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? null : dt;
}

// ── Date / Time helpers (en-BZ, 12-hour) ────────────────────────────

/** "Today at 3:45 PM" / "Tomorrow at 9:00 AM" / "Mon, Mar 28 at 1:30 PM" */
export function formatDeparture(isoDate: string): string {
  const d = new Date(isoDate);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const time = d.toLocaleTimeString(BZ_LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true });

  if (d.toDateString() === now.toDateString()) return `Today at ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`;
  return `${d.toLocaleDateString(BZ_LOCALE, { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`;
}

/** "Mar 28, 2026, 3:45 PM" */
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(BZ_LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** "March 2026" (for member-since badges) */
export function formatMonthYear(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(BZ_LOCALE, {
    month: 'long',
    year: 'numeric',
  });
}

/** "28/03/2026" short date only */
export function formatShortDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(BZ_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** "28/03/2026, 3:45 PM" full date-time */
export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString(BZ_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Relative time: "just now" / "5m ago" / "3h ago" / "2d ago" */
export function getTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(isoDate);
}

/** Navigate back safely — uses history when available, otherwise navigates to fallback */
export function safeGoBack(fallback: string) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.navigate(fallback as any);
  }
}

/** Strip Expo Router group segments so current and target paths can be compared safely. */
export function normalizeAppPath(path: string): string {
  const normalized = path
    .split('?')[0]
    .replace(/\/\([^/]+\)/g, '')
    .replace(/\/+/g, '/');

  if (normalized === '' || normalized === '/') {
    return '/';
  }

  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}
