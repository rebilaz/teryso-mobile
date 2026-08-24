import Ionicons from '@expo/vector-icons/Ionicons';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  BrandHeader,
} from '@/components/teryso/brand-header';
import {
  useAuth,
} from '@/contexts/auth-context';
import {
  useTerysoTheme,
} from '@/contexts/theme-context';
import {
  supabase,
} from '@/lib/supabase';

type OwnProfile = {
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export default function AccountScreen() {
  const {
    session,
    signOut,
  } = useAuth();

  const { colors } =
    useTerysoTheme();

  const [
    profile,
    setProfile,
  ] =
    useState<OwnProfile | null>(
      null,
    );

  const [
    profileLoading,
    setProfileLoading,
  ] = useState(true);

  const [
    signingOut,
    setSigningOut,
  ] = useState(false);

  useEffect(() => {
    const userId =
      session?.user.id;

    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setProfileLoading(true);

      const {
        data,
        error,
      } = await supabase
        .from('profiles')
        .select(
          'username,display_name,bio,avatar_url',
        )
        .eq('id', userId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(
          'Erreur chargement profil :',
          error,
        );
      }

      setProfile(
        (data as OwnProfile | null) ??
          null,
      );

      setProfileLoading(false);
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const displayName =
    useMemo(() => {
      if (!session) {
        return 'Teryso';
      }

      return (
        profile?.display_name ||
        profile?.username ||
        session.user.user_metadata
          ?.full_name ||
        session.user.user_metadata
          ?.name ||
        session.user.email ||
        'Investisseur Teryso'
      );
    }, [
      profile,
      session,
    ]);

  const avatarUrl =
    useMemo(() => {
      if (!session) {
        return null;
      }

      return (
        profile?.avatar_url ||
        session.user.user_metadata
          ?.avatar_url ||
        session.user.user_metadata
          ?.picture ||
        null
      );
    }, [
      profile,
      session,
    ]);

  const provider =
    session?.user.app_metadata
      ?.provider;

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    try {
      await signOut();

      /*
       * Pas besoin de router.replace().
       *
       * Le Stack.Protected du root
       * layout détecte session === null
       * et renvoie automatiquement
       * l'utilisateur vers /login.
       */
    } catch (error) {
      console.error(
        'Erreur déconnexion :',
        error,
      );

      Alert.alert(
        'Déconnexion impossible',
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue.',
      );
    } finally {
      setSigningOut(false);
    }
  }

  /*
   * Cette situation ne devrait jamais être
   * visible grâce à Stack.Protected.
   */
  if (!session) {
    return (
      <SafeAreaView
        style={[
          styles.loadingScreen,
          {
            backgroundColor:
              colors.page,
          },
        ]}
      >
        <ActivityIndicator
          color={colors.text}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.safeArea,
        {
          backgroundColor:
            colors.page,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <BrandHeader
          eyebrow="Votre espace"
          title="Compte Teryso"
        />

        <View
          style={[
            styles.profileCard,
            {
              backgroundColor:
                colors.surface,

              borderColor:
                colors.border,
            },
          ]}
        >
          {avatarUrl ? (
            <Image
              source={{
                uri: avatarUrl,
              }}
              style={
                styles.profileAvatarImage
              }
            />
          ) : (
            <View
              style={[
                styles.profileAvatar,
                {
                  backgroundColor:
                    colors.brandFill,
                },
              ]}
            >
              <Text
                style={[
                  styles.profileAvatarText,
                  {
                    color:
                      colors.brandText,
                  },
                ]}
              >
                {displayName
                  .slice(0, 1)
                  .toUpperCase()}
              </Text>
            </View>
          )}

          <Text
            style={[
              styles.profileName,
              {
                color:
                  colors.text,
              },
            ]}
          >
            {displayName}
          </Text>

          {session.user.email ? (
            <Text
              style={[
                styles.profileEmail,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              {session.user.email}
            </Text>
          ) : null}

          {provider ===
          'google' ? (
            <View
              style={[
                styles.providerBadge,
                {
                  borderColor:
                    colors.border,

                  backgroundColor:
                    colors.surfaceStrong,
                },
              ]}
            >
              <Ionicons
                name="logo-google"
                size={15}
                color={colors.text}
              />

              <Text
                style={[
                  styles.providerText,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                Connecté avec Google
              </Text>
            </View>
          ) : null}

          {profileLoading ? (
            <ActivityIndicator
              style={{
                marginTop: 18,
              }}
              color={colors.text}
            />
          ) : profile?.bio ? (
            <Text
              style={[
                styles.bio,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              {profile.bio}
            </Text>
          ) : null}

          <View
            style={[
              styles.infoRow,
              {
                backgroundColor:
                  colors.surfaceStrong,
              },
            ]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={21}
              color={colors.text}
            />

            <View
              style={
                styles.infoCopy
              }
            >
              <Text
                style={[
                  styles.infoTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Compte authentifié
              </Text>

              <Text
                style={[
                  styles.infoText,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                Votre session Teryso
                est protégée par
                Supabase Auth.
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={signingOut}
            onPress={() =>
              void handleSignOut()
            }
            style={({ pressed }) => [
              styles.secondaryButton,

              {
                borderColor:
                  colors.borderStrong,

                opacity:
                  pressed ||
                  signingOut
                    ? 0.6
                    : 1,
              },
            ]}
          >
            {signingOut ? (
              <ActivityIndicator
                color={colors.text}
              />
            ) : (
              <>
                <Ionicons
                  name="log-out-outline"
                  size={19}
                  color={colors.text}
                />

                <Text
                  style={[
                    styles.secondaryButtonText,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  Se déconnecter
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },

    loadingScreen: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },

    content: {
      paddingBottom: 36,
      paddingHorizontal: 18,
      paddingTop: 14,
    },

    profileCard: {
      alignItems: 'center',
      borderRadius: 24,
      borderWidth: 1,
      marginTop: 28,
      padding: 22,
    },

    profileAvatar: {
      alignItems: 'center',
      borderRadius: 34,
      height: 68,
      justifyContent: 'center',
      width: 68,
    },

    profileAvatarImage: {
      borderRadius: 34,
      height: 68,
      width: 68,
    },

    profileAvatarText: {
      fontSize: 25,
      fontWeight: '900',
    },

    profileName: {
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.7,
      marginTop: 14,
      textAlign: 'center',
    },

    profileEmail: {
      fontSize: 12,
      marginTop: 5,
    },

    providerBadge: {
      alignItems: 'center',
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 7,
      marginTop: 14,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },

    providerText: {
      fontSize: 11,
      fontWeight: '800',
    },

    bio: {
      fontSize: 13,
      lineHeight: 20,
      marginTop: 18,
      textAlign: 'center',
    },

    infoRow: {
      alignItems: 'flex-start',
      borderRadius: 16,
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
      padding: 16,
      width: '100%',
    },

    infoCopy: {
      flex: 1,
    },

    infoTitle: {
      fontSize: 13,
      fontWeight: '900',
    },

    infoText: {
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4,
    },

    secondaryButton: {
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      height: 50,
      justifyContent: 'center',
      marginTop: 20,
      width: '100%',
    },

    secondaryButtonText: {
      fontSize: 13,
      fontWeight: '900',
    },
  });