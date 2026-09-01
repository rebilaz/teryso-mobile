import Ionicons from '@expo/vector-icons/Ionicons';
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
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';
import Svg, {
  Path,
} from 'react-native-svg';

import {
  BrandHeader,
} from '@/components/teryso/brand-header';
import {
  useTerysoTheme,
} from '@/contexts/theme-context';
import {
  getPublicDiscoverPortfolios,
  type PublicChartPoint,
  type PublicDiscoverPortfolio,
} from '@/lib/teryso';

type CategoryOption = {
  slug: string;
  label: string;
  count: number;
};

function formatCategory(
  value:
    | string
    | null,
) {
  if (!value) {
    return 'Général';
  }

  return value
    .replace(
      /[-_]/g,
      ' ',
    )
    .split(' ')
    .filter(Boolean)
    .map(
      (word) =>
        word
          .slice(
            0,
            1,
          )
          .toUpperCase() +
        word
          .slice(1)
          .toLowerCase(),
    )
    .join(' ');
}

function formatPercent(
  value:
    | number
    | null,
) {
  if (
    value ===
      null ||
    !Number.isFinite(
      value,
    )
  ) {
    return '—';
  }

  return `${
    value > 0
      ? '+'
      : ''
  }${value.toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits:
        1,
    },
  )} %`;
}

function formatVolatility(
  value:
    | number
    | null,
) {
  if (
    value ===
      null ||
    !Number.isFinite(
      value,
    )
  ) {
    return '—';
  }

  return `${value.toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits:
        1,
    },
  )} %`;
}

function initials(
  value: string,
) {
  const result =
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(
        0,
        2,
      )
      .map(
        (part) =>
          part
            .slice(
              0,
              1,
            )
            .toUpperCase(),
      )
      .join('');

  return (
    result ||
    'T'
  );
}

function ownerName(
  portfolio:
    PublicDiscoverPortfolio,
) {
  return (
    portfolio.owner
      ?.displayName ||
    portfolio.owner
      ?.username ||
    'Teryso'
  );
}

