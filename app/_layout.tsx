import {
  Stack,
} from 'expo-router';

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router/react-navigation';

import {
  StatusBar,
} from 'expo-status-bar';

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import 'react-native-reanimated';

import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';

import {
  AuthProvider,
  useAuth,
} from '@/contexts/auth-context';

import {
  TerysoThemeProvider,
  useTerysoTheme,
} from '@/contexts/theme-context';

function NavigationShell() {
  const {
    colors,
    isDark,
  } =
    useTerysoTheme();

  const {
    isLoading,
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

  if (
    isLoading
  ) {
    return (
      <View
        style={[
          styles.loading,
          {
            backgroundColor:
              colors.page,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={
            colors.text
          }
        />

        <StatusBar
          style={
            isDark
              ? 'light'
              : 'dark'
          }
        />
      </View>
    );
  }

  return (
    <NavigationThemeProvider
      value={
        navigationTheme
      }
    >
      <Stack
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
         * IMPORTANT
         *
         * Le callback est TOUJOURS
         * accessible.
         *
         * Il n'est dans aucun
         * Stack.Protected.
         */}
        <Stack.Screen
          name="auth/callback"
        />

        {/*
         * Sans connexion.
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
         * Avec connexion.
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

const styles =
  StyleSheet.create({
    loading: {
      alignItems:
        'center',

      flex: 1,

      justifyContent:
        'center',
    },
  });