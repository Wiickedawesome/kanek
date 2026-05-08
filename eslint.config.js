// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Typography lint rule.
    //
    // Feature code must use `@/components/ui/Text` (which carries the
    // typography scale, weight set, and tone tokens) rather than raw
    // `Text` from `react-native`. Direct imports collapse the design system.
    //
    // Escape hatch — when a one-off genuinely needs raw RN Text (brand mark,
    // third-party widget, animated number, etc.):
    //
    //   // eslint-disable-next-line no-restricted-imports -- kanek-allow-typography <reason>
    //   import { Text as RNText } from 'react-native';
    //
    // Severity is `warn` (not `error`) while long-tail screens are still
    // being converted to the `<Text>` wrapper; flip to `error` once the
    // remaining feature files no longer trigger it.
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: [
      'src/components/ui/Text.tsx',
      'src/theme/**',
      'app/typography-demo.tsx',
      'src/__tests__/**',
    ],
    rules: {
      'no-restricted-imports': ['warn', {
        paths: [{
          name: 'react-native',
          importNames: ['Text'],
          message:
            "Use `import { Text } from '@/components/ui/Text'` instead of importing `Text` from 'react-native'. " +
            'If you really need raw RN Text, add ' +
            '`// eslint-disable-next-line no-restricted-imports -- kanek-allow-typography <reason>` on the import line.',
        }],
      }],
    },
  },
]);
