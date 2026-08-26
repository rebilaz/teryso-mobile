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

type ProfileRow = {
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  website_url: string | null;
  is_public: boolean | null;
};

type ProfileStats = {
  followers: number;
  following: number;
  portfolios: number;
};

export default function ProfileScreen() {
  const {
    session,
    signOut,
  } = useAuth();

  const {
    colors,
  } = useTerysoTheme();

  const [
    profile,
    setProfile,
  ] =
    useState<ProfileRow | null>(
      null,
    );

  const [
    stats,
    setStats,
  ] =
    useState<ProfileStats>({
      followers: 0,
      following: 0,
      portfolios: 0,
    });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    signingOut,
    setSigningOut,
  ] = useState(false);

  useEffect(() => {
    const userId =
      session?.user.id;

    if (!userId) {
      return;
    }

    let cancelled =
      false;

    async function load() {
      setLoading(true);

      const [
        profileResult,
        followersResult,
        followingResult,
        portfoliosResult,
      ] =
        await Promise.all([
          supabase
            .from(
              'profiles',
            )
            .select(
              'username,display_name,bio,avatar_url,location,website_url,is_public',
            )
            .eq(
              'id',
              userId,
            )
            .maybeSingle(),

          supabase
            .from(
              'user_follows',
            )
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq(
              'following_id',
              userId,
            ),

          supabase
            .from(
              'user_follows',
            )
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq(
              'follower_id',
              userId,
            ),

          supabase
            .from(
              'portfolios',
            )
            .select('*', {
              count: 'exact',
              head: true,
            })
            .eq(
              'user_id',
              userId,
            ),
        ]);

      if (cancelled) {
        return;
      }

      if (
        profileResult.error
      ) {
        console.error(
          profileResult.error,
        );
      }

      setProfile(
        (profileResult.data as
          | ProfileRow
          | null) ??
          null,
      );

      setStats({
        followers:
          followersResult.count ??
          0,

        following:
          followingResult.count ??
          0,

        portfolios:
          portfoliosResult.count ??
          0,
      });

      setLoading(false);
    }

    void load();

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
        session.user
          .user_metadata
          ?.full_name ||
        session.user
          .user_metadata
          ?.name ||
        session.user.email
          ?.split('@')[0] ||
        'Investisseur'
      );
    }, [
      profile,
      session,
    ]);

  const username =
    profile?.username ||
    session?.user.email
      ?.split('@')[0] ||
    'teryso';

  const avatarUrl =
    profile?.avatar_url ||
    session?.user
      .user_metadata
      ?.avatar_url ||
    session?.user
      .user_metadata
      ?.picture ||
    null;

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    try {
      await signOut();
    } catch (error) {
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
          eyebrow="Votre identité"
          title="Profil"
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
                styles.avatar
              }
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                {
                  backgroundColor:
                    colors.brandFill,
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
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
              styles.displayName,
              {
                color:
                  colors.text,
              },
            ]}
          >
            {displayName}
          </Text>

          <Text
            style={[
              styles.username,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            @{username}
          </Text>

          {loading ? (
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
          ) : (
            <Text
              style={[
                styles.bio,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Ajoutez une bio pour
              présenter votre
              stratégie aux autres
              investisseurs.
            </Text>
          )}

          {profile?.location ? (
            <View
              style={
                styles.location
              }
            >
              <Ionicons
                name="location-outline"
                size={15}
                color={
                  colors.textMuted
                }
              />

              <Text
                style={[
                  styles.locationText,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                {profile.location}
              </Text>
            </View>
          ) : null}

          <View
            style={[
              styles.stats,
              {
                borderColor:
                  colors.border,
              },
            ]}
          >
            <View
              style={
                styles.stat
              }
            >
              <Text
                style={[
                  styles.statValue,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {stats.portfolios}
              </Text>

              <Text
                style={[
                  styles.statLabel,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Portefeuilles
              </Text>
            </View>

            <View
              style={[
                styles.statDivider,
                {
                  backgroundColor:
                    colors.border,
                },
              ]}
            />

            <View
              style={
                styles.stat
              }
            >
              <Text
                style={[
                  styles.statValue,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {stats.followers}
              </Text>

              <Text
                style={[
                  styles.statLabel,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Abonnés
              </Text>
            </View>

            <View
              style={[
                styles.statDivider,
                {
                  backgroundColor:
                    colors.border,
                },
              ]}
            />

            <View
              style={
                styles.stat
              }
            >
              <Text
                style={[
                  styles.statValue,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {stats.following}
              </Text>

              <Text
                style={[
                  styles.statLabel,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Abonnements
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() =>
              Alert.alert(
                'Modifier le profil',
                'On branchera ensuite l’édition du profil.',
              )
            }
            style={[
              styles.editButton,
              {
                backgroundColor:
                  colors.brandFill,
              },
            ]}
          >
            <Text
              style={[
                styles.editButtonText,
                {
                  color:
                    colors.brandText,
                },
              ]}
            >
              Modifier le profil
            </Text>
          </Pressable>
        </View>

        <Text
          style={[
            styles.sectionTitle,
            {
              color:
                colors.text,
            },
          ]}
        >
          Compte
        </Text>

        <View
          style={[
            styles.settingsCard,
            {
              backgroundColor:
                colors.surface,

              borderColor:
                colors.border,
            },
          ]}
        >
          <Pressable
            onPress={() =>
              Alert.alert(
                'Confidentialité',
                profile?.is_public ===
                  false
                  ? 'Votre profil est actuellement privé.'
                  : 'Votre profil est actuellement public.',
              )
            }
            style={
              styles.settingRow
            }
          >
            <View
              style={[
                styles.settingIcon,
                {
                  backgroundColor:
                    colors.surfaceStrong,
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={19}
                color={colors.text}
              />
            </View>

            <View
              style={
                styles.settingCopy
              }
            >
              <Text
                style={[
                  styles.settingTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Confidentialité
              </Text>

              <Text
                style={[
                  styles.settingDescription,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Profil et visibilité
                publique
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={19}
              color={
                colors.textMuted
              }
            />
          </Pressable>

          <View
            style={[
              styles.separator,
              {
                backgroundColor:
                  colors.border,
              },
            ]}
          />

          <Pressable
            onPress={() =>
              Alert.alert(
                'Sécurité',
                `Compte connecté avec ${session.user.app_metadata?.provider ?? 'Supabase'}.`,
              )
            }
            style={
              styles.settingRow
            }
          >
            <View
              style={[
                styles.settingIcon,
                {
                  backgroundColor:
                    colors.surfaceStrong,
                },
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={19}
                color={colors.text}
              />
            </View>

            <View
              style={
                styles.settingCopy
              }
            >
              <Text
                style={[
                  styles.settingTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Compte et sécurité
              </Text>

              <Text
                style={[
                  styles.settingDescription,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                {
                  session.user
                    .email
                }
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={19}
              color={
                colors.textMuted
              }
            />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={
            signingOut
          }
          onPress={() =>
            void handleSignOut()
          }
          style={({
            pressed,
          }) => [
            styles.logoutButton,
            {
              borderColor:
                colors.border,

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
              color={
                colors.text
              }
            />
          ) : (
            <>
              <Ionicons
                name="log-out-outline"
                size={19}
                color={
                  colors.text
                }
              />

              <Text
                style={[
                  styles.logoutText,
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
      paddingBottom: 35,
      paddingHorizontal: 18,
      paddingTop: 14,
    },

    profileCard: {
      alignItems: 'center',
      borderRadius: 26,
      borderWidth: 1,
      marginTop: 26,
      padding: 22,
    },

    avatar: {
      borderRadius: 42,
      height: 84,
      width: 84,
    },

    avatarFallback: {
      alignItems: 'center',
      borderRadius: 42,
      height: 84,
      justifyContent: 'center',
      width: 84,
    },

    avatarText: {
      fontSize: 30,
      fontWeight: '900',
    },

    displayName: {
      fontSize: 23,
      fontWeight: '900',
      letterSpacing: -0.7,
      marginTop: 15,
    },

    username: {
      fontSize: 12,
      fontWeight: '700',
      marginTop: 4,
    },

    bio: {
      fontSize: 13,
      lineHeight: 20,
      marginTop: 17,
      maxWidth: 290,
      textAlign: 'center',
    },

    location: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
      marginTop: 12,
    },

    locationText: {
      fontSize: 11,
    },

    stats: {
      borderBottomWidth: 1,
      borderTopWidth: 1,
      flexDirection: 'row',
      marginTop: 24,
      paddingVertical: 17,
      width: '100%',
    },

    stat: {
      alignItems: 'center',
      flex: 1,
    },

    statValue: {
      fontSize: 17,
      fontWeight: '900',
    },

    statLabel: {
      fontSize: 9,
      fontWeight: '700',
      marginTop: 4,
    },

    statDivider: {
      width: 1,
    },

    editButton: {
      alignItems: 'center',
      borderRadius: 14,
      height: 48,
      justifyContent: 'center',
      marginTop: 20,
      width: '100%',
    },

    editButtonText: {
      fontSize: 12,
      fontWeight: '900',
    },

    sectionTitle: {
      fontSize: 19,
      fontWeight: '900',
      marginBottom: 12,
      marginTop: 32,
    },

    settingsCard: {
      borderRadius: 20,
      borderWidth: 1,
      overflow: 'hidden',
    },

    settingRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      padding: 15,
    },

    settingIcon: {
      alignItems: 'center',
      borderRadius: 13,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },

    settingCopy: {
      flex: 1,
    },

    settingTitle: {
      fontSize: 13,
      fontWeight: '900',
    },

    settingDescription: {
      fontSize: 10,
      marginTop: 3,
    },

    separator: {
      height: 1,
      marginLeft: 67,
    },

    logoutButton: {
      alignItems: 'center',
      borderRadius: 15,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      height: 50,
      justifyContent: 'center',
      marginTop: 24,
    },

    logoutText: {
      fontSize: 12,
      fontWeight: '900',
    },
  });