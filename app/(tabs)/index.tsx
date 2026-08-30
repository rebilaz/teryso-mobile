import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Image,
} from 'expo-image';
import {
  useFocusEffect,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
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
import {
  getPortfolioSnapshot,
  getPublicPortfolios,
  type PortfolioSnapshot,
  type PublicPortfolio,
} from '@/lib/teryso';

type FollowRow = {
  following_id: string;
};

type FeedItem = {
  portfolio: PublicPortfolio;

  snapshot:
    PortfolioSnapshot | null;

  followed: boolean;
};

function toNumber(
  value: unknown,
) {
  const number =
    Number(value);

  return Number.isFinite(
    number,
  )
    ? number
    : null;
}

function formatPercent(
  value: unknown,
) {
  const number =
    toNumber(value);

  if (
    number === null
  ) {
    return '—';
  }

  return `${
    number >= 0
      ? '+'
      : ''
  }${number.toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits:
        2,
    },
  )} %`;
}

function formatRelativeDate(
  value: string | null,
) {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  const difference =
    Date.now() -
    date.getTime();

  const minutes =
    Math.floor(
      difference /
        60_000,
    );

  if (
    minutes < 1
  ) {
    return 'maintenant';
  }

  if (
    minutes < 60
  ) {
    return `il y a ${minutes} min`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  if (
    hours < 24
  ) {
    return `il y a ${hours} h`;
  }

  const days =
    Math.floor(
      hours / 24,
    );

  if (
    days < 7
  ) {
    return `il y a ${days} j`;
  }

  return date.toLocaleDateString(
    'fr-FR',
    {
      day: '2-digit',
      month: 'short',
    },
  );
}

export default function HomeScreen() {
  const router =
    useRouter();

  const {
    session,
  } =
    useAuth();

  const {
    colors,
  } =
    useTerysoTheme();

  const [
    feed,
    setFeed,
  ] =
    useState<
      FeedItem[]
    >([]);

  const [
    followingCount,
    setFollowingCount,
  ] =
    useState(0);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const loadHome =
    useCallback(
      async (
        isRefresh = false,
      ) => {
        const userId =
          session?.user.id;

        if (!userId) {
          setFeed([]);

          setFollowingCount(
            0,
          );

          setLoading(
            false,
          );

          setRefreshing(
            false,
          );

          return;
        }

        if (
          isRefresh
        ) {
          setRefreshing(
            true,
          );
        } else {
          setLoading(
            true,
          );
        }

        setError(null);

        try {
          const {
            data:
              followData,
            error:
              followError,
          } =
            await supabase
              .from(
                'user_follows',
              )
              .select(
                'following_id',
              )
              .eq(
                'follower_id',
                userId,
              );

          if (
            followError
          ) {
            throw followError;
          }

          const follows =
            (
              followData ??
              []
            ) as FollowRow[];

          const followedIds =
            new Set(
              follows
                .map(
                  (
                    follow,
                  ) =>
                    follow.following_id,
                )
                .filter(
                  Boolean,
                ),
            );

          setFollowingCount(
            followedIds.size,
          );

          /*
           * Aucun abonnement :
           * on ne charge aucun portefeuille.
           */
          if (
            followedIds.size ===
            0
          ) {
            setFeed([]);

            return;
          }

          const publicPortfolios =
            await getPublicPortfolios();

          /*
           * La home montre uniquement
           * les portefeuilles publics
           * des utilisateurs suivis.
           */
          const followedPortfolios =
            publicPortfolios
              .filter(
                (
                  portfolio,
                ) =>
                  portfolio.userId !==
                    userId &&
                  followedIds.has(
                    portfolio.userId,
                  ),
              )
              .sort(
                (
                  left,
                  right,
                ) => {
                  const leftDate =
                    left.updatedAt
                      ? new Date(
                          left.updatedAt,
                        ).getTime()
                      : 0;

                  const rightDate =
                    right.updatedAt
                      ? new Date(
                          right.updatedAt,
                        ).getTime()
                      : 0;

                  return (
                    rightDate -
                    leftDate
                  );
                },
              )
              .slice(
                0,
                20,
              );

          const snapshots =
            await Promise.all(
              followedPortfolios.map(
                (
                  portfolio,
                ) =>
                  getPortfolioSnapshot(
                    portfolio.id,
                  ).catch(
                    (
                      snapshotError,
                    ) => {
                      console.error(
                        '[Home] snapshot',
                        portfolio.id,
                        snapshotError,
                      );

                      return null;
                    },
                  ),
              ),
            );

          setFeed(
            followedPortfolios.map(
              (
                portfolio,
                index,
              ) => ({
                portfolio,

                snapshot:
                  snapshots[
                    index
                  ] ??
                  null,

                followed:
                  true,
              }),
            ),
          );
        } catch (
          loadError
        ) {
          console.error(
            'Accueil Teryso :',
            loadError,
          );

          setFeed([]);

          setError(
            loadError instanceof
            Error
              ? loadError.message
              : "Impossible de charger l'accueil.",
          );
        } finally {
          setLoading(
            false,
          );

          setRefreshing(
            false,
          );
        }
      },
      [
        session?.user.id,
      ],
    );

  /*
   * Recharge quand on revient sur
   * l'accueil, notamment après avoir
   * suivi quelqu'un depuis Découvrir.
   */
  useFocusEffect(
    useCallback(() => {
      void loadHome();

      return undefined;
    }, [
      loadHome,
    ]),
  );

  const hasFollowing =
    followingCount > 0;

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
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() =>
              void loadHome(
                true,
              )
            }
            tintColor={
              colors.text
            }
          />
        }
        contentContainerStyle={[
          styles.content,

          !loading &&
            !hasFollowing &&
            styles.emptyContent,
        ]}
      >
        <BrandHeader />

        {loading ? (
          <View
            style={
              styles.loading
            }
          >
            <ActivityIndicator
              color={
                colors.text
              }
            />
          </View>
        ) : null}

        {error &&
        !loading ? (
          <View
            style={
              styles.errorRow
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={19}
              color={
                colors.negative
              }
            />

            <Text
              style={[
                styles.errorText,
                {
                  color:
                    colors.negative,
                },
              ]}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {/*
         * Aucun abonnement :
         * état vide minimal façon
         * Instagram / Threads.
         */}
        {!loading &&
        !error &&
        !hasFollowing ? (
          <View
            style={
              styles.discoverState
            }
          >
            <Text
              style={[
                styles.emptyTitle,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Découvrez des portefeuilles
            </Text>

            <Text
              style={[
                styles.emptyDescription,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Suivez des investisseurs pour retrouver ici leurs portefeuilles et leur activité.
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Découvrir des investisseurs"
              onPress={() =>
                router.push(
                  '/discover',
                )
              }
              style={({ pressed }) => [
                styles.discoverButton,
                {
                  backgroundColor:
                    colors.surfaceStrong,

                  opacity:
                    pressed
                      ? 0.6
                      : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.discoverButtonText,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Découvrir
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/*
         * Feed des abonnements.
         */}
        {!loading &&
        !error &&
        hasFollowing ? (
          <>
            <View
              style={
                styles.feedHeading
              }
            >
              <Text
                style={[
                  styles.feedTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Pour vous
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push(
                    '/discover',
                  )
                }
                style={({
                  pressed,
                }) => ({
                  opacity:
                    pressed
                      ? 0.55
                      : 1,
                })}
              >
                <Text
                  style={[
                    styles.discoverLink,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  Découvrir
                </Text>
              </Pressable>
            </View>

            {feed.length ===
            0 ? (
              <View
                style={
                  styles.emptyFeed
                }
              >
                <Text
                  style={[
                    styles.emptyFeedTitle,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  Aucune activité
                </Text>

                <Text
                  style={[
                    styles.emptyFeedText,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  Les comptes que vous suivez n&apos;ont aucun portefeuille public à afficher pour le moment.
                </Text>

                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(
                      '/discover',
                    )
                  }
                  style={({ pressed }) => [
                    styles.smallDiscoverButton,
                    {
                      backgroundColor:
                        colors.surfaceStrong,

                      opacity:
                        pressed
                          ? 0.6
                          : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.smallDiscoverText,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    Découvrir
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {feed.map(
              (
                item,
              ) => (
                <SocialPortfolioRow
                  key={
                    item.portfolio.id
                  }
                  item={
                    item
                  }
                  onPress={() =>
                    router.push({
                      pathname:
                        '/portfolio/[slug]',

                      params: {
                        slug:
                          item.portfolio
                            .slug,
                      },
                    })
                  }
                />
              ),
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SocialPortfolioRow({
  item,
  onPress,
}: {
  item: FeedItem;
  onPress: () => void;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  const {
    portfolio,
    snapshot,
    followed,
  } =
    item;

  const performance =
    snapshot?.performance;

  const positive =
    performance === null ||
    performance ===
      undefined ||
    performance >= 0;

  const ownerName =
    portfolio.owner
      ?.displayName ||
    portfolio.owner
      ?.username ||
    'Investisseur';

  const username =
    portfolio.owner
      ?.username;

  const topHoldings =
    snapshot?.holdings
      .slice(
        0,
        3,
      ) ??
    [];

  return (
    <Pressable
      onPress={
        onPress
      }
      style={({ pressed }) => [
        styles.feedRow,
        {
          borderBottomColor:
            colors.border,

          opacity:
            pressed
              ? 0.65
              : 1,
        },
      ]}
    >
      <View
        style={
          styles.feedAuthor
        }
      >
        {portfolio.owner
          ?.avatarUrl ? (
          <Image
            source={{
              uri:
                portfolio.owner
                  .avatarUrl,
            }}
            style={
              styles.avatar
            }
            contentFit="cover"
            transition={
              120
            }
          />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              {
                backgroundColor:
                  colors.surfaceStrong,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarFallbackText,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              {ownerName
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
            styles.authorCopy
          }
        >
          <View
            style={
              styles.authorNameRow
            }
          >
            <Text
              numberOfLines={
                1
              }
              style={[
                styles.authorName,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              {ownerName}
            </Text>

            {followed ? (
              <Text
                style={[
                  styles.following,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                · suivi
              </Text>
            ) : null}
          </View>

          <Text
            style={[
              styles.authorMeta,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            {username
              ? `@${username}`
              : ''}

            {username &&
            portfolio.updatedAt
              ? ' · '
              : ''}

            {formatRelativeDate(
              portfolio.updatedAt,
            )}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={17}
          color={
            colors.textMuted
          }
        />
      </View>

      <View
        style={
          styles.feedBody
        }
      >
        <Text
          style={[
            styles.portfolioTitle,
            {
              color:
                colors.text,
            },
          ]}
        >
          {portfolio.name}
        </Text>

        {portfolio.description ? (
          <Text
            numberOfLines={
              2
            }
            style={[
              styles.portfolioDescription,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            {
              portfolio.description
            }
          </Text>
        ) : null}

        <View
          style={
            styles.feedMetrics
          }
        >
          <View
            style={
              styles.feedMetric
            }
          >
            <Text
              style={[
                styles.metricValue,
                {
                  color:
                    positive
                      ? colors.positive
                      : colors.negative,
                },
              ]}
            >
              {formatPercent(
                performance,
              )}
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
              performance
            </Text>
          </View>

          <View
            style={
              styles.feedMetric
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
              {snapshot
                ?.assetsCount ??
                '—'}
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
              positions
            </Text>
          </View>

          <View
            style={
              styles.feedMetric
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
              {
                portfolio.followers
              }
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
              abonnés
            </Text>
          </View>
        </View>

        {topHoldings.length >
        0 ? (
          <View
            style={
              styles.holdingsRow
            }
          >
            {topHoldings.map(
              (
                holding,
                index,
              ) => (
                <View
                  key={
                    holding.portfolioAssetId ??
                    `${holding.symbol}-${index}`
                  }
                  style={
                    styles.holding
                  }
                >
                  <Text
                    style={[
                      styles.holdingSymbol,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {
                      holding.symbol
                    }
                  </Text>

                  {holding.allocationPercent !==
                  null ? (
                    <Text
                      style={[
                        styles.holdingAllocation,
                        {
                          color:
                            colors.textMuted,
                        },
                      ]}
                    >
                      {holding.allocationPercent.toLocaleString(
                        'fr-FR',
                        {
                          maximumFractionDigits:
                            0,
                        },
                      )}
                      %
                    </Text>
                  ) : null}
                </View>
              ),
            )}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },

    content: {
      flexGrow: 1,

      paddingBottom: 40,
      paddingHorizontal: 20,
      paddingTop: 14,
    },

    emptyContent: {
      flexGrow: 1,
    },

    loading: {
      alignItems: 'center',

      flex: 1,

      justifyContent:
        'center',

      minHeight: 320,
    },

    /*
     * Empty state très simple,
     * inspiré Instagram / Threads.
     */
    discoverState: {
      alignItems: 'center',

      flex: 1,

      justifyContent:
        'center',

      minHeight: 430,

      paddingBottom: 90,
      paddingHorizontal: 34,
    },

    emptyTitle: {
      fontSize: 17,

      fontWeight: '800',

      letterSpacing: -0.35,

      textAlign: 'center',
    },

    emptyDescription: {
      fontSize: 13,

      lineHeight: 19,

      marginTop: 8,

      maxWidth: 290,

      textAlign: 'center',
    },

    discoverButton: {
      alignItems: 'center',

      borderRadius: 10,

      justifyContent:
        'center',

      marginTop: 18,

      minHeight: 40,

      paddingHorizontal: 18,
    },

    discoverButtonText: {
      fontSize: 13,

      fontWeight: '800',
    },

    /*
     * Feed
     */
    feedHeading: {
      alignItems:
        'center',

      flexDirection: 'row',

      justifyContent:
        'space-between',

      marginBottom: 4,

      marginTop: 32,
    },

    feedTitle: {
      fontSize: 21,

      fontWeight: '900',

      letterSpacing: -0.5,
    },

    discoverLink: {
      fontSize: 11,

      fontWeight: '800',
    },

    feedRow: {
      borderBottomWidth: 1,

      paddingBottom: 22,
      paddingTop: 20,
    },

    feedAuthor: {
      alignItems: 'center',

      flexDirection: 'row',
    },

    avatar: {
      borderRadius: 20,

      height: 40,
      width: 40,
    },

    avatarFallback: {
      alignItems: 'center',

      borderRadius: 20,

      height: 40,
      width: 40,

      justifyContent:
        'center',
    },

    avatarFallbackText: {
      fontSize: 13,

      fontWeight: '900',
    },

    authorCopy: {
      flex: 1,

      marginLeft: 11,
    },

    authorNameRow: {
      alignItems: 'center',

      flexDirection: 'row',
    },

    authorName: {
      fontSize: 13,

      fontWeight: '900',

      maxWidth: '70%',
    },

    following: {
      fontSize: 10,

      marginLeft: 4,
    },

    authorMeta: {
      fontSize: 9,

      marginTop: 3,
    },

    feedBody: {
      marginLeft: 51,

      marginTop: 13,
    },

    portfolioTitle: {
      fontSize: 17,

      fontWeight: '900',

      letterSpacing: -0.3,
    },

    portfolioDescription: {
      fontSize: 12,

      lineHeight: 18,

      marginTop: 6,
    },

    feedMetrics: {
      flexDirection: 'row',

      gap: 24,

      marginTop: 17,
    },

    feedMetric: {
      minWidth: 55,
    },

    metricValue: {
      fontSize: 12,

      fontWeight: '900',
    },

    metricLabel: {
      fontSize: 8,

      marginTop: 3,
    },

    holdingsRow: {
      flexDirection: 'row',

      flexWrap: 'wrap',

      gap: 13,

      marginTop: 18,
    },

    holding: {
      alignItems: 'center',

      flexDirection: 'row',

      gap: 4,
    },

    holdingSymbol: {
      fontSize: 10,

      fontWeight: '900',
    },

    holdingAllocation: {
      fontSize: 8,
    },

    /*
     * Errors
     */
    errorRow: {
      alignItems:
        'flex-start',

      flexDirection: 'row',

      gap: 8,

      marginTop: 25,
    },

    errorText: {
      flex: 1,

      fontSize: 11,

      lineHeight: 16,
    },

    /*
     * Suit des gens mais aucun
     * portefeuille public disponible.
     */
    emptyFeed: {
      alignItems: 'center',

      paddingBottom: 45,
      paddingTop: 70,

      paddingHorizontal: 30,
    },

    emptyFeedTitle: {
      fontSize: 16,

      fontWeight: '800',

      letterSpacing: -0.25,
    },

    emptyFeedText: {
      fontSize: 12,

      lineHeight: 18,

      marginTop: 7,

      maxWidth: 270,

      textAlign: 'center',
    },

    smallDiscoverButton: {
      alignItems: 'center',

      borderRadius: 10,

      justifyContent:
        'center',

      marginTop: 18,

      minHeight: 40,

      paddingHorizontal: 18,
    },

    smallDiscoverText: {
      fontSize: 13,

      fontWeight: '800',
    },
  });