function PortfolioSparkline({
  points,
}: {
  points:
    PublicChartPoint[];
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  const normalized =
    useMemo(
      () =>
        points
          .filter(
            (point) =>
              Number.isFinite(
                point.totalValue,
              ) &&
              !Number.isNaN(
                new Date(
                  point.snapshotAt,
                ).getTime(),
              ),
          )
          .sort(
            (
              left,
              right,
            ) =>
              new Date(
                left.snapshotAt,
              ).getTime() -
              new Date(
                right.snapshotAt,
              ).getTime(),
          ),
      [
        points,
      ],
    );

  /*
   * Règle voulue :
   * aucune donnée / un seul point
   * => aucun graphique.
   */
  if (
    normalized.length <
    2
  ) {
    return null;
  }

  const width =
    320;

  const height =
    74;

  const padding =
    4;

  const values =
    normalized.map(
      (point) =>
        point.totalValue,
    );

  let min =
    Math.min(
      ...values,
    );

  let max =
    Math.max(
      ...values,
    );

  if (
    min ===
    max
  ) {
    const margin =
      Math.max(
        Math.abs(min) *
          0.02,
        1,
      );

    min -=
      margin;

    max +=
      margin;
  }

  const span =
    Math.max(
      max - min,
      1,
    );

  const usableWidth =
    width -
    padding * 2;

  const usableHeight =
    height -
    padding * 2;

  const path =
    normalized
      .map(
        (
          point,
          index,
        ) => {
          const x =
            padding +
            (
              index /
              (
                normalized.length -
                1
              )
            ) *
              usableWidth;

          const y =
            padding +
            (
              (
                max -
                point.totalValue
              ) /
              span
            ) *
              usableHeight;

          return `${
            index ===
            0
              ? 'M'
              : 'L'
          } ${x} ${y}`;
        },
      )
      .join(' ');

  const first =
    normalized[0];

  const last =
    normalized[
      normalized.length -
      1
    ];

  const lineColor =
    last.totalValue >=
    first.totalValue
      ? colors.positive
      : colors.negative;

  return (
    <View
      style={[
        styles.chart,
        {
          borderColor:
            colors.border,
        },
      ]}
    >
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <Path
          d={path}
          fill="none"
          stroke={
            lineColor
          }
          strokeWidth={
            2.4
          }
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

function MetricRow({
  values,
}: {
  values: {
    label: string;
    value: string;
  }[];
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  return (
    <View
      style={[
        styles.metricRow,
        {
          backgroundColor:
            colors.surface,

          borderColor:
            colors.border,
        },
      ]}
    >
      {values.map(
        (
          item,
          index,
        ) => (
          <View
            key={
              item.label
            }
            style={[
              styles.metricCell,

              index > 0
                ? {
                    borderLeftColor:
                      colors.border,

                    borderLeftWidth:
                      StyleSheet.hairlineWidth,
                  }
                : null,
            ]}
          >
            <Text
              style={[
                styles.metricLabel,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              {
                item.label
              }
            </Text>

            <Text
              numberOfLines={
                1
              }
              style={[
                styles.metricValue,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              {
                item.value
              }
            </Text>
          </View>
        ),
      )}
    </View>
  );
}

function PortfolioCard({
  portfolio,
  onPress,
}: {
  portfolio:
    PublicDiscoverPortfolio;

  onPress:
    () => void;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  const owner =
    ownerName(
      portfolio,
    );

  return (
    <Pressable
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.card,

        {
          /*
           * En thème clair colors.surface = #FFFFFF.
           * La carte reste donc réellement blanche.
           */
          backgroundColor:
            colors.surface,

          borderColor:
            colors.border,

          opacity:
            pressed
              ? 0.78
              : 1,
        },
      ]}
    >
      <View
        style={
          styles.cardHeader
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
          />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              {
                backgroundColor:
                  colors.accent,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                {
                  color:
                    '#FFFFFF',
                },
              ]}
            >
              {initials(
                owner,
              )}
            </Text>
          </View>
        )}

        <View
          style={
            styles.cardTitleCopy
          }
        >
          <Text
            numberOfLines={
              2
            }
            style={[
              styles.cardTitle,
              {
                color:
                  colors.text,
              },
            ]}
          >
            {
              portfolio.name
            }
          </Text>

          <Text
            numberOfLines={
              1
            }
            style={[
              styles.cardOwner,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            {
              owner
            }
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={
            18
          }
          color={
            colors.textMuted
          }
        />
      </View>

      <PortfolioSparkline
        points={
          portfolio.chartPoints
        }
      />

      <View
        style={
          styles.metrics
        }
      >
        <MetricRow
          values={[
            {
              label:
                '1M',

              value:
                formatPercent(
                  portfolio.performance1M,
                ),
            },

            {
              label:
                '3M',

              value:
                formatPercent(
                  portfolio.performance3M,
                ),
            },

            {
              label:
                'MAX',

              value:
                formatPercent(
                  portfolio.performanceMax,
                ),
            },
          ]}
        />

        <MetricRow
          values={[
            {
              label:
                'Positions',

              value:
                portfolio.positionsCount.toLocaleString(
                  'fr-FR',
                ),
            },

            {
              label:
                'Trades/Month',

              value:
                portfolio.tradesMonth.toLocaleString(
                  'fr-FR',
                ),
            },

            {
              label:
                'Volatilité',

              value:
                formatVolatility(
                  portfolio.volatility,
                ),
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const router =
    useRouter();

  const {
    colors,
  } =
    useTerysoTheme();

  const [
    portfolios,
    setPortfolios,
  ] =
    useState<
      PublicDiscoverPortfolio[]
    >([]);

  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    selectedCategory,
    setSelectedCategory,
  ] =
    useState(
      'all',
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const load =
    useCallback(
      async (
        refresh =
          false,
      ) => {
        if (
          refresh
        ) {
          setRefreshing(
            true,
          );
        } else {
          setLoading(
            true,
          );
        }

        setError(
          null,
        );

        try {
          const data =
            await getPublicDiscoverPortfolios(
              30,
            );

          setPortfolios(
            data,
          );
        } catch (
          loadError
        ) {
          console.error(
            '[Discover] load',
            loadError,
          );

          setError(
            loadError instanceof
            Error
              ? loadError.message
              : 'Impossible de charger les portefeuilles.',
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
      [],
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ],
  );

  const categories =
    useMemo<
      CategoryOption[]
    >(
      () => {
        const counts =
          new Map<
            string,
            number
          >();

        for (
          const portfolio
          of portfolios
        ) {
          const slug =
            portfolio.categorySlug ??
            'general';

          counts.set(
            slug,
            (
              counts.get(
                slug,
              ) ??
              0
            ) + 1,
          );
        }

        return [
          ...counts.entries(),
        ]
          .map(
            (
              [
                slug,
                count,
              ],
            ) => ({
              slug,

              count,

              label:
                formatCategory(
                  slug,
                ),
            }),
          )
          .sort(
            (
              left,
              right,
            ) =>
              left.label.localeCompare(
                right.label,
                'fr',
              ),
          );
      },
      [
        portfolios,
      ],
    );

  const filtered =
    useMemo(
      () => {
        const normalizedQuery =
          query
            .trim()
            .toLocaleLowerCase(
              'fr',
            );

        return portfolios.filter(
          (portfolio) => {
            const category =
              portfolio.categorySlug ??
              'general';

            if (
              selectedCategory !==
                'all' &&
              category !==
                selectedCategory
            ) {
              return false;
            }

            if (
              !normalizedQuery
            ) {
              return true;
            }

            return [
              portfolio.name,
              portfolio.description,
              ownerName(
                portfolio,
              ),
              portfolio.owner
                ?.username,
              formatCategory(
                portfolio.categorySlug,
              ),
            ]
              .filter(
                Boolean,
              )
              .some(
                (value) =>
                  String(
                    value,
                  )
                    .toLocaleLowerCase(
                      'fr',
                    )
                    .includes(
                      normalizedQuery,
                    ),
              );
          },
        );
      },
      [
        portfolios,
        query,
        selectedCategory,
      ],
    );

  function openPortfolio(
    portfolio:
      PublicDiscoverPortfolio,
  ) {
    router.push({
      pathname:
        '/portfolio/[slug]',

      params: {
        slug:
          portfolio.slug,
      },
    });
  }

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
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() =>
              void load(
                true,
              )
            }
            tintColor={
              colors.text
            }
          />
        }
      >
        <BrandHeader />

        <View
          style={[
            styles.search,
            {
              backgroundColor:
                colors.surface,

              borderColor:
                colors.border,
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={
              18
            }
            color={
              colors.textMuted
            }
          />

          <TextInput
            value={
              query
            }
            onChangeText={
              setQuery
            }
            placeholder="Rechercher un portefeuille"
            placeholderTextColor={
              colors.textMuted
            }
            autoCapitalize="none"
            autoCorrect={
              false
            }
            style={[
              styles.searchInput,
              {
                color:
                  colors.text,
              },
            ]}
          />

          {query ? (
            <Pressable
              accessibilityLabel="Effacer la recherche"
              onPress={() =>
                setQuery(
                  '',
                )
              }
              hitSlop={
                10
              }
            >
              <Ionicons
                name="close-circle"
                size={
                  18
                }
                color={
                  colors.textMuted
                }
              />
            </Pressable>
          ) : null}
        </View>

        {categories.length >
        0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.categoryRow
            }
          >
            <CategoryButton
              label="Tout"
              count={
                portfolios.length
              }
              selected={
                selectedCategory ===
                'all'
              }
              onPress={() =>
                setSelectedCategory(
                  'all',
                )
              }
            />

            {categories.map(
              (
                category,
              ) => (
                <CategoryButton
                  key={
                    category.slug
                  }
                  label={
                    category.label
                  }
                  count={
                    category.count
                  }
                  selected={
                    selectedCategory ===
                    category.slug
                  }
                  onPress={() =>
                    setSelectedCategory(
                      category.slug,
                    )
                  }
                />
              ),
            )}
          </ScrollView>
        ) : null}

        <View
          style={
            styles.heading
          }
        >
          <Text
            style={[
              styles.headingTitle,
              {
                color:
                  colors.text,
              },
            ]}
          >
            Tous les portefeuilles
          </Text>

          <View
            style={[
              styles.countPill,
              {
                backgroundColor:
                  colors.surfaceStrong,
              },
            ]}
          >
            <Text
              style={[
                styles.countText,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              {
                filtered.length
              }
            </Text>
          </View>
        </View>

        {loading ? (
          <View
            style={
              styles.state
            }
          >
            <ActivityIndicator
              color={
                colors.text
              }
            />

            <Text
              style={[
                styles.stateText,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Chargement des données réelles…
            </Text>
          </View>
        ) : null}

        {!loading &&
        error ? (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor:
                  colors.surface,

                borderColor:
                  colors.border,
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={
                20
              }
              color={
                colors.negative
              }
            />

            <Text
              style={[
                styles.errorText,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              {
                error
              }
            </Text>

            <Pressable
              onPress={() =>
                void load()
              }
              style={[
                styles.retryButton,
                {
                  borderColor:
                    colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.retryText,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Réessayer
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!loading &&
        !error &&
        filtered.length ===
          0 ? (
          <View
            style={
              styles.state
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
              Aucun portefeuille
            </Text>

            <Text
              style={[
                styles.stateText,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Aucun résultat ne correspond à cette recherche.
            </Text>
          </View>
        ) : null}

        {!loading &&
        !error
          ? filtered.map(
              (
                portfolio,
              ) => (
                <PortfolioCard
                  key={
                    portfolio.id
                  }
                  portfolio={
                    portfolio
                  }
                  onPress={() =>
                    openPortfolio(
                      portfolio,
                    )
                  }
                />
              ),
            )
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function CategoryButton({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
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
      style={[
        styles.categoryButton,
        {
          backgroundColor:
            selected
              ? colors.brandFill
              : colors.surface,

          borderColor:
            selected
              ? colors.brandFill
              : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.categoryText,
          {
            color:
              selected
                ? colors.brandText
                : colors.text,
          },
        ]}
      >
        {
          label
        }
      </Text>

      <Text
        style={[
          styles.categoryCount,
          {
            color:
              selected
                ? colors.brandText
                : colors.textMuted,
          },
        ]}
      >
        {
          count
        }
      </Text>
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex:
        1,
    },

    content: {
      paddingBottom:
        42,

      paddingHorizontal:
        18,

      paddingTop:
        10,
    },

    search: {
      alignItems:
        'center',

      borderRadius:
        15,

      borderWidth:
        1,

      flexDirection:
        'row',

      gap:
        9,

      minHeight:
        50,

      paddingHorizontal:
        14,
    },

    searchInput: {
      flex:
        1,

      fontSize:
        13,

      minHeight:
        48,

      paddingVertical:
        0,
    },

    categoryRow: {
      gap:
        8,

      paddingBottom:
        4,

      paddingTop:
        14,
    },

    categoryButton: {
      alignItems:
        'center',

      borderRadius:
        999,

      borderWidth:
        1,

      flexDirection:
        'row',

      gap:
        7,

      paddingHorizontal:
        12,

      paddingVertical:
        8,
    },

    categoryText: {
      fontSize:
        11,

      fontWeight:
        '800',
    },

    categoryCount: {
      fontSize:
        10,

      fontWeight:
        '900',
    },

    heading: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      marginBottom:
        14,

      marginTop:
        24,
    },

    headingTitle: {
      fontSize:
        21,

      fontWeight:
        '900',

      letterSpacing:
        -0.55,
    },

    countPill: {
      alignItems:
        'center',

      borderRadius:
        999,

      justifyContent:
        'center',

      minHeight:
        30,

      minWidth:
        36,

      paddingHorizontal:
        10,
    },

    countText: {
      fontSize:
        11,

      fontWeight:
        '900',
    },

    card: {
      borderRadius:
        19,

      borderWidth:
        1,

      marginBottom:
        12,

      padding:
        14,
    },

    cardHeader: {
      alignItems:
        'center',

      flexDirection:
        'row',
    },

    avatar: {
      borderRadius:
        20,

      height:
        40,

      width:
        40,
    },

    avatarFallback: {
      alignItems:
        'center',

      borderRadius:
        20,

      height:
        40,

      justifyContent:
        'center',

      width:
        40,
    },

    avatarText: {
      fontSize:
        14,

      fontWeight:
        '900',
    },

    cardTitleCopy: {
      flex:
        1,

      marginLeft:
        10,

      marginRight:
        8,
    },

    cardTitle: {
      fontSize:
        14,

      fontWeight:
        '900',

      letterSpacing:
        -0.2,

      lineHeight:
        18,
    },

    cardOwner: {
      fontSize:
        10.5,

      marginTop:
        3,
    },

    chart: {
      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      marginTop:
        14,

      paddingVertical:
        7,
    },

    metrics: {
      gap:
        7,

      marginTop:
        12,
    },

    metricRow: {
      borderRadius:
        9,

      borderWidth:
        1,

      flexDirection:
        'row',

      minHeight:
        44,

      overflow:
        'hidden',
    },

    metricCell: {
      alignItems:
        'center',

      flex:
        1,

      justifyContent:
        'center',

      paddingHorizontal:
        5,

      paddingVertical:
        7,
    },

    metricLabel: {
      fontSize:
        8.5,

      fontWeight:
        '700',
    },

    metricValue: {
      fontSize:
        10.5,

      fontWeight:
        '900',

      marginTop:
        3,
    },

    state: {
      alignItems:
        'center',

      gap:
        8,

      paddingHorizontal:
        20,

      paddingVertical:
        40,
    },

    stateText: {
      fontSize:
        12,

      lineHeight:
        18,

      textAlign:
        'center',
    },

    emptyTitle: {
      fontSize:
        16,

      fontWeight:
        '900',
    },

    errorBox: {
      alignItems:
        'center',

      borderRadius:
        17,

      borderWidth:
        1,

      gap:
        10,

      marginBottom:
        14,

      padding:
        20,
    },

    errorText: {
      fontSize:
        12,

      lineHeight:
        18,

      textAlign:
        'center',
    },

    retryButton: {
      borderRadius:
        999,

      borderWidth:
        1,

      marginTop:
        2,

      paddingHorizontal:
        14,

      paddingVertical:
        8,
    },

    retryText: {
      fontSize:
        11,

      fontWeight:
        '900',
    },
  });
