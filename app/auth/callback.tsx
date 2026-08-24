import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import {
    useTerysoTheme,
} from '@/contexts/theme-context';

export default function AuthCallbackScreen() {
  const { colors } =
    useTerysoTheme();

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor:
            colors.page,
        },
      ]}
    >
      <View
        style={styles.content}
      >
        <ActivityIndicator
          size="large"
          color={colors.text}
        />

        <Text
          style={[
            styles.title,
            {
              color:
                colors.text,
            },
          ]}
        >
          Connexion à Teryso…
        </Text>

        <Text
          style={[
            styles.text,
            {
              color:
                colors.textSecondary,
            },
          ]}
        >
          Finalisation de votre
          connexion Google.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },

    content: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 28,
    },

    title: {
      fontSize: 20,
      fontWeight: '900',
      marginTop: 20,
      textAlign: 'center',
    },

    text: {
      fontSize: 13,
      lineHeight: 20,
      marginTop: 8,
      textAlign: 'center',
    },
  });