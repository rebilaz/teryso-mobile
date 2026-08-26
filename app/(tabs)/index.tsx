import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Image,
} from 'expo-image';
import {
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
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

type Numeric =
  | number
  | string
  | null;

type OwnPortfolio = {
  id: string;
  name: string;
  slug: string;
  base_currency: string;
  is_public: boolean;
};

type OwnOverview = {
  portfolio_id: string;

  total_value:
    Numeric;

  gain:
    Numeric;

  gain_percent:
    Numeric;

  assets_count:
    Numeric;

  cash_value:
    Numeric;

  currency:
    string | null;
};

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

function numberOrZero(
  value: unknown,
) {
  return (
    toNumber(value) ??
    0
  );
}

function formatMoney(
  value: unknown,
  currency = 'EUR',
) {
  const number =
    toNumber(value);

  if (
    number === null
  ) {
    return '—';
  }

  return new Intl.NumberFormat(
    'fr-FR',
    {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    },
  ).format(number);
}

function formatCompactMoney(
  value: unknown,
  currency = 'EUR',
) {
  const number =
    toNumber(value);

  if (
    number === null
  ) {
    return '—';
  }

  return new Intl.NumberFormat(
    'fr-FR',
    {
      style: 'currency',
      currency,

      notation:
        Math.abs(number) >=
        10_000
          ? 'compact'
          : 'standard',

      maximumFractionDigits:
        1,
    },
  ).format(number);
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
    ownPortfolio,
    setOwnPortfolio,
  ] =
    useState<
      OwnPortfolio | null
    >(null);

  const [
    ownOverview,
    setOwnOverview,
  ] =
    useState<
      OwnOverview | null
    >(null);

  const [
    feed,
    setFeed,
  ] =
    useState<
      FeedItem[]
    >([]);

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

  const firstName =
    useMemo(() => {
      const metadata =
        session?.user
          .user_metadata;

      const name =
        metadata?.full_name ??
        metadata?.name ??
        session?.user.email
          ?.split('@')[0] ??
        '';

      return String(name)
        .trim()
        .split(/\s+/)[0];
    }, [
      session,
    ]);

  const loadHome =
    useCallback(
      async (
        isRefresh =
          false,
      ) => {
        const userId =
          session?.user.id;

        if (!userId) {
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
          const [
            ownResult,
            followResult,
            publicPortfolios,
          ] =
            await Promise.all([
              supabase
                .from(
                  'portfolios',
                )
                .select(
                  'id,name,slug,base_currency,is_public',
                )
                .eq(
                  'user_id',
                  userId,
                )
                .order(
                  'updated_at',
                  {
                    ascending:
                      false,
                  },
                )
                .limit(1),

              supabase
                .from(
                  'user_follows',
                )
                .select(
                  'following_id',
                )
                .eq(
                  'follower_id',
                  userId,
                ),

              getPublicPortfolios(),
            ]);

          if (
            ownResult.error
          ) {
            throw ownResult.error;
          }

          if (
            followResult.error
          ) {
            throw followResult.error;
          }

          const own =
            (
              ownResult.data ??
              []
            )[0] as
              | OwnPortfolio
              | undefined;

          setOwnPortfolio(
            own ?? null,
          );

          if (own) {
            const {
              data,
              error:
                overviewError,
            } =
              await supabase.rpc(
                'get_private_portfolio_overview',
                {
                  p_portfolio_id:
                    own.id,
                },
              );

            if (
              overviewError
            ) {
              console.error(
                overviewError,
              );

              setOwnOverview(
                null,
              );
            } else {
              setOwnOverview(
                (data as
                  | OwnOverview
                  | null) ??
                  null,
              );
            }
          } else {
            setOwnOverview(
              null,
            );
          }

          const follows =
            (
              followResult.data ??
              []
            ) as FollowRow[];

          const followedIds =
            new Set(
              follows.map(
                (
                  follow,
                ) =>
                  follow.following_id,
              ),
            );

          const sorted =
            publicPortfolios
              .filter(
                (
                  portfolio,
                ) =>
                  portfolio.userId !==
                  userId,
              )
              .sort(
                (
                  left,
                  right,
                ) => {
                  const leftFollowed =
                    followedIds.has(
                      left.userId,
                    )
                      ? 1
                      : 0;

                  const rightFollowed =
                    followedIds.has(
                      right.userId,
                    )
                      ? 1
                      : 0;

                  if (
                    leftFollowed !==
                    rightFollowed
                  ) {
                    return (
                      rightFollowed -
                      leftFollowed
                    );
                  }

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
                8,
              );

          const snapshots =
            await Promise.all(
              sorted.map(
                (
                  portfolio,
                ) =>
                  getPortfolioSnapshot(
                    portfolio.id,
                  ).catch(
                    () =>
                      null,
                  ),
              ),
            );

          setFeed(
            sorted.map(
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
                  followedIds.has(
                    portfolio.userId,
                  ),
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

  useEffect(() => {
    void loadHome();
  }, [
    loadHome,
  ]);

  const ownCurrency =
    ownOverview?.currency ??
    ownPortfolio
      ?.base_currency ??
    'EUR';

  const ownPositive =
    numberOrZero(
      ownOverview?.gain_percent,
    ) >= 0;

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
        contentContainerStyle={
          styles.content
        }
      >
        <BrandHeader
          eyebrow="Accueil"
          title={
            firstName
              ? `Bonjour ${firstName}`
              : 'Teryso'
          }
        />

        {loading ? (
          <ActivityIndicator
            style={{
              marginVertical:
                50,
            }}
            color={
              colors.text
            }
          />
        ) : null}

        {error ? (
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

        {!loading &&
        ownPortfolio ? (
          <>
            <Pressable
              onPress={() =>
                router.push(
                  '/portfolio',
                )
              }
              style={[
                styles.ownPortfolio,
                {
                  borderBottomColor:
                    colors.border,
                },
              ]}
            >
              <View
                style={
                  styles.ownTop
                }
              >
                <View>
                  <Text
                    style={[
                      styles.sectionLabel,
                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    Mon portefeuille
                  </Text>

                  <Text
                    style={[
                      styles.ownPortfolioName,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {
                      ownPortfolio.name
                    }
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={
                    colors.textMuted
                  }
                />
              </View>

              <Text
                style={[
                  styles.ownValue,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {formatMoney(
                  ownOverview?.total_value,
                  ownCurrency,
                )}
              </Text>

              <View
                style={
                  styles.ownPerformance
                }
              >
                <Ionicons
                  name={
                    ownPositive
                      ? 'arrow-up'
                      : 'arrow-down'
                  }
                  size={14}
                  color={
                    ownPositive
                      ? colors.positive
                      : colors.negative
                  }
                />

                <Text
                  style={[
                    styles.performanceText,
                    {
                      color:
                        ownPositive
                          ? colors.positive
                          : colors.negative,
                    },
                  ]}
                >
                  {formatPercent(
                    ownOverview?.gain_percent,
                  )}
                </Text>

                <Text
                  style={[
                    styles.gainText,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  {formatMoney(
                    ownOverview?.gain,
                    ownCurrency,
                  )}
                </Text>
              </View>

              <View
                style={
                  styles.ownStats
                }
              >
                <View
                  style={
                    styles.ownStat
                  }
                >
                  <Text
                    style={[
                      styles.ownStatValue,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {numberOrZero(
                      ownOverview?.assets_count,
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.ownStatLabel,
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
                    styles.ownStat
                  }
                >
                  <Text
                    style={[
                      styles.ownStatValue,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {formatCompactMoney(
                      ownOverview?.cash_value,
                      ownCurrency,
                    )}
                  </Text>

                  <Text
                    style={[
                      styles.ownStatLabel,
                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    espèces
                  </Text>
                </View>
              </View>
            </Pressable>
          </>
        ) : null}

        {!loading &&
        !ownPortfolio ? (
          <Pressable
            onPress={() =>
              router.push(
                '/portfolio',
              )
            }
            style={[
              styles.createPortfolioRow,
              {
                borderBottomColor:
                  colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.smallIcon,
                {
                  backgroundColor:
                    colors.surfaceStrong,
                },
              ]}
            >
              <Ionicons
                name="wallet-outline"
                size={19}
                color={
                  colors.text
                }
              />
            </View>

            <View
              style={
                styles.rowCopy
              }
            >
              <Text
                style={[
                  styles.rowTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Créer un portefeuille
              </Text>

              <Text
                style={[
                  styles.rowSubtitle,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Commencer à suivre
                vos investissements
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
        ) : null}

        <View
          style={
            styles.feedHeading
          }
        >
          <View>
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

            <Text
              style={[
                styles.feedSubtitle,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Activité de la communauté
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push(
                '/discover',
              )
            }
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

        {!loading &&
        feed.length ===
          0 ? (
          <View
            style={
              styles.emptyFeed
            }
          >
            <Ionicons
              name="people-outline"
              size={25}
              color={
                colors.textMuted
              }
            />

            <Text
              style={[
                styles.emptyFeedTitle,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Rien à afficher
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
              Suivez des investisseurs
              pour retrouver leur
              activité ici.
            </Text>
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
      style={[
        styles.feedRow,
        {
          borderBottomColor:
            colors.border,
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
              {snapshot?.assetsCount ??
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
              ) => (
                <View
                  key={
                    holding.symbol
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
      paddingBottom: 40,
      paddingHorizontal: 20,
      paddingTop: 14,
    },

    ownPortfolio: {
      borderBottomWidth: 1,
      paddingBottom: 27,
      paddingTop: 30,
    },

    ownTop: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent:
        'space-between',
    },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
    },

    ownPortfolioName: {
      fontSize: 14,
      fontWeight: '900',
      marginTop: 4,
    },

    ownValue: {
      fontSize: 38,
      fontWeight: '900',
      letterSpacing: -1.8,
      marginTop: 20,
    },

    ownPerformance: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
      marginTop: 7,
    },

    performanceText: {
      fontSize: 12,
      fontWeight: '900',
    },

    gainText: {
      fontSize: 10,
      marginLeft: 5,
    },

    ownStats: {
      flexDirection: 'row',
      gap: 34,
      marginTop: 22,
    },

    ownStat: {
      minWidth: 75,
    },

    ownStatValue: {
      fontSize: 13,
      fontWeight: '900',
    },

    ownStatLabel: {
      fontSize: 9,
      marginTop: 3,
    },

    createPortfolioRow: {
      alignItems: 'center',
      borderBottomWidth: 1,
      flexDirection: 'row',
      minHeight: 74,
      marginTop: 22,
    },

    smallIcon: {
      alignItems: 'center',
      borderRadius: 18,
      height: 36,
      justifyContent:
        'center',
      width: 36,
    },

    rowCopy: {
      flex: 1,
      marginLeft: 12,
    },

    rowTitle: {
      fontSize: 14,
      fontWeight: '800',
    },

    rowSubtitle: {
      fontSize: 10,
      marginTop: 3,
    },

    feedHeading: {
      alignItems:
        'flex-end',
      flexDirection: 'row',
      justifyContent:
        'space-between',
      marginBottom: 4,
      marginTop: 35,
    },

    feedTitle: {
      fontSize: 21,
      fontWeight: '900',
      letterSpacing: -0.5,
    },

    feedSubtitle: {
      fontSize: 10,
      marginTop: 4,
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
      justifyContent:
        'center',
      width: 40,
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

    emptyFeed: {
      alignItems: 'center',
      paddingBottom: 45,
      paddingTop: 45,
    },

    emptyFeedTitle: {
      fontSize: 15,
      fontWeight: '900',
      marginTop: 10,
    },

    emptyFeedText: {
      fontSize: 11,
      lineHeight: 17,
      marginTop: 5,
      maxWidth: 220,
      textAlign: 'center',
    },
  });