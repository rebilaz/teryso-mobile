import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createClient,
  processLock,
} from '@supabase/supabase-js';
import {
  AppState,
  Platform,
} from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (
  !supabaseUrl ||
  !supabasePublishableKey
) {
  throw new Error(
    'Configuration Supabase manquante. Ajoutez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
  );
}

export const supabase =
  createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        ...(Platform.OS !==
        'web'
          ? {
              storage:
                AsyncStorage,
            }
          : {}),

        autoRefreshToken:
          true,

        persistSession:
          true,

        /*
         * IMPORTANT
         *
         * On désactive le traitement
         * automatique de l'URL.
         *
         * Le callback Expo Router
         * va traiter explicitement
         * access_token + refresh_token.
         *
         * Cela évite une course entre :
         *
         * - Supabase
         * - AuthProvider
         * - Expo Router
         */
        detectSessionInUrl:
          false,

        lock:
          processLock,
      },
    },
  );

if (
  Platform.OS !==
  'web'
) {
  AppState.addEventListener(
    'change',
    (state) => {
      if (
        state ===
        'active'
      ) {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    },
  );
}