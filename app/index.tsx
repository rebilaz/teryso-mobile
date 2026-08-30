import {
    Redirect,
} from 'expo-router';

import {
    ActivityIndicator,
    StyleSheet,
    View,
} from 'react-native';

import {
    useAuth,
} from '@/contexts/auth-context';

import {
    useTerysoTheme,
} from '@/contexts/theme-context';

export default function IndexScreen() {
  const {
    session,
    isLoading,
  } =
    useAuth();

  const {
    colors,
  } =
    useTerysoTheme();

  if (
    isLoading
  ) {
    return (
      <View
        style={[
          styles.container,
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
      </View>
    );
  }

  if (
    session
  ) {
    return (
      <Redirect
        href="/(tabs)"
      />
    );
  }

  return (
    <Redirect
      href="/login"
    />
  );
}

const styles =
  StyleSheet.create({
    container: {
      alignItems:
        'center',

      flex: 1,

      justifyContent:
        'center',
    },
  });