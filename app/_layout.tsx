import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/auth-context';
import { TerysoThemeProvider, useTerysoTheme } from '@/contexts/theme-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

function NavigationShell() {
  const { colors, isDark } = useTerysoTheme();
  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: colors.page,
      border: colors.border,
      card: colors.surface,
      primary: colors.text,
      text: colors.text,
    },
  };

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <AuthProvider>
        <Stack screenOptions={{ contentStyle: { backgroundColor: colors.page }, headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="portfolio/[slug]" />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </AuthProvider>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TerysoThemeProvider>
        <NavigationShell />
      </TerysoThemeProvider>
    </SafeAreaProvider>
  );
}
