import type {
  Session,
} from '@supabase/supabase-js';

import * as WebBrowser from 'expo-web-browser';

import {
  Platform,
} from 'react-native';

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  supabase,
} from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const MOBILE_REDIRECT_URL =
  'teryso://auth/callback';

type AuthContextValue = {
  isLoading:
    boolean;

  session:
    Session | null;

  signInWithGoogle:
    () => Promise<void>;

  signOut:
    () => Promise<void>;
};

const AuthContext =
  createContext<
    AuthContextValue | null
  >(null);

function getMobileOAuthParams(
  url: string,
) {
  const parsed =
    new URL(url);

  const params =
    new URLSearchParams(
      parsed.search,
    );

  if (
    parsed.hash
  ) {
    const hash =
      parsed.hash.startsWith(
        '#',
      )
        ? parsed.hash.slice(
            1,
          )
        : parsed.hash;

    const hashParams =
      new URLSearchParams(
        hash,
      );

    hashParams.forEach(
      (
        value,
        key,
      ) => {
        params.set(
          key,
          value,
        );
      },
    );
  }

  return params;
}

async function finishMobileOAuth(
  url: string,
) {
  const params =
    getMobileOAuthParams(
      url,
    );

  const oauthError =
    params.get(
      'error_description',
    ) ??
    params.get(
      'error',
    );

  if (
    oauthError
  ) {
    throw new Error(
      oauthError,
    );
  }

  const accessToken =
    params.get(
      'access_token',
    );

  const refreshToken =
    params.get(
      'refresh_token',
    );

  if (
    accessToken &&
    refreshToken
  ) {
    const {
      error,
    } =
      await supabase.auth
        .setSession({
          access_token:
            accessToken,

          refresh_token:
            refreshToken,
        });

    if (
      error
    ) {
      throw error;
    }

    return;
  }

  const code =
    params.get(
      'code',
    );

  if (
    code
  ) {
    const {
      error,
    } =
      await supabase.auth
        .exchangeCodeForSession(
          code,
        );

    if (
      error
    ) {
      throw error;
    }

    return;
  }

  throw new Error(
    'Aucun token OAuth reçu.',
  );
}

export function AuthProvider({
  children,
}: PropsWithChildren) {
  const [
    session,
    setSession,
  ] =
    useState<
      Session | null
    >(null);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  useEffect(() => {
    let mounted =
      true;

    async function restoreSession() {
      try {
        const {
          data,
          error,
        } =
          await supabase.auth
            .getSession();

        if (
          error
        ) {
          console.error(
            '[Auth] getSession',
            error,
          );
        }

        if (
          mounted
        ) {
          setSession(
            data.session,
          );
        }
      } catch (
        error
      ) {
        console.error(
          '[Auth] restore',
          error,
        );
      } finally {
        if (
          mounted
        ) {
          setIsLoading(
            false,
          );
        }
      }
    }

    void restoreSession();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth
        .onAuthStateChange(
          (
            event,
            nextSession,
          ) => {
            /*
             * IMPORTANT :
             * ne pas appeler ici
             * d'autres méthodes
             * Supabase async.
             */
            console.log(
              '[Auth state]',
              event,
            );

            if (
              !mounted
            ) {
              return;
            }

            setSession(
              nextSession,
            );

            setIsLoading(
              false,
            );
          },
        );

    return () => {
      mounted =
        false;

      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle =
    useCallback(
      async () => {
        /*
         * ====================
         * WEB
         * ====================
         */
        if (
          Platform.OS ===
          'web'
        ) {
          if (
            typeof window ===
            'undefined'
          ) {
            throw new Error(
              'Navigateur indisponible.',
            );
          }

          const redirectTo =
            `${window.location.origin}/auth/callback`;

          console.log(
            '[Google Web] redirect:',
            redirectTo,
          );

          const {
            error,
          } =
            await supabase.auth
              .signInWithOAuth({
                provider:
                  'google',

                options: {
                  redirectTo,

                  /*
                   * Très important :
                   * pas de
                   * skipBrowserRedirect
                   * sur le Web.
                   */
                  queryParams: {
                    prompt:
                      'select_account',
                  },
                },
              });

          if (
            error
          ) {
            throw error;
          }

          return;
        }

        /*
         * ====================
         * MOBILE
         * ====================
         */
        const {
          data,
          error,
        } =
          await supabase.auth
            .signInWithOAuth({
              provider:
                'google',

              options: {
                redirectTo:
                  MOBILE_REDIRECT_URL,

                skipBrowserRedirect:
                  true,

                queryParams: {
                  prompt:
                    'select_account',
                },
              },
            });

        if (
          error
        ) {
          throw error;
        }

        if (
          !data.url
        ) {
          throw new Error(
            "Supabase n'a pas retourné l'URL Google.",
          );
        }

        const result =
          await WebBrowser
            .openAuthSessionAsync(
              data.url,
              MOBILE_REDIRECT_URL,
            );

        if (
          result.type ===
            'cancel' ||
          result.type ===
            'dismiss'
        ) {
          return;
        }

        if (
          result.type !==
          'success'
        ) {
          return;
        }

        await finishMobileOAuth(
          result.url,
        );
      },
      [],
    );

  const signOut =
    useCallback(
      async () => {
        const {
          error,
        } =
          await supabase.auth
            .signOut();

        if (
          error
        ) {
          throw error;
        }
      },
      [],
    );

  const value =
    useMemo<
      AuthContextValue
    >(
      () => ({
        isLoading,
        session,
        signInWithGoogle,
        signOut,
      }),
      [
        isLoading,
        session,
        signInWithGoogle,
        signOut,
      ],
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(
      AuthContext,
    );

  if (
    !context
  ) {
    throw new Error(
      'useAuth doit être utilisé dans AuthProvider.',
    );
  }

  return context;
}