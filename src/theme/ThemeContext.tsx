import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme, type TextStyle } from 'react-native';
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

interface ThemeContextValue {
  c: SemanticColors;
  t: TFn;
  isDark: boolean;
  scheme: 'light' | 'dark';
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
});

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Override system colour scheme (mainly for tests / storybook). */
  forceScheme?: 'light' | 'dark';
}

export function ThemeProvider({ children, forceScheme }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const scheme = forceScheme ?? (systemScheme === 'dark' ? 'dark' : 'light');

  const value = useMemo<ThemeContextValue>(() => {
    const c = scheme === 'dark' ? darkColors : lightColors;
    return {
      c,
      t: makeT(c),
      isDark: scheme === 'dark',
      scheme,
    };
  }, [scheme]);

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
