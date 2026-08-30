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
  portfolios: number;
};

export default function ProfileScreen() {
  const {
    session,
    signOut,
  } =
    useAuth();

  const {
    colors,
    mode,
    setMode,
  } =
    useTerysoTheme();

  const [
    profile,
    setProfile,
  ] =
    useState<
      ProfileRow | null
    >(null);

  const [
    stats,
    setStats,
  ] =
    useState<ProfileStats>({
      portfolios: 0,
    });

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    signingOut,
    setSigningOut,
  ] =
    useState(false);

  useEffect(() => {
    const userId =
      session?.user.id;

    if (!userId) {
      setLoading(false);

      return;
    }

    let cancelled =
      false;

    async function load() {
      setLoading(true);

      try {
        const [
          profileResult,
          portfoliosResult,
        ] =
          await Promise.all([
            supabase
              .from('profiles')
              .select(
                'username,display_name,bio,avatar_url,location,website_url,is_public',
              )
              .eq(
                'id',
                userId,
              )
              .maybeSingle(),

            supabase
              .from('portfolios')
              .select('*', {
                count: 'exact',
                head: true,
              })
              .eq(
                'user_id',
                userId,
              ),
          ]);

        if (
          cancelled
        ) {
          return;
        }

        if (
          profileResult.error
        ) {
          console.error(
            '[Account] profile',
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
          portfolios:
            portfoliosResult.count ??
            0,
        });
      } catch (
        error
      ) {
        console.error(
          '[Account] load',
          error,
        );
      } finally {
        if (
          !cancelled
        ) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled =
        true;
    };
  }, [
    session?.user.id,
  ]);

  const displayName =
    useMemo(
      () => {
        if (
          !session
        ) {
          return 'Teryso';
        }

        return (
          profile?.display_name ||
          profile?.username ||
          session.user.user_metadata
            ?.full_name ||
          session.user.user_metadata
            ?.name ||
          session.user.email
            ?.split('@')[0] ||
          'Investisseur'
        );
      },
      [
        profile,
        session,
      ],
    );

  const username =
    profile?.username ||
    session?.user.email
      ?.split('@')[0] ||
    'teryso';

  const avatarUrl =
    profile?.avatar_url ||
    session?.user.user_metadata
      ?.avatar_url ||
    session?.user.user_metadata
      ?.picture ||
    null;

  const provider =
    session?.user.app_metadata
      ?.provider ??
    'email';

  async function handleSignOut() {
    if (
      signingOut
    ) {
      return;
    }

    setSigningOut(true);

    try {
      await signOut();
    } catch (
      error
    ) {
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

  if (
    !session
  ) {
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
          color={
            colors.text
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={[
        'top',
      ]}
      style={[
        styles.safeArea,
        {
          backgroundColor:
            colors.page,
        },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        <BrandHeader
          eyebrow="Paramètres"
          title="Compte"
        />

        {/* COMPTE */}

        <View
          style={[
            styles.accountCard,
            {
              backgroundColor:
                colors.surface,

              borderColor:
                colors.border,
            },
          ]}
        >
          <View
            style={
              styles.accountTop
            }
          >
            {avatarUrl ? (
              <Image
                source={{
                  uri:
                    avatarUrl,
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
                    styles.avatarLetter,
                    {
                      color:
                        colors.brandText,
                    },
                  ]}
                >
                  {displayName
                    .slice(
                      0,
                      1,
                    )
                    .toUpperCase()}
                </Text>
              </View>
            )}

            <View
              style={
                styles.accountCopy
              }
            >
              <Text
                numberOfLines={
                  1
                }
                style={[
                  styles.accountName,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {displayName}
              </Text>

              <Text
                numberOfLines={
                  1
                }
                style={[
                  styles.accountUsername,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                @{username}
              </Text>

              <Text
                numberOfLines={
                  1
                }
                style={[
                  styles.accountEmail,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                {session.user.email}
              </Text>
            </View>

            <View
              style={[
                styles.accountStatus,
                {
                  backgroundColor:
                    colors.accentSoft,
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      colors.positive,
                  },
                ]}
              />

              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      colors.positive,
                  },
                ]}
              >
                Actif
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.accountFooter,
              {
                borderTopColor:
                  colors.border,
              },
            ]}
          >
            <View
              style={
                styles.accountMetric
              }
            >
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {loading
                  ? '—'
                  : stats.portfolios}
              </Text>

              <Text
                style={[
                  styles.metricLabel,
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
                styles.metricDivider,
                {
                  backgroundColor:
                    colors.border,
                },
              ]}
            />

            <View
              style={
                styles.accountMetric
              }
            >
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {provider ===
                'google'
                  ? 'Google'
                  : 'Email'}
              </Text>

              <Text
                style={[
                  styles.metricLabel,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Connexion
              </Text>
            </View>

            <View
              style={[
                styles.metricDivider,
                {
                  backgroundColor:
                    colors.border,
                },
              ]}
            />

            <View
              style={
                styles.accountMetric
              }
            >
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {profile?.is_public ===
                false
                  ? 'Privé'
                  : 'Public'}
              </Text>

              <Text
                style={[
                  styles.metricLabel,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Profil
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() =>
              Alert.alert(
                'Modifier le profil',
                'L’édition du profil pourra être branchée ici.',
              )
            }
            style={({
              pressed,
            }) => [
              styles.editProfileButton,

              {
                backgroundColor:
                  colors.brandFill,

                opacity:
                  pressed
                    ? 0.72
                    : 1,
              },
            ]}
          >
            <Ionicons
              name="create-outline"
              size={17}
              color={
                colors.brandText
              }
            />

            <Text
              style={[
                styles.editProfileText,
                {
                  color:
                    colors.brandText,
                },
              ]}
            >
              Modifier mon profil
            </Text>
          </Pressable>
        </View>

        {/* APPARENCE */}

        <SectionHeader
          title="Apparence"
          subtitle="Personnalisez l’interface"
        />

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
          <View
            style={
              styles.appearanceHeader
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
                name={
                  mode ===
                  'dark'
                    ? 'moon-outline'
                    : 'sunny-outline'
                }
                size={19}
                color={
                  colors.text
                }
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
                Thème de l’application
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
                Clair ou sombre
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.themeSelector,
              {
                backgroundColor:
                  colors.surfaceStrong,
              },
            ]}
          >
            <ThemeButton
              label="Clair"
              icon="sunny-outline"
              selected={
                mode ===
                'light'
              }
              onPress={() =>
                setMode(
                  'light',
                )
              }
            />

            <ThemeButton
              label="Sombre"
              icon="moon-outline"
              selected={
                mode ===
                'dark'
              }
              onPress={() =>
                setMode(
                  'dark',
                )
              }
            />
          </View>
        </View>

        {/* COMPTE ET CONFIDENTIALITÉ */}

        <SectionHeader
          title="Compte"
          subtitle="Sécurité et confidentialité"
        />

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
          <SettingRow
            icon="person-outline"
            title="Informations personnelles"
            description={
              displayName
            }
            onPress={() =>
              Alert.alert(
                'Informations personnelles',
                'Nom, pseudo et informations du profil.',
              )
            }
          />

          <Separator />

          <SettingRow
            icon="lock-closed-outline"
            title="Confidentialité"
            description={
              profile?.is_public ===
              false
                ? 'Profil privé'
                : 'Profil public'
            }
            onPress={() =>
              Alert.alert(
                'Confidentialité',

                profile?.is_public ===
                false
                  ? 'Votre profil est actuellement privé.'
                  : 'Votre profil est actuellement public.',
              )
            }
          />

          <Separator />

          <SettingRow
            icon="shield-checkmark-outline"
            title="Compte et sécurité"
            description={
              session.user.email ??
              'Compte Teryso'
            }
            onPress={() =>
              Alert.alert(
                'Compte et sécurité',
                `Connexion : ${provider}.`,
              )
            }
          />
        </View>

        {/* APPLICATION */}

        <SectionHeader
          title="Application"
          subtitle="Préférences Teryso"
        />

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
          <SettingRow
            icon="notifications-outline"
            title="Notifications"
            description="Alertes et activité"
            onPress={() =>
              Alert.alert(
                'Notifications',
                'Les préférences de notifications seront ajoutées ici.',
              )
            }
          />

          <Separator />

          <SettingRow
            icon="language-outline"
            title="Langue"
            description="Français"
            onPress={() =>
              Alert.alert(
                'Langue',
                'Français',
              )
            }
          />

          <Separator />

          <SettingRow
            icon="help-circle-outline"
            title="Aide"
            description="Support et informations"
            onPress={() =>
              Alert.alert(
                'Aide',
                'Centre d’aide Teryso.',
              )
            }
          />
        </View>

        {/* DÉCONNEXION */}

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
              backgroundColor:
                colors.surface,

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
                colors.negative
              }
            />
          ) : (
            <>
              <View
                style={[
                  styles.logoutIcon,
                  {
                    backgroundColor:
                      colors.surfaceStrong,
                  },
                ]}
              >
                <Ionicons
                  name="log-out-outline"
                  size={18}
                  color={
                    colors.negative
                  }
                />
              </View>

              <View
                style={
                  styles.logoutCopy
                }
              >
                <Text
                  style={[
                    styles.logoutTitle,
                    {
                      color:
                        colors.negative,
                    },
                  ]}
                >
                  Se déconnecter
                </Text>

                <Text
                  style={[
                    styles.logoutDescription,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  Fermer la session sur cet appareil
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={
                  colors.textMuted
                }
              />
            </>
          )}
        </Pressable>

        <Text
          style={[
            styles.version,
            {
              color:
                colors.textMuted,
            },
          ]}
        >
          Teryso Mobile
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;

  subtitle:
    string;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  return (
    <View
      style={
        styles.sectionHeader
      }
    >
      <Text
        style={[
          styles.sectionTitle,
          {
            color:
              colors.text,
          },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.sectionSubtitle,
          {
            color:
              colors.textMuted,
          },
        ]}
      >
        {subtitle}
      </Text>
    </View>
  );
}

function ThemeButton({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;

  icon:
    | 'sunny-outline'
    | 'moon-outline';

  selected:
    boolean;

  onPress:
    () => void;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  return (
    <Pressable
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.themeButton,

        selected && {
          backgroundColor:
            colors.surface,
        },

        {
          opacity:
            pressed
              ? 0.7
              : 1,
        },
      ]}
    >
      <Ionicons
        name={
          icon
        }
        size={17}
        color={
          selected
            ? colors.text
            : colors.textMuted
        }
      />

      <Text
        style={[
          styles.themeButtonText,
          {
            color:
              selected
                ? colors.text
                : colors.textMuted,
          },
        ]}
      >
        {label}
      </Text>

      {selected ? (
        <Ionicons
          name="checkmark-circle"
          size={17}
          color={
            colors.positive
          }
        />
      ) : null}
    </Pressable>
  );
}

function SettingRow({
  icon,
  title,
  description,
  onPress,
}: {
  icon:
    | 'person-outline'
    | 'lock-closed-outline'
    | 'shield-checkmark-outline'
    | 'notifications-outline'
    | 'language-outline'
    | 'help-circle-outline';

  title: string;

  description:
    string;

  onPress:
    () => void;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.settingRow,

        {
          opacity:
            pressed
              ? 0.65
              : 1,
        },
      ]}
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
          name={
            icon
          }
          size={19}
          color={
            colors.text
          }
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
          {title}
        </Text>

        <Text
          numberOfLines={
            1
          }
          style={[
            styles.settingDescription,
            {
              color:
                colors.textMuted,
            },
          ]}
        >
          {description}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={
          colors.textMuted
        }
      />
    </Pressable>
  );
}

function Separator() {
  const {
    colors,
  } =
    useTerysoTheme();

  return (
    <View
      style={[
        styles.separator,
        {
          backgroundColor:
            colors.border,
        },
      ]}
    />
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },

    loadingScreen: {
      alignItems:
        'center',

      flex: 1,

      justifyContent:
        'center',
    },

    content: {
      paddingBottom: 45,
      paddingHorizontal: 18,
      paddingTop: 14,
    },

    accountCard: {
      borderRadius: 22,
      borderWidth: 1,
      marginTop: 24,
      overflow: 'hidden',
      padding: 16,
    },

    accountTop: {
      alignItems:
        'center',

      flexDirection:
        'row',
    },

    avatar: {
      borderRadius: 27,
      height: 54,
      width: 54,
    },

    avatarFallback: {
      alignItems:
        'center',

      borderRadius: 27,

      height: 54,

      justifyContent:
        'center',

      width: 54,
    },

    avatarLetter: {
      fontSize: 20,
      fontWeight: '900',
    },

    accountCopy: {
      flex: 1,
      marginLeft: 12,
      minWidth: 0,
    },

    accountName: {
      fontSize: 16,
      fontWeight: '900',
      letterSpacing: -0.3,
    },

    accountUsername: {
      fontSize: 10,
      fontWeight: '700',
      marginTop: 2,
    },

    accountEmail: {
      fontSize: 9,
      marginTop: 4,
    },

    accountStatus: {
      alignItems:
        'center',

      borderRadius: 999,

      flexDirection:
        'row',

      gap: 5,

      marginLeft: 8,

      paddingHorizontal: 8,

      paddingVertical: 5,
    },

    statusDot: {
      borderRadius: 999,
      height: 6,
      width: 6,
    },

    statusText: {
      fontSize: 8,
      fontWeight: '900',
    },

    accountFooter: {
      borderTopWidth: 1,
      flexDirection: 'row',
      marginTop: 16,
      paddingTop: 15,
    },

    accountMetric: {
      alignItems:
        'center',

      flex: 1,
    },

    metricValue: {
      fontSize: 12,
      fontWeight: '900',
    },

    metricLabel: {
      fontSize: 8,
      fontWeight: '700',
      marginTop: 3,
    },

    metricDivider: {
      width: 1,
    },

    editProfileButton: {
      alignItems:
        'center',

      borderRadius: 12,

      flexDirection:
        'row',

      gap: 6,

      justifyContent:
        'center',

      marginTop: 16,

      minHeight: 44,
    },

    editProfileText: {
      fontSize: 11,
      fontWeight: '900',
    },

    sectionHeader: {
      marginBottom: 10,
      marginTop: 28,
    },

    sectionTitle: {
      fontSize: 17,
      fontWeight: '900',
      letterSpacing: -0.3,
    },

    sectionSubtitle: {
      fontSize: 9.5,
      marginTop: 3,
    },

    settingsCard: {
      borderRadius: 18,
      borderWidth: 1,
      overflow: 'hidden',
    },

    appearanceHeader: {
      alignItems:
        'center',

      flexDirection:
        'row',

      gap: 12,

      padding: 14,
    },

    settingRow: {
      alignItems:
        'center',

      flexDirection:
        'row',

      gap: 12,

      minHeight: 68,

      paddingHorizontal: 14,

      paddingVertical: 10,
    },

    settingIcon: {
      alignItems:
        'center',

      borderRadius: 12,

      height: 39,

      justifyContent:
        'center',

      width: 39,
    },

    settingCopy: {
      flex: 1,
      minWidth: 0,
    },

    settingTitle: {
      fontSize: 12,
      fontWeight: '900',
    },

    settingDescription: {
      fontSize: 9.5,
      marginTop: 3,
    },

    separator: {
      height:
        StyleSheet.hairlineWidth,

      marginLeft: 65,
    },

    themeSelector: {
      borderRadius: 13,
      flexDirection: 'row',
      gap: 4,
      marginBottom: 14,
      marginHorizontal: 14,
      padding: 4,
    },

    themeButton: {
      alignItems:
        'center',

      borderRadius: 10,

      flex: 1,

      flexDirection:
        'row',

      gap: 6,

      justifyContent:
        'center',

      minHeight: 43,

      paddingHorizontal: 8,
    },

    themeButtonText: {
      fontSize: 10.5,
      fontWeight: '900',
    },

    logoutButton: {
      alignItems:
        'center',

      borderRadius: 18,

      borderWidth: 1,

      flexDirection:
        'row',

      marginTop: 28,

      minHeight: 68,

      paddingHorizontal: 14,

      paddingVertical: 10,
    },

    logoutIcon: {
      alignItems:
        'center',

      borderRadius: 12,

      height: 39,

      justifyContent:
        'center',

      width: 39,
    },

    logoutCopy: {
      flex: 1,
      marginLeft: 12,
    },

    logoutTitle: {
      fontSize: 12,
      fontWeight: '900',
    },

    logoutDescription: {
      fontSize: 9.5,
      marginTop: 3,
    },

    version: {
      fontSize: 8.5,
      marginTop: 18,
      textAlign: 'center',
    },
  });