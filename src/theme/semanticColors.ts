import { colors } from './colors';

/**
 * Semantic colour tokens used by theme-aware components.
 *
 * `colors` (the static palette in colors.ts) remains the source of truth and
 * is still used directly by light-only screens. New shell-level UI uses
 * `useTheme()` which returns one of the two sets below.
 *
 * Keep keys in sync between light and dark.
 */
export type SemanticColors = {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  surfaceTint: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;
  textOnAccent: string;
  textDanger: string;
  warning: string;
  border: string;
  borderStrong: string;
  tabBarBg: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  fabBg: string;
  fabFg: string;
  searchBg: string;
  searchBorder: string;
  searchText: string;
  searchPlaceholder: string;
  chipBg: string;
  chipBorder: string;
  chipText: string;
  chipSelectedBg: string;
  chipSelectedText: string;
  heroFallbackBg: string;
  accent: string;
  accentMuted: string;
};

export const lightColors: SemanticColors = {
  scheme: 'light',

  // Surfaces
  bg: '#f8f9fb',                    // screen background — near-white with cool tint
  surface: colors.neutral[0],       // cards, sheets — pure white
  surfaceElevated: colors.neutral[0],
  surfaceMuted: '#f0f1f4',
  surfaceTint: 'rgba(20, 40, 0, 0.04)',

  // Text
  text: colors.forest[900],
  textMuted: colors.forest[400],
  textSubtle: colors.forest[600],
  textInverse: colors.neutral[0],
  textOnAccent: colors.forest[900],
  textDanger: colors.error,
  warning: colors.warning,

  // Borders
  border: 'rgba(20, 40, 0, 0.08)',
  borderStrong: 'rgba(20, 40, 0, 0.16)',

  // Tab bar (floating pill)
  tabBarBg: 'rgba(255, 255, 255, 0.92)',
  tabBarBorder: 'rgba(20, 40, 0, 0.08)',
  tabBarActive: colors.forest[900],
  tabBarInactive: colors.forest[400],

  // Floating action surfaces
  fabBg: colors.forest[900],
  fabFg: colors.accent.neonGreen,

  // Search bar
  searchBg: colors.neutral[0],
  searchBorder: 'rgba(20, 40, 0, 0.08)',
  searchText: colors.forest[900],
  searchPlaceholder: colors.forest[400],

  // Filter chip
  chipBg: colors.neutral[0],
  chipBorder: 'rgba(20, 40, 0, 0.12)',
  chipText: colors.forest[900],
  chipSelectedBg: colors.forest[900],
  chipSelectedText: colors.neutral[0],

  // Hero placeholder
  heroFallbackBg: colors.neutral[100],

  // Accent
  accent: colors.accent.neonGreen,
  accentMuted: colors.accent.green,
};

export const darkColors: SemanticColors = {
  scheme: 'dark',

  // Surfaces — soft dark grays (VS Code / GitHub dark-style), not pure black
  bg: '#161618',                    // screen background
  surface: '#1f1f22',               // cards, sheets
  surfaceElevated: '#27272b',       // elevated cards, popovers
  surfaceMuted: '#1a1a1c',
  surfaceTint: 'rgba(255, 255, 255, 0.04)',

  // Text
  text: '#f2f2f3',
  textMuted: 'rgba(255, 255, 255, 0.62)',
  textSubtle: 'rgba(255, 255, 255, 0.78)',
  textInverse: '#161618',
  textOnAccent: colors.forest[900],
  textDanger: '#ff7a7a',
  warning: colors.warning,

  // Borders
  border: 'rgba(255, 255, 255, 0.10)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',

  // Tab bar (floating pill)
  tabBarBg: 'rgba(31, 31, 34, 0.92)',
  tabBarBorder: 'rgba(255, 255, 255, 0.10)',
  tabBarActive: '#f2f2f3',
  tabBarInactive: 'rgba(255, 255, 255, 0.55)',

  // Floating action surfaces
  fabBg: colors.accent.neonGreen,
  fabFg: colors.forest[900],

  // Search bar
  searchBg: '#27272b',
  searchBorder: 'rgba(255, 255, 255, 0.10)',
  searchText: '#f2f2f3',
  searchPlaceholder: 'rgba(255, 255, 255, 0.5)',

  // Filter chip
  chipBg: '#27272b',
  chipBorder: 'rgba(255, 255, 255, 0.14)',
  chipText: '#f2f2f3',
  chipSelectedBg: colors.accent.neonGreen,
  chipSelectedText: colors.forest[900],

  // Hero placeholder
  heroFallbackBg: '#27272b',

  // Accent
  accent: colors.accent.neonGreen,
  accentMuted: colors.accent.green,
};
