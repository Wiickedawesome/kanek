export const colors = {
  // Primary — forest greens
  forest: {
    900: '#142800',
    800: '#1c2513',
    700: '#2b381f',
    600: '#274312',
    500: '#4c5c43',
    400: '#656e5e',
  },

  // Neutral
  neutral: {
    0: '#ffffff',
    50: '#f6f6f4',
    100: '#efefec',
    200: '#dbdad2',
    300: '#c2c2b8',
    400: '#a7a99f',
    500: '#8b9182',
  },

  // Accent
  accent: {
    green: '#51c152',
    neonGreen: '#65f67b',
    neonTeal: '#49de61',
    blue: '#4967f6',
  },

  // Semantic
  error: '#d32f2f',
  warning: '#f9a825',
  success: '#51c152',

  // Glass
  glass: {
    background: 'rgba(255,255,255,0.65)',
    border: 'rgba(255,255,255,0.3)',
    shadow: 'rgba(0,0,0,0.08)',
    darkBackground: 'rgba(0,0,0,0.3)',
    darkBorder: 'rgba(255,255,255,0.12)',
  },
} as const;

export type ColorToken = typeof colors;
