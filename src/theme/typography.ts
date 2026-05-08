import { Platform, type TextStyle } from 'react-native';

/**
 * Font family identifiers — must exactly match the keys passed to
 * `useFonts(...)` in `app/_layout.tsx`. Use `Platform.select` only as a
 * placeholder; both branches resolve to the same identifier today.
 */
export const fonts = {
  heading: Platform.select({ ios: 'WorkSans-Bold', default: 'WorkSans-Bold' }),
  headingSemiBold: Platform.select({ ios: 'WorkSans-SemiBold', default: 'WorkSans-SemiBold' }),
  headingMedium: Platform.select({ ios: 'WorkSans-Medium', default: 'WorkSans-Medium' }),
  body: Platform.select({ ios: 'Manrope-Regular', default: 'Manrope-Regular' }),
  bodyMedium: Platform.select({ ios: 'Manrope-Medium', default: 'Manrope-Medium' }),
  bodySemiBold: Platform.select({ ios: 'Manrope-SemiBold', default: 'Manrope-SemiBold' }),
  bodyBold: Platform.select({ ios: 'Manrope-Bold', default: 'Manrope-Bold' }),
} as const;

/**
 * Type scale — Option B (body kept at 16). Sizes/line-heights match the
 * approved plan; tracking is in points (RN's `letterSpacing`).
 *
 * Each variant exposes weight sub-styles where useful:
 *  - display / h1 / h2     → bold only (headings render in WorkSans-Bold)
 *  - h3                    → bold + semibold + medium
 *  - subtitle              → regular + medium + semibold + bold
 *  - body / bodySm         → regular + medium + semibold + bold
 *  - caption               → regular + medium + semibold
 *  - overline              → medium only (uppercase by default)
 *
 * Consumers should prefer the `<Text variant="..." weight="...">` wrapper
 * (Phase 2). Direct use of `type.body.medium` etc. is supported but raw
 * `fontSize`/`fontWeight`/`fontFamily` overrides are banned outside this
 * file and the wrapper component.
 */

const BOLD: TextStyle['fontWeight'] = '700';
const SEMIBOLD: TextStyle['fontWeight'] = '600';
const MEDIUM: TextStyle['fontWeight'] = '500';
const REGULAR: TextStyle['fontWeight'] = '400';

export const type = {
  display: {
    bold: {
      fontFamily: fonts.heading,
      fontSize: 44,
      lineHeight: 48,
      fontWeight: BOLD,
      letterSpacing: -1.0,
    } as TextStyle,
  },
  h1: {
    bold: {
      fontFamily: fonts.heading,
      fontSize: 32,
      lineHeight: 38,
      fontWeight: BOLD,
      letterSpacing: -0.6,
    } as TextStyle,
  },
  h2: {
    bold: {
      fontFamily: fonts.heading,
      fontSize: 26,
      lineHeight: 32,
      fontWeight: BOLD,
      letterSpacing: -0.4,
    } as TextStyle,
  },
  h3: {
    bold: {
      fontFamily: fonts.heading,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: BOLD,
      letterSpacing: -0.2,
    } as TextStyle,
    semibold: {
      fontFamily: fonts.headingSemiBold,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: SEMIBOLD,
      letterSpacing: -0.2,
    } as TextStyle,
    medium: {
      fontFamily: fonts.headingMedium,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: MEDIUM,
      letterSpacing: -0.2,
    } as TextStyle,
  },
  subtitle: {
    regular: {
      fontFamily: fonts.body,
      fontSize: 18,
      lineHeight: 26,
      fontWeight: REGULAR,
      letterSpacing: 0,
    } as TextStyle,
    medium: {
      fontFamily: fonts.bodyMedium,
      fontSize: 18,
      lineHeight: 26,
      fontWeight: MEDIUM,
      letterSpacing: 0,
    } as TextStyle,
    semibold: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 18,
      lineHeight: 26,
      fontWeight: SEMIBOLD,
      letterSpacing: 0,
    } as TextStyle,
    bold: {
      fontFamily: fonts.bodyBold,
      fontSize: 18,
      lineHeight: 26,
      fontWeight: BOLD,
      letterSpacing: 0,
    } as TextStyle,
  },
  body: {
    regular: {
      fontFamily: fonts.body,
      fontSize: 16,
      lineHeight: 24,
      fontWeight: REGULAR,
      letterSpacing: 0,
    } as TextStyle,
    medium: {
      fontFamily: fonts.bodyMedium,
      fontSize: 16,
      lineHeight: 24,
      fontWeight: MEDIUM,
      letterSpacing: 0,
    } as TextStyle,
    semibold: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 16,
      lineHeight: 24,
      fontWeight: SEMIBOLD,
      letterSpacing: 0,
    } as TextStyle,
    bold: {
      fontFamily: fonts.bodyBold,
      fontSize: 16,
      lineHeight: 24,
      fontWeight: BOLD,
      letterSpacing: 0,
    } as TextStyle,
  },
  bodySm: {
    regular: {
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: REGULAR,
      letterSpacing: 0.1,
    } as TextStyle,
    medium: {
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: MEDIUM,
      letterSpacing: 0.1,
    } as TextStyle,
    semibold: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: SEMIBOLD,
      letterSpacing: 0.1,
    } as TextStyle,
    bold: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: BOLD,
      letterSpacing: 0.1,
    } as TextStyle,
  },
  caption: {
    regular: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: REGULAR,
      letterSpacing: 0.2,
    } as TextStyle,
    medium: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: MEDIUM,
      letterSpacing: 0.2,
    } as TextStyle,
    semibold: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: SEMIBOLD,
      letterSpacing: 0.2,
    } as TextStyle,
  },
  overline: {
    medium: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: MEDIUM,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    } as TextStyle,
  },
} as const;

export type TypographyVariant = keyof typeof type;
export type TypographyWeight<V extends TypographyVariant> = keyof (typeof type)[V];

/**
 * Resolve a `(variant, weight)` pair to a concrete style. Falls back to the
 * variant's first available weight if the requested one isn't defined (e.g.
 * `display.regular` resolves to `display.bold`).
 */
export function resolveTextStyle<V extends TypographyVariant>(
  variant: V,
  weight?: TypographyWeight<V> | string,
): TextStyle {
  const variantStyles = type[variant] as Record<string, TextStyle>;
  if (weight && weight in variantStyles) return variantStyles[weight as string];
  // Pick first available weight as fallback (display/h1/h2 only have bold).
  const firstKey = Object.keys(variantStyles)[0];
  return variantStyles[firstKey];
}
