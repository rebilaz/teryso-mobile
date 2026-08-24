import type { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '@/lib/supabase';

/*
 * Permet à Expo WebBrowser de terminer correctement
 * une session d'authentification OAuth.
 */
WebBrowser.maybeCompleteAuthSession();

/*
 * IMPORTANT
 *
 * Cette URL est celle de l'APPLICATION MOBILE.
 *
 * Elle doit aussi être présente dans :
 * Supabase
 * > Authentication
 * > URL Configuration
 * > Redirect URLs
 *
 * avec exactement :
 *
 * teryso://auth/callback
 *
 * Le site web, lui, continue d'utiliser :
 * https://www.teryso.com/auth/callback
 */
const MOBILE_REDIRECT_URL =
  'teryso://auth/callback';

type AuthContextValue = {
  isLoading: boolean;
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext =
  createContext<AuthContextValue | null>(
    null,
  );

/*
 * Supabase peut renvoyer les tokens OAuth
 * soit dans le hash :
 *
 * teryso://auth/callback#access_token=...
 *
 * soit des paramètres dans la query :
 *
 * teryso://auth/callback?code=...
 *
 * Cette fonction récupère les deux.
 */
function getOAuthParams(url: string) {
  const parsedUrl = new URL(url);

  const params = new URLSearchParams(
    parsedUrl.search,
  );

  if (parsedUrl.hash) {
    const hash = parsedUrl.hash.startsWith(
      '#',
    )
      ? parsedUrl.hash.slice(1)
      : parsedUrl.hash;

    const hashParams =
      new URLSearchParams(hash);

    hashParams.forEach(
      (value, key) => {
        params.set(key, value);
      },
    );
  }

  return params;
}

/*
 * Transforme l'URL renvoyée par Supabase
 * en vraie session Supabase dans l'application.
 */
async function createSessionFromOAuthUrl(
  url: string,
) {
  const params =
    getOAuthParams(url);

  /*
   * Gestion des erreurs OAuth éventuelles.
   */
  const error =
    params.get('error');

  const errorDescription =
    params.get(
      'error_description',
    );

  if (
    error ||
    errorDescription
  ) {
    throw new Error(
      errorDescription
        ? decodeURIComponent(
            errorDescription.replace(
              /\+/g,
              ' ',
            ),
          )
        : error ??
            'Erreur OAuth inconnue.',
    );
  }

  /*
   * Cas 1 :
   * Supabase renvoie directement
   * access_token + refresh_token.
   */
  const accessToken =
    params.get('access_token');

  const refreshToken =
    params.get('refresh_token');

  if (
    accessToken &&
    refreshToken
  ) {
    const {
      error: sessionError,
    } =
      await supabase.auth.setSession({
        access_token:
          accessToken,

        refresh_token:
          refreshToken,
      });

    if (sessionError) {
      throw sessionError;
    }

    return;
  }

  /*
   * Cas 2 :
   * Supabase utilise PKCE et renvoie
   * un code d'autorisation.
   */
  const code =
    params.get('code');

  if (code) {
    const {
      error: exchangeError,
    } =
      await supabase.auth
        .exchangeCodeForSession(
          code,
        );

    if (exchangeError) {
      throw exchangeError;
    }

    return;
  }

  /*
   * Dernière vérification :
   * il est possible que Supabase
   * ait déjà enregistré la session.
   */
  const {
    data,
    error: sessionError,
  } =
    await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!data.session) {
    throw new Error(
      "La connexion Google s'est terminée, mais aucune session Supabase n'a été reçue.",
    );
  }
}

export function AuthProvider({
  children,
}: PropsWithChildren) {
  const [
    session,
    setSession,
  ] =
    useState<Session | null>(
      null,
    );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  /*
   * Au démarrage de Teryso :
   *
   * - vérifie si une session existe déjà
   * - garde la session synchronisée
   * - détecte connexion / déconnexion
   */
  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data,
        error,
      } =
        await supabase.auth
          .getSession();

      if (!mounted) {
        return;
      }

      if (error) {
        console.error(
          'Erreur restauration session Supabase :',
          error,
        );
      }

      setSession(
        data.session,
      );

      setIsLoading(false);
    }

    void loadSession();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth
        .onAuthStateChange(
          (
            _event,
            nextSession,
          ) => {
            if (!mounted) {
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
      mounted = false;

      subscription.unsubscribe();
    };
  }, []);

  /*
   * CONNEXION GOOGLE MOBILE
   *
   * Flux :
   *
   * Teryso
   * ↓
   * Supabase
   * ↓
   * Google
   * ↓
   * Supabase
   * ↓
   * teryso://auth/callback
   * ↓
   * Teryso
   */
  const signInWithGoogle =
    useCallback(async () => {
      const {
        data,
        error,
      } =
        await supabase.auth
          .signInWithOAuth({
            provider:
              'google',

            options: {
              /*
               * C'est ce paramètre
               * qui différencie le
               * MOBILE du SITE WEB.
               */
              redirectTo:
                MOBILE_REDIRECT_URL,

              /*
               * On veut gérer nous-mêmes
               * le navigateur sur React Native.
               */
              skipBrowserRedirect:
                true,

              /*
               * Google affiche le choix du compte.
               */
              queryParams: {
                prompt:
                  'select_account',
              },
            },
          });

      if (error) {
        throw error;
      }

      if (!data.url) {
        throw new Error(
          "Supabase n'a pas retourné l'URL Google.",
        );
      }

      /*
       * Ouvre Google dans le navigateur.
       *
       * Une fois connecté, Google
       * revient vers Supabase,
       * puis Supabase appelle :
       *
       * teryso://auth/callback
       */
      const result =
        await WebBrowser
          .openAuthSessionAsync(
            data.url,
            MOBILE_REDIRECT_URL,
          );

      /*
       * L'utilisateur a fermé
       * volontairement Google.
       */
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

      /*
       * Maintenant on transforme
       * le callback reçu en session.
       */
      await createSessionFromOAuthUrl(
        result.url,
      );
    }, []);

  /*
   * Déconnexion.
   *
   * Ton Stack.Protected détectera ensuite
   * session === null et affichera automatiquement
   * l'écran de connexion.
   */
  const signOut =
    useCallback(async () => {
      const {
        error,
      } =
        await supabase.auth
          .signOut();

      if (error) {
        throw error;
      }
    }, []);

  const value =
    useMemo(
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

  if (!context) {
    throw new Error(
      'useAuth doit être utilisé dans AuthProvider.',
    );
  }

  return context;
}