import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme, type TextStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, type SemanticColors } from './semanticColors';
import { type TypographyVariant, type TypographyWeight, resolveTextStyle } from './typography';

/**
 * Theme-aware text helper.
 *
 *   const { t } = useTheme();
 *   <Text style={t('h2')}>Hello</Text>
 *   <Text style={t('body', 'medium', 'muted')}>Sub-line</Text>
 *
 * `tone` selects a semantic colour from the active scheme. Default is `text`.
 */
export type TextTone =
  | 'text'
  | 'muted'
  | 'subtle'
  | 'inverse'
  | 'onAccent'
  | 'danger'
  | 'accent';

const TONE_TO_KEY: Record<TextTone, keyof SemanticColors> = {
  text: 'text',
  muted: 'textMuted',
  subtle: 'textSubtle',
  inverse: 'textInverse',
  onAccent: 'textOnAccent',
  danger: 'textDanger',
  accent: 'accent',
};

export type TFn = <V extends TypographyVariant>(
  variant: V,
  weight?: TypographyWeight<V>,
  tone?: TextTone,
) => TextStyle;

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  c: SemanticColors;
  t: TFn;
  isDark: boolean;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

function makeT(c: SemanticColors): TFn {
  return (variant, weight, tone = 'text') => {
    const base = resolveTextStyle(variant, weight as string | undefined);
    return { ...base, color: c[TONE_TO_KEY[tone]] as string };
  };
}

const defaultT: TFn = makeT(lightColors);

const ThemeContext = createContext<ThemeContextValue>({
  c: lightColors,
  t: defaultT,
  isDark: false,
  scheme: 'light',
  preference: 'system',
  setPreference: () => {},
});

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Override system colour scheme (mainly for tests / storybook). */
  forceScheme?: 'light' | 'dark';
}

const STORAGE_KEY = '@kanek/theme-preference';

export function ThemeProvider({ children, forceScheme }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  // Hydrate preference from storage once on mount.
  useEffect(() => {
    if (forceScheme) return;
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [forceScheme]);

  const setPreference = useMemo(
    () => (pref: ThemePreference) => {
      setPreferenceState(pref);
      AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
    },
    [],
  );

  const scheme: 'light' | 'dark' =
    forceScheme ??
    (preference === 'system'
      ? systemScheme === 'dark' ? 'dark' : 'light'
      : preference);

  const value = useMemo<ThemeContextValue>(() => {
    const c = scheme === 'dark' ? darkColors : lightColors;
    return {
      c,
      t: makeT(c),
      isDark: scheme === 'dark',
      scheme,
      preference,
      setPreference,
    };
  }, [scheme, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Returns the active semantic colour set, the typography helper `t`, and
 * a few convenience flags.
 *
 *   const { c, t, isDark } = useTheme();
 *   <Text style={t('h2')}>Title</Text>
 *   <View style={{ backgroundColor: c.bg }} />
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// Re-export for ergonomics.
export { type } from './typography';
