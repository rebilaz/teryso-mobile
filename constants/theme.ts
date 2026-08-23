export type ThemeMode = 'light' | 'dark';

export type ThemeColors = {
  page: string;
  surface: string;
  surfaceMuted: string;
  surfaceStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  brandFill: string;
  brandText: string;
  accent: string;
  accentSoft: string;
  positive: string;
  negative: string;
  tabBar: string;
};

export const themes: Record<ThemeMode, ThemeColors> = {
  light: {
    page: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#FFFFFF',
    surfaceStrong: '#F2F2F2',
    text: '#111111',
    textSecondary: '#505050',
    textMuted: '#767676',
    border: '#E4E4E4',
    borderStrong: '#222222',
    brandFill: '#000000',
    brandText: '#FFFFFF',
    accent: '#087A52',
    accentSoft: '#E8F7F0',
    positive: '#087A52',
    negative: '#B42318',
    tabBar: '#FFFFFF',
  },
  dark: {
    page: '#090A0C',
    surface: '#121419',
    surfaceMuted: '#181B21',
    surfaceStrong: '#242831',
    text: '#F7F7F5',
    textSecondary: '#C5C8CE',
    textMuted: '#9198A3',
    border: '#2C313A',
    borderStrong: '#747C88',
    brandFill: '#FFFFFF',
    brandText: '#000000',
    accent: '#54D3A3',
    accentSoft: '#12382D',
    positive: '#54D3A3',
    negative: '#FF8A80',
    tabBar: '#101216',
  },
};
