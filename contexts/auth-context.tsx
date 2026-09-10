import { exchangeAuthCode } from '@/lib/auth-callback';
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

async function finishMobileOAuth(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'teryso:' || parsed.hostname !== 'auth' || parsed.pathname !== '/callback') {
    throw new Error('Adresse de retour invalide.');
  }
  const error = parsed.searchParams.get('error_description') ?? parsed.searchParams.get('error');
  if (error) throw new Error(error);
  const code = parsed.searchParams.get('code');
  if (!code || parsed.hash) throw new Error('Code de connexion absent. Relancez la connexion.');
  await exchangeAuthCode(code);
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