import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
  Stack,
} from 'expo-router';

import {
  StatusBar,
} from 'expo-status-bar';

import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import 'react-native-reanimated';

import {
  AuthProvider,
  useAuth,
} from '@/contexts/auth-context';

import {
  TerysoThemeProvider,
  useTerysoTheme,
} from '@/contexts/theme-context';

export const unstable_settings = {
  initialRouteName:
    'index',
};

function NavigationShell() {
  const {
    colors,
    isDark,
  } =
    useTerysoTheme();

  const {
    session,
  } =
    useAuth();

  const baseTheme =
    isDark
      ? DarkTheme
      : DefaultTheme;

  const navigationTheme = {
    ...baseTheme,

    colors: {
      ...baseTheme.colors,

      background:
        colors.page,

      border:
        colors.border,

      card:
        colors.surface,

      primary:
        colors.text,

      text:
        colors.text,
    },
  };

  return (
    <NavigationThemeProvider
      value={
        navigationTheme
      }
    >
      <Stack
        initialRouteName="index"
        screenOptions={{
          headerShown:
            false,

          contentStyle: {
            backgroundColor:
              colors.page,
          },
        }}
      >
        {/*
         * Route stable de démarrage.
         *
         * Toujours présente.
         */}
        <Stack.Screen
          name="index"
        />

        {/*
         * Le callback OAuth doit
         * toujours rester accessible.
         */}
        <Stack.Screen
          name="auth/callback"
        />

        {/*
         * Accessible seulement
         * sans session.
         */}
        <Stack.Protected
          guard={
            !session
          }
        >
          <Stack.Screen
            name="login"
          />
        </Stack.Protected>

        {/*
         * Accessible seulement
         * avec session.
         */}
        <Stack.Protected
          guard={
            Boolean(
              session,
            )
          }
        >
          <Stack.Screen
            name="(tabs)"
          />

          <Stack.Screen
            name="portfolio/[slug]"
          />
        </Stack.Protected>
      </Stack>

      <StatusBar
        style={
          isDark
            ? 'light'
            : 'dark'
        }
      />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TerysoThemeProvider>
        <AuthProvider>
          <NavigationShell />
        </AuthProvider>
      </TerysoThemeProvider>
    </SafeAreaProvider>
  );
}