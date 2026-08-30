import Ionicons from '@expo/vector-icons/Ionicons';

import {
  useRouter,
} from 'expo-router';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  useAuth,
} from '@/contexts/auth-context';

import {
  useTerysoTheme,
} from '@/contexts/theme-context';

import {
  supabase,
} from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const router =
    useRouter();

  const {
    colors,
  } =
    useTerysoTheme();

  const {
    session,
  } =
    useAuth();

  const alreadyProcessed =
    useRef(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    message,
    setMessage,
  ] =
    useState(
      'Récupération de votre session…',
    );

  /*
   * ÉTAPE 1
   *
   * Le navigateur revient avec :
   *
   * /auth/callback
   * #access_token=...
   * &refresh_token=...
   *
   * On crée la session Supabase.
   */
  useEffect(() => {
    if (
      Platform.OS !==
      'web'
    ) {
      return;
    }

    if (
      alreadyProcessed.current
    ) {
      return;
    }

    alreadyProcessed.current =
      true;

    async function processCallback() {
      try {
        if (
          typeof window ===
          'undefined'
        ) {
          throw new Error(
            'Navigateur indisponible.',
          );
        }

        console.log(
          '[OAuth callback URL]',
          window.location.href,
        );

        const url =
          new URL(
            window.location.href,
          );

        /*
         * =====================
         * ERREUR OAUTH
         * =====================
         */
        const queryError =
          url.searchParams.get(
            'error_description',
          ) ??
          url.searchParams.get(
            'error',
          );

        if (
          queryError
        ) {
          throw new Error(
            queryError,
          );
        }

        /*
         * =====================
         * HASH
         * =====================
         *
         * C'est TON cas actuel.
         */
        const hash =
          window.location.hash.startsWith(
            '#',
          )
            ? window.location.hash.substring(
                1,
              )
            : window.location.hash;

        const hashParams =
          new URLSearchParams(
            hash,
          );

        const hashError =
          hashParams.get(
            'error_description',
          ) ??
          hashParams.get(
            'error',
          );

        if (
          hashError
        ) {
          throw new Error(
            hashError,
          );
        }

        const accessToken =
          hashParams.get(
            'access_token',
          );

        const refreshToken =
          hashParams.get(
            'refresh_token',
          );

        console.log(
          '[OAuth callback]',
          {
            hasAccessToken:
              Boolean(
                accessToken,
              ),

            hasRefreshToken:
              Boolean(
                refreshToken,
              ),
          },
        );

        /*
         * Flux implicite.
         */
        if (
          accessToken &&
          refreshToken
        ) {
          setMessage(
            'Création de votre session…',
          );

          const {
            data,
            error:
              setSessionError,
          } =
            await supabase.auth
              .setSession({
                access_token:
                  accessToken,

                refresh_token:
                  refreshToken,
              });

          if (
            setSessionError
          ) {
            throw setSessionError;
          }

          if (
            !data.session
          ) {
            throw new Error(
              'Supabase n’a pas créé de session.',
            );
          }

          /*
           * Supprime les tokens
           * de la barre d'adresse.
           */
          window.history.replaceState(
            {},
            document.title,
            '/auth/callback',
          );

          setMessage(
            'Connexion réussie…',
          );

          return;
        }

        /*
         * =====================
         * PKCE
         * =====================
         */
        const code =
          url.searchParams.get(
            'code',
          );

        if (
          code
        ) {
          setMessage(
            'Validation de votre connexion…',
          );

          const {
            data,
            error:
              exchangeError,
          } =
            await supabase.auth
              .exchangeCodeForSession(
                code,
              );

          if (
            exchangeError
          ) {
            throw exchangeError;
          }

          if (
            !data.session
          ) {
            throw new Error(
              'Supabase n’a pas créé de session.',
            );
          }

          window.history.replaceState(
            {},
            document.title,
            '/auth/callback',
          );

          return;
        }

        /*
         * Peut-être déjà connecté.
         */
        const {
          data,
          error:
            currentError,
        } =
          await supabase.auth
            .getSession();

        if (
          currentError
        ) {
          throw currentError;
        }

        if (
          data.session
        ) {
          return;
        }

        throw new Error(
          'Le callback ne contient ni access_token, ni refresh_token, ni code.',
        );
      } catch (
        callbackError
      ) {
        console.error(
          '[OAuth callback error]',
          callbackError,
        );

        setError(
          callbackError instanceof
          Error
            ? callbackError.message
            : 'Impossible de terminer la connexion.',
        );
      }
    }

    void processCallback();
  }, []);

  /*
   * ÉTAPE 2
   *
   * On ne redirige PAS immédiatement
   * après setSession().
   *
   * On attend que AuthProvider
   * reçoive réellement la session.
   */
  useEffect(() => {
    if (
      !session
    ) {
      return;
    }

    console.log(
      '[OAuth callback] session reçue',
      session.user.id,
    );

    setMessage(
      'Bienvenue sur Teryso…',
    );

    const timeout =
      setTimeout(
        () => {
          router.replace(
            '/',
          );
        },
        100,
      );

    return () =>
      clearTimeout(
        timeout,
      );
  }, [
    session,
    router,
  ]);

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
        style={
          styles.content
        }
      >
        {error ? (
          <>
            <View
              style={[
                styles.icon,
                {
                  backgroundColor:
                    colors.surfaceStrong,
                },
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={28}
                color={
                  colors.negative
                }
              />
            </View>

            <Text
              style={[
                styles.title,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Connexion impossible
            </Text>

            <Text
              style={[
                styles.error,
                {
                  color:
                    colors.negative,
                },
              ]}
            >
              {error}
            </Text>

            <Pressable
              onPress={() =>
                router.replace(
                  '/login',
                )
              }
              style={[
                styles.button,
                {
                  backgroundColor:
                    colors.brandFill,
                },
              ]}
            >
              <Text
                style={[
                  styles.buttonText,
                  {
                    color:
                      colors.brandText,
                  },
                ]}
              >
                Retour
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator
              size="large"
              color={
                colors.text
              }
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
                styles.subtitle,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              {message}
            </Text>
          </>
        )}
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
      alignItems:
        'center',

      flex: 1,

      justifyContent:
        'center',

      paddingHorizontal:
        28,
    },

    icon: {
      alignItems:
        'center',

      borderRadius:
        999,

      height:
        56,

      justifyContent:
        'center',

      width:
        56,
    },

    title: {
      fontSize: 20,

      fontWeight:
        '900',

      marginTop: 18,

      textAlign:
        'center',
    },

    subtitle: {
      fontSize: 12,

      lineHeight: 18,

      marginTop: 7,

      textAlign:
        'center',
    },

    error: {
      fontSize: 12,

      lineHeight: 18,

      marginTop: 9,

      maxWidth: 360,

      textAlign:
        'center',
    },

    button: {
      alignItems:
        'center',

      borderRadius: 12,

      justifyContent:
        'center',

      marginTop: 20,

      minHeight: 46,

      paddingHorizontal: 24,
    },

    buttonText: {
      fontSize: 12,

      fontWeight:
        '900',
    },
  });