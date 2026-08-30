import {
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTerysoTheme } from '@/contexts/theme-context';

type BrandHeaderProps = {
  eyebrow?: string;
  title?: string;
};

export function BrandHeader(
  _props: BrandHeaderProps,
) {
  const { colors } = useTerysoTheme();

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.wordmark,
          {
            color: colors.text,
          },
        ]}
      >
        Teryso
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    paddingBottom: 22,
    paddingTop: 4,
  },

  wordmark: {
    fontFamily: Platform.select({
      ios: 'Helvetica Neue',
      android: 'sans-serif',
      default: 'sans-serif',
    }),

    fontSize: 31,
    fontWeight: '700',

    letterSpacing: -1.8,

    lineHeight: 36,
  },
});