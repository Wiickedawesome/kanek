import { Platform } from 'react-native';

export const fonts = {
  heading: Platform.select({ ios: 'WorkSans-Bold', default: 'WorkSans-Bold' }),
  headingMedium: Platform.select({ ios: 'WorkSans-Medium', default: 'WorkSans-Medium' }),
  body: Platform.select({ ios: 'Manrope-Regular', default: 'Manrope-Regular' }),
  bodyBold: Platform.select({ ios: 'Manrope-Bold', default: 'Manrope-Bold' }),
} as const;

export const typography = {
  h1: {
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '700' as const,
    letterSpacing: -0.8,
  },
  h2: {
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  h3: {
    fontFamily: fonts.headingMedium,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '500' as const,
    letterSpacing: -0.2,
  },
  body1: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },
  body1Bold: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700' as const,
    letterSpacing: 0.1,
  },
  body2: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },
  body2Bold: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700' as const,
    letterSpacing: 0.1,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    letterSpacing: 0.4,
  },
} as const;

export type TypographyToken = typeof typography;
