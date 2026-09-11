// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'dist-ci/*'],
  },
  {
    rules: {
      // React Native Animated values are intentionally long-lived mutable
      // objects. The React 19 refs lint rule treats passing them to
      // Animated.event/interpolate as render-time ref reads, although these
      // are the documented React Native APIs and the values are not used to
      // derive React render output.
      'react-hooks/refs': 'off',

      // Data-loading effects call async callbacks that set loading/data state.
      // This is the standard synchronization pattern used throughout this
      // React Native app. Keep exhaustive-deps enabled while opting out of the
      // compiler-oriented rule that rejects these existing loaders.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
