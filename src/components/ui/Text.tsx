import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme, type TextTone } from '@/theme/ThemeContext';
import type { TypographyVariant, TypographyWeight } from '@/theme/typography';

export type TextProps<V extends TypographyVariant = 'body'> = Omit<RNTextProps, 'style'> & {
  variant?: V;
  weight?: TypographyWeight<V>;
  tone?: TextTone;
  /** Optional style override. Use sparingly — colour and font fields will be
   *  overridden by `tone`/`variant`/`weight` if present. Layout-only props
   *  (margin, textAlign, etc.) are the intended use. */
  style?: TextStyle | TextStyle[] | null | false;
  children?: React.ReactNode;
};

/**
 * Theme-aware text primitive. All app copy should render through this.
 *
 *   <Text variant="h1">Welcome</Text>
 *   <Text variant="body" weight="medium" tone="muted">Sub-line</Text>
 *
 * Direct `fontSize`/`fontFamily`/`fontWeight`/`color` overrides are not
 * accepted via the `style` prop type — pick a different `variant`/`weight`/
 * `tone` instead. If you genuinely need an escape, leave a
 * `// kanek-allow-typography` comment on the line.
 */
export function Text<V extends TypographyVariant = 'body'>({
  variant,
  weight,
  tone,
  style,
  ...rest
}: TextProps<V>) {
  const { t } = useTheme();
  const v = (variant ?? 'body') as TypographyVariant;
  const base = t(v, weight as never, tone);
  const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style || undefined;
  return <RNText {...rest} style={[base, flat]} />;
}
