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
  FlatList,
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

import {
  BrandHeader,
} from '@/components/teryso/brand-header';

import {
  useTerysoTheme,
} from '@/contexts/theme-context';

import {
  getPortfolioSnapshot,
  getPublicPortfolios,
  type PortfolioSnapshot,
  type PublicPortfolio,
} from '@/lib/teryso';

type SnapshotMap =
  Record<
    string,
    PortfolioSnapshot | undefined
  >;

type CategoryStat = {
  slug: string;
  label: string;
  count: number;
};

type FeaturedPortfolio = {
  portfolio: PublicPortfolio;
  snapshot:
    | PortfolioSnapshot
    | undefined;
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
          .slice(0, 1)
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
    | null
    | undefined,
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
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

function formatAllocation(
  value:
    | number
    | null
    | undefined,
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
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

function compactNumber(
  value: number,
) {
  try {
    return new Intl.NumberFormat(
      'fr-FR',
      {
        notation:
          'compact',

        maximumFractionDigits:
          1,
      },
    ).format(
      value,
    );
  } catch {
    return value.toLocaleString(
      'fr-FR',
    );
  }
}

function initials(
  value: string,
) {
  return value
    .trim()
    .split(/\s+/)
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
}

function updatedLabel(
  value:
    | string
    | null,
) {
  if (!value) {
    return 'Récemment';
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Récemment';
  }

  return date.toLocaleDateString(
    'fr-FR',
    {
      day:
        '2-digit',

      month:
        'short',
    },
  );
}

function getOwnerName(
  portfolio:
    PublicPortfolio,
) {
  return (
    portfolio.owner
      ?.displayName ||
    portfolio.owner
      ?.username ||
    'Investisseur'
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
      PublicPortfolio[]
    >([]);

  const [
    snapshots,
    setSnapshots,
  ] =
    useState<SnapshotMap>(
      {},
    );

  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    selectedCategory,
    setSelectedCategory,
  ] =
    useState('all');

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

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
    snapshotsLoading,
    setSnapshotsLoading,
  ] =
    useState(false);

  const loadPortfolios =
    useCallback(
      async (
        isRefresh =
          false,
      ) => {
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

        setError(
          null,
        );

        try {
          const data =
            await getPublicPortfolios();

          setPortfolios(
            data,
          );
        } catch (
          loadError
        ) {
          console.error(
            '[Discover]',
            loadError,
          );

          setError(
            'Impossible de charger les portefeuilles pour le moment.',
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

  useEffect(() => {
    void loadPortfolios();
  }, [
    loadPortfolios,
  ]);

  /*
   * On charge progressivement
   * les snapshots publics.
   *
   * 6 par batch pour ne pas
   * déclencher trop de RPC
   * simultanées.
   */
  useEffect(() => {
    let cancelled =
      false;

    if (
      portfolios.length ===
      0
    ) {
      setSnapshots(
        {},
      );

      setSnapshotsLoading(
        false,
      );

      return;
    }

    async function loadSnapshots() {
      setSnapshotsLoading(
        true,
      );

      setSnapshots(
        {},
      );

      /*
       * Limite raisonnable pour
       * la page Découvrir.
       */
      const source =
        portfolios.slice(
          0,
          30,
        );

      const batchSize =
        6;

      try {
        for (
          let index = 0;
          index <
          source.length;
          index +=
            batchSize
        ) {
          const batch =
            source.slice(
              index,
              index +
                batchSize,
            );

          const results =
            await Promise.all(
              batch.map(
                async (
                  portfolio,
                ) => {
                  try {
                    const snapshot =
                      await getPortfolioSnapshot(
                        portfolio.id,
                      );

                    return {
                      id:
                        portfolio.id,

                      snapshot,
                    };
                  } catch (
                    snapshotError
                  ) {
                    console.log(
                      '[Discover snapshot]',
                      portfolio.id,
                      snapshotError,
                    );

                    return {
                      id:
                        portfolio.id,

                      snapshot:
                        undefined,
                    };
                  }
                },
              ),
            );

          if (
            cancelled
          ) {
            return;
          }

          setSnapshots(
            (
              current,
            ) => {
              const next = {
                ...current,
              };

              for (
                const result
                of results
              ) {
                next[
                  result.id
                ] =
                  result.snapshot;
              }

              return next;
            },
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setSnapshotsLoading(
            false,
          );
        }
      }
    }

    void loadSnapshots();

    return () => {
      cancelled =
        true;
    };
  }, [
    portfolios,
  ]);

  const categories =
    useMemo<
      CategoryStat[]
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
            portfolio
              .categorySlug ||
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

        return Array.from(
          counts.entries(),
        )
          .map(
            ([
              slug,
              count,
            ]) => ({
              slug,

              label:
                formatCategory(
                  slug,
                ),

              count,
            }),
          )
          .sort(
            (
              left,
              right,
            ) =>
              right.count -
              left.count,
          );
      },
      [
        portfolios,
      ],
    );

  const filteredPortfolios =
    useMemo(
      () => {
        const normalizedQuery =
          query
            .trim()
            .toLocaleLowerCase(
              'fr',
            );

        return portfolios.filter(
          (
            portfolio,
          ) => {
            const category =
              portfolio
                .categorySlug ||
              'general';

            const matchesCategory =
              selectedCategory ===
                'all' ||
              category ===
                selectedCategory;

            if (
              !matchesCategory
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
              portfolio
                .categorySlug,
              portfolio.owner
                ?.displayName,
              portfolio.owner
                ?.username,
            ]
              .filter(
                Boolean,
              )
              .some(
                (
                  value,
                ) =>
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

  const networkStats =
    useMemo(
      () => {
        const creators =
          new Map<
            string,
            number
          >();

        for (
          const portfolio
          of portfolios
        ) {
          if (
            !portfolio.owner
          ) {
            continue;
          }

          creators.set(
            portfolio.owner.id,

            Math.max(
              creators.get(
                portfolio.owner
                  .id,
              ) ??
                0,

              portfolio.followers,
            ),
          );
        }

        const followers =
          Array.from(
            creators.values(),
          ).reduce(
            (
              total,
              value,
            ) =>
              total +
              value,

            0,
          );

        return {
          portfolios:
            portfolios.length,

          creators:
            creators.size,

          followers,
        };
      },
      [
        portfolios,
      ],
    );

  const topPerformance =
    useMemo<
      FeaturedPortfolio[]
    >(
      () =>
        portfolios
          .map(
            (
              portfolio,
            ) => ({
              portfolio,

              snapshot:
                snapshots[
                  portfolio.id
                ],
            }),
          )
          .filter(
            (
              item,
            ) =>
              item.snapshot
                ?.performance !==
                null &&
              item.snapshot
                ?.performance !==
                undefined,
          )
          .sort(
            (
              left,
              right,
            ) =>
              (
                right.snapshot
                  ?.performance ??
                -Infinity
              ) -
              (
                left.snapshot
                  ?.performance ??
                -Infinity
              ),
          )
          .slice(
            0,
            6,
          ),
      [
        portfolios,
        snapshots,
      ],
    );

  const featured =
    useMemo<
      FeaturedPortfolio[]
    >(
      () => {
        const rows =
          portfolios.map(
            (
              portfolio,
            ) => ({
              portfolio,

              snapshot:
                snapshots[
                  portfolio.id
                ],
            }),
          );

        return rows
          .sort(
            (
              left,
              right,
            ) => {
              const leftPerformance =
                left.snapshot
                  ?.performance;

              const rightPerformance =
                right.snapshot
                  ?.performance;

              if (
                leftPerformance !==
                  null &&
                leftPerformance !==
                  undefined &&
                rightPerformance !==
                  null &&
                rightPerformance !==
                  undefined
              ) {
                return (
                  rightPerformance -
                  leftPerformance
                );
              }

              if (
                rightPerformance !==
                  null &&
                rightPerformance !==
                  undefined
              ) {
                return 1;
              }

              if (
                leftPerformance !==
                  null &&
                leftPerformance !==
                  undefined
              ) {
                return -1;
              }

              return (
                right.portfolio
                  .followers -
                left.portfolio
                  .followers
              );
            },
          )
          .slice(
            0,
            5,
          );
      },
      [
        portfolios,
        snapshots,
      ],
    );

  const searching =
    query.trim()
      .length > 0 ||
    selectedCategory !==
      'all';

  function openPortfolio(
    portfolio:
      PublicPortfolio,
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
      <FlatList
        data={
          filteredPortfolios
        }
        keyExtractor={(
          item,
        ) =>
          item.id
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
        ItemSeparatorComponent={() => (
          <View
            style={
              styles.separator
            }
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() =>
              void loadPortfolios(
                true,
              )
            }
            tintColor={
              colors.text
            }
          />
        }
        ListHeaderComponent={
          <View>
            <BrandHeader
              eyebrow="Réseau"
              title="Découvrir"
            />

            {/* SEARCH */}

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
                size={19}
                color={
                  colors.textMuted
                }
              />

              <TextInput
                accessibilityLabel="Rechercher sur Teryso"
                autoCapitalize="none"
                autoCorrect={
                  false
                }
                onChangeText={
                  setQuery
                }
                placeholder="Portefeuille, créateur, catégorie..."
                placeholderTextColor={
                  colors.textMuted
                }
                style={[
                  styles.searchInput,
                  {
                    color:
                      colors.text,
                  },
                ]}
                value={
                  query
                }
              />

              {query ? (
                <Pressable
                  onPress={() =>
                    setQuery('')
                  }
                  hitSlop={
                    8
                  }
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={
                      colors.textMuted
                    }
                  />
                </Pressable>
              ) : null}
            </View>

            {/* RADAR */}

            {!searching ? (
              <View
                style={[
                  styles.radar,
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
                    styles.radarTop
                  }
                >
                  <View
                    style={[
                      styles.radarIcon,
                      {
                        backgroundColor:
                          colors.accentSoft,
                      },
                    ]}
                  >
                    <Ionicons
                      name="pulse-outline"
                      size={20}
                      color={
                        colors.accent
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.radarCopy
                    }
                  >
                    <Text
                      style={[
                        styles.radarEyebrow,
                        {
                          color:
                            colors.accent,
                        },
                      ]}
                    >
                      RADAR TERYSO
                    </Text>

                    <Text
                      style={[
                        styles.radarTitle,
                        {
                          color:
                            colors.text,
                        },
                      ]}
                    >
                      Ce que construit la communauté
                    </Text>

                    <Text
                      style={[
                        styles.radarDescription,
                        {
                          color:
                            colors.textSecondary,
                        },
                      ]}
                    >
                      Explore les stratégies, les allocations et les performances publiques.
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.stats,
                    {
                      borderTopColor:
                        colors.border,
                    },
                  ]}
                >
                  <Metric
                    value={
                      compactNumber(
                        networkStats.portfolios,
                      )
                    }
                    label="Portefeuilles"
                  />

                  <View
                    style={[
                      styles.metricDivider,
                      {
                        backgroundColor:
                          colors.border,
                      },
                    ]}
                  />

                  <Metric
                    value={
                      compactNumber(
                        networkStats.creators,
                      )
                    }
                    label="Créateurs"
                  />

                  <View
                    style={[
                      styles.metricDivider,
                      {
                        backgroundColor:
                          colors.border,
                      },
                    ]}
                  />

                  <Metric
                    value={
                      compactNumber(
                        networkStats.followers,
                      )
                    }
                    label="Abonnés"
                  />
                </View>
              </View>
            ) : null}

            {/* CATEGORIES */}

            <View
              style={
                styles.sectionHeading
              }
            >
              <View>
                <Text
                  style={[
                    styles.sectionEyebrow,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  EXPLORER
                </Text>

                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  Catégories
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.categoryScroll
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

            {/* CHARTS */}

            {!searching ? (
              <>
                <View
                  style={
                    styles.sectionHeading
                  }
                >
                  <View>
                    <Text
                      style={[
                        styles.sectionEyebrow,
                        {
                          color:
                            colors.textMuted,
                        },
                      ]}
                    >
                      DONNÉES DU RÉSEAU
                    </Text>

                    <Text
                      style={[
                        styles.sectionTitle,
                        {
                          color:
                            colors.text,
                        },
                      ]}
                    >
                      Tendances
                    </Text>
                  </View>

                  {snapshotsLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        colors.textMuted
                      }
                    />
                  ) : null}
                </View>

                <PerformanceChart
                  items={
                    topPerformance
                  }
                />

                <View
                  style={
                    styles.chartSpacer
                  }
                />

                <CategoryChart
                  categories={
                    categories
                  }
                  total={
                    portfolios.length
                  }
                />

                {/* FEATURED */}

                {featured.length >
                0 ? (
                  <>
                    <View
                      style={
                        styles.sectionHeading
                      }
                    >
                      <View>
                        <Text
                          style={[
                            styles.sectionEyebrow,
                            {
                              color:
                                colors.textMuted,
                            },
                          ]}
                        >
                          À SUIVRE
                        </Text>

                        <Text
                          style={[
                            styles.sectionTitle,
                            {
                              color:
                                colors.text,
                            },
                          ]}
                        >
                          Performances en vue
                        </Text>
                      </View>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={
                        false
                      }
                      contentContainerStyle={
                        styles.featuredScroll
                      }
                    >
                      {featured.map(
                        (
                          item,
                        ) => (
                          <FeaturedCard
                            key={
                              item
                                .portfolio
                                .id
                            }
                            portfolio={
                              item.portfolio
                            }
                            snapshot={
                              item.snapshot
                            }
                            onPress={() =>
                              openPortfolio(
                                item.portfolio,
                              )
                            }
                          />
                        ),
                      )}
                    </ScrollView>
                  </>
                ) : null}
              </>
            ) : null}

            {/* RESULTS */}

            <View
              style={
                styles.resultsHeading
              }
            >
              <View>
                <Text
                  style={[
                    styles.sectionEyebrow,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  {searching
                    ? 'RÉSULTATS'
                    : 'COMMUNAUTÉ'}
                </Text>

                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  {searching
                    ? 'Portefeuilles trouvés'
                    : 'Tous les portefeuilles'}
                </Text>
              </View>

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
                    filteredPortfolios.length
                  }
                </Text>
              </View>
            </View>

            {loading ? (
              <View
                style={
                  styles.stateBox
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
                        colors.textSecondary,
                    },
                  ]}
                >
                  Chargement du réseau…
                </Text>
              </View>
            ) : null}

            {error ? (
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
                  size={18}
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
          </View>
        }
        ListEmptyComponent={
          !loading &&
          !error ? (
            <View
              style={[
                styles.empty,
                {
                  backgroundColor:
                    colors.surface,

                  borderColor:
                    colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor:
                      colors.surfaceStrong,
                  },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={24}
                  color={
                    colors.textMuted
                  }
                />
              </View>

              <Text
                style={[
                  styles.emptyTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Aucun résultat
              </Text>

              <Text
                style={[
                  styles.stateText,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                Essaie un autre nom, créateur ou une autre catégorie.
              </Text>

              {searching ? (
                <Pressable
                  onPress={() => {
                    setQuery('');

                    setSelectedCategory(
                      'all',
                    );
                  }}
                  style={[
                    styles.resetButton,
                    {
                      backgroundColor:
                        colors.brandFill,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.resetText,
                      {
                        color:
                          colors.brandText,
                      },
                    ]}
                  >
                    Réinitialiser
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null
        }
        renderItem={({
          item,
        }) => (
          <DiscoverPortfolioCard
            portfolio={
              item
            }
            snapshot={
              snapshots[
                item.id
              ]
            }
            onPress={() =>
              openPortfolio(
                item,
              )
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

function Metric({
  value,
  label,
}: {
  value: string;

  label: string;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  return (
    <View
      style={
        styles.metric
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
        {value}
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
        {label}
      </Text>
    </View>
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

          opacity:
            pressed
              ? 0.72
              : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.categoryButtonLabel,
          {
            color:
              selected
                ? colors.brandText
                : colors.text,
          },
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.categoryCount,
          {
            backgroundColor:
              selected
                ? colors.page
                : colors.surfaceStrong,
          },
        ]}
      >
        <Text
          style={[
            styles.categoryCountText,
            {
              color:
                selected
                  ? colors.text
                  : colors.textMuted,
            },
          ]}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function PerformanceChart({
  items,
}: {
  items:
    FeaturedPortfolio[];
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  const values =
    items
      .map(
        (
          item,
        ) =>
          item.snapshot
            ?.performance ??
          0,
      );

  const maxAbsolute =
    Math.max(
      ...values.map(
        (
          value,
        ) =>
          Math.abs(
            value,
          ),
      ),

      1,
    );

  return (
    <View
      style={[
        styles.chartCard,
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
          styles.chartHeader
        }
      >
        <View>
          <Text
            style={[
              styles.chartTitle,
              {
                color:
                  colors.text,
              },
            ]}
          >
            Performance
          </Text>

          <Text
            style={[
              styles.chartDescription,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            Portefeuilles les mieux classés
          </Text>
        </View>

        <View
          style={[
            styles.chartBadge,
            {
              backgroundColor:
                colors.accentSoft,
            },
          ]}
        >
          <Ionicons
            name="stats-chart-outline"
            size={14}
            color={
              colors.accent
            }
          />

          <Text
            style={[
              styles.chartBadgeText,
              {
                color:
                  colors.accent,
              },
            ]}
          >
            Snapshot
          </Text>
        </View>
      </View>

      {items.length ===
      0 ? (
        <View
          style={
            styles.chartEmpty
          }
        >
          <ActivityIndicator
            size="small"
            color={
              colors.textMuted
            }
          />

          <Text
            style={[
              styles.chartDescription,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            Analyse des performances…
          </Text>
        </View>
      ) : (
        <View
          style={
            styles.performanceChart
          }
        >
          <View
            style={[
              styles.zeroLine,
              {
                backgroundColor:
                  colors.border,
              },
            ]}
          />

          {items.map(
            (
              item,
            ) => {
              const performance =
                item.snapshot
                  ?.performance ??
                0;

              const ratio =
                Math.min(
                  Math.abs(
                    performance,
                  ) /
                    maxAbsolute,

                  1,
                );

              const barHeight =
                Math.max(
                  5,

                  ratio *
                    47,
                );

              const positive =
                performance >=
                0;

              return (
                <View
                  key={
                    item
                      .portfolio
                      .id
                  }
                  style={
                    styles.performanceSlot
                  }
                >
                  <Text
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.performanceValue,
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

                  <View
                    style={
                      styles.barArea
                    }
                  >
                    <View
                      style={
                        styles.barHalf
                      }
                    >
                      {positive ? (
                        <View
                          style={[
                            styles.performanceBar,
                            {
                              backgroundColor:
                                colors.positive,

                              height:
                                barHeight,
                            },
                          ]}
                        />
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.barHalf,
                        styles.negativeBarHalf,
                      ]}
                    >
                      {!positive ? (
                        <View
                          style={[
                            styles.performanceBar,
                            {
                              backgroundColor:
                                colors.negative,

                              height:
                                barHeight,
                            },
                          ]}
                        />
                      ) : null}
                    </View>
                  </View>

                  <Text
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.performanceName,
                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    {
                      item
                        .portfolio
                        .name
                    }
                  </Text>
                </View>
              );
            },
          )}
        </View>
      )}
    </View>
  );
}

function CategoryChart({
  categories,
  total,
}: {
  categories:
    CategoryStat[];

  total: number;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  const visible =
    categories.slice(
      0,
      5,
    );

  const maximum =
    Math.max(
      ...visible.map(
        (
          category,
        ) =>
          category.count,
      ),

      1,
    );

  return (
    <View
      style={[
        styles.chartCard,
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
          styles.chartHeader
        }
      >
        <View>
          <Text
            style={[
              styles.chartTitle,
              {
                color:
                  colors.text,
              },
            ]}
          >
            Répartition
          </Text>

          <Text
            style={[
              styles.chartDescription,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            Catégories les plus représentées
          </Text>
        </View>

        <Text
          style={[
            styles.chartTotal,
            {
              color:
                colors.text,
            },
          ]}
        >
          {total}
        </Text>
      </View>

      <View
        style={
          styles.categoryChart
        }
      >
        {visible.map(
          (
            category,
          ) => {
            const ratio =
              category.count /
              maximum;

            const percent =
              total > 0
                ? (
                    category.count /
                    total
                  ) *
                  100
                : 0;

            return (
              <View
                key={
                  category.slug
                }
                style={
                  styles.categoryChartRow
                }
              >
                <View
                  style={
                    styles.categoryChartLabelRow
                  }
                >
                  <Text
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.categoryChartLabel,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {
                      category.label
                    }
                  </Text>

                  <Text
                    style={[
                      styles.categoryChartPercent,
                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    {percent.toLocaleString(
                      'fr-FR',
                      {
                        maximumFractionDigits:
                          0,
                      },
                    )}
                    %
                  </Text>
                </View>

                <View
                  style={[
                    styles.categoryTrack,
                    {
                      backgroundColor:
                        colors.surfaceStrong,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.categoryFill,
                      {
                        backgroundColor:
                          colors.accent,

                        width: `${Math.max(
                          4,
                          ratio *
                            100,
                        )}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          },
        )}
      </View>
    </View>
  );
}

function FeaturedCard({
  portfolio,
  snapshot,
  onPress,
}: {
  portfolio:
    PublicPortfolio;

  snapshot:
    | PortfolioSnapshot
    | undefined;

  onPress:
    () => void;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  const performance =
    snapshot?.performance;

  const positive =
    (
      performance ??
      0
    ) >= 0;

  const owner =
    getOwnerName(
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
        styles.featuredCard,

        {
          backgroundColor:
            colors.surface,

          borderColor:
            colors.border,

          opacity:
            pressed
              ? 0.76
              : 1,
        },
      ]}
    >
      <View
        style={
          styles.featuredTop
        }
      >
        <View
          style={[
            styles.featuredCategoryIcon,
            {
              backgroundColor:
                colors.surfaceStrong,
            },
          ]}
        >
          <Ionicons
            name="pie-chart-outline"
            size={18}
            color={
              colors.text
            }
          />
        </View>

        <View
          style={[
            styles.performanceBadge,
            {
              backgroundColor:
                positive
                  ? colors.accentSoft
                  : colors.surfaceStrong,
            },
          ]}
        >
          <Ionicons
            name={
              positive
                ? 'trending-up-outline'
                : 'trending-down-outline'
            }
            size={13}
            color={
              positive
                ? colors.positive
                : colors.negative
            }
          />

          <Text
            style={[
              styles.performanceBadgeText,
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
        </View>
      </View>

      <Text
        numberOfLines={
          2
        }
        style={[
          styles.featuredTitle,
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
          styles.featuredOwner,
          {
            color:
              colors.textMuted,
          },
        ]}
      >
        {owner}
      </Text>

      <View
        style={
          styles.featuredMetrics
        }
      >
        <View>
          <Text
            style={[
              styles.featuredMetricValue,
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
              styles.featuredMetricLabel,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            actifs
          </Text>
        </View>

        <View>
          <Text
            style={[
              styles.featuredMetricValue,
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
              styles.featuredMetricLabel,
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

      <AllocationStrip
        snapshot={
          snapshot
        }
      />
    </Pressable>
  );
}

function AllocationStrip({
  snapshot,
}: {
  snapshot:
    | PortfolioSnapshot
    | undefined;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  const holdings =
    (
      snapshot?.holdings ??
      []
    )
      .filter(
        (
          holding,
        ) =>
          (
            holding
              .allocationPercent ??
            0
          ) > 0,
      )
      .sort(
        (
          left,
          right,
        ) =>
          (
            right.allocationPercent ??
            0
          ) -
          (
            left.allocationPercent ??
            0
          ),
      )
      .slice(
        0,
        4,
      );

  if (
    holdings.length ===
    0
  ) {
    return (
      <View
        style={[
          styles.allocationEmpty,
          {
            backgroundColor:
              colors.surfaceStrong,
          },
        ]}
      />
    );
  }

  const used =
    holdings.reduce(
      (
        total,
        holding,
      ) =>
        total +
        Math.max(
          0,
          holding
            .allocationPercent ??
            0,
        ),

      0,
    );

  const remainder =
    Math.max(
      0,
      100 -
        used,
    );

  return (
    <View
      style={[
        styles.allocationStrip,
        {
          backgroundColor:
            colors.surfaceStrong,
        },
      ]}
    >
      {holdings.map(
        (
          holding,
          index,
        ) => (
          <View
            key={`${holding.symbol}-${index}`}
            style={{
              backgroundColor:
                colors.accent,

              flex:
                Math.max(
                  holding
                    .allocationPercent ??
                    0,

                  0.5,
                ),

              opacity:
                Math.max(
                  0.35,

                  1 -
                    index *
                      0.18,
                ),
            }}
          />
        ),
      )}

      {remainder > 0 ? (
        <View
          style={{
            flex:
              remainder,
          }}
        />
      ) : null}
    </View>
  );
}

function DiscoverPortfolioCard({
  portfolio,
  snapshot,
  onPress,
}: {
  portfolio:
    PublicPortfolio;

  snapshot:
    | PortfolioSnapshot
    | undefined;

  onPress:
    () => void;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  const ownerName =
    getOwnerName(
      portfolio,
    );

  const performance =
    snapshot?.performance;

  const positive =
    (
      performance ??
      0
    ) >= 0;

  const holdings =
    (
      snapshot?.holdings ??
      []
    )
      .filter(
        (
          holding,
        ) =>
          (
            holding
              .allocationPercent ??
            0
          ) > 0,
      )
      .sort(
        (
          left,
          right,
        ) =>
          (
            right.allocationPercent ??
            0
          ) -
          (
            left.allocationPercent ??
            0
          ),
      )
      .slice(
        0,
        3,
      );

  return (
    <Pressable
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.portfolioCard,

        {
          backgroundColor:
            colors.surface,

          borderColor:
            colors.border,

          opacity:
            pressed
              ? 0.75
              : 1,
        },
      ]}
    >
      <View
        style={
          styles.portfolioHeader
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
                  colors.surfaceStrong,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarInitials,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              {initials(
                ownerName,
              )}
            </Text>
          </View>
        )}

        <View
          style={
            styles.ownerCopy
          }
        >
          <Text
            numberOfLines={
              1
            }
            style={[
              styles.ownerName,
              {
                color:
                  colors.text,
              },
            ]}
          >
            {ownerName}
          </Text>

          <Text
            numberOfLines={
              1
            }
            style={[
              styles.ownerUsername,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            {portfolio.owner
              ?.username
              ? `@${portfolio.owner.username}`
              : 'Teryso'}
          </Text>
        </View>

        <View
          style={[
            styles.followersPill,
            {
              backgroundColor:
                colors.surfaceStrong,
            },
          ]}
        >
          <Ionicons
            name="people-outline"
            size={13}
            color={
              colors.textMuted
            }
          />

          <Text
            style={[
              styles.followersText,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            {
              portfolio.followers
            }
          </Text>
        </View>
      </View>

      <View
        style={
          styles.portfolioTitleRow
        }
      >
        <View
          style={
            styles.portfolioTitleCopy
          }
        >
          <Text
            numberOfLines={
              2
            }
            style={[
              styles.portfolioTitle,
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
            style={[
              styles.portfolioCategory,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            {formatCategory(
              portfolio.categorySlug,
            )}
            {' · '}
            {updatedLabel(
              portfolio.updatedAt,
            )}
          </Text>
        </View>

        {performance !==
          null &&
        performance !==
          undefined ? (
          <View
            style={[
              styles.cardPerformance,
              {
                backgroundColor:
                  positive
                    ? colors.accentSoft
                    : colors.surfaceStrong,
              },
            ]}
          >
            <Ionicons
              name={
                positive
                  ? 'trending-up'
                  : 'trending-down'
              }
              size={14}
              color={
                positive
                  ? colors.positive
                  : colors.negative
              }
            />

            <Text
              style={[
                styles.cardPerformanceText,
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
          </View>
        ) : null}
      </View>

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
          styles.allocationSection
        }
      >
        <View
          style={
            styles.allocationHeading
          }
        >
          <Text
            style={[
              styles.allocationLabel,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            Allocation
          </Text>

          <Text
            style={[
              styles.assetsLabel,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            {snapshot
              ?.assetsCount ??
              '—'}{' '}
            actifs
          </Text>
        </View>

        <AllocationStrip
          snapshot={
            snapshot
          }
        />

        {holdings.length >
        0 ? (
          <View
            style={
              styles.holdingsRow
            }
          >
            {holdings.map(
              (
                holding,
              ) => (
                <View
                  key={
                    holding.symbol
                  }
                  style={[
                    styles.holdingChip,
                    {
                      backgroundColor:
                        colors.surfaceStrong,
                    },
                  ]}
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

                  <Text
                    style={[
                      styles.holdingAllocation,
                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    {formatAllocation(
                      holding.allocationPercent,
                    )}
                  </Text>
                </View>
              ),
            )}
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.portfolioFooter,
          {
            borderTopColor:
              colors.border,
          },
        ]}
      >
        <View
          style={
            styles.governance
          }
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={14}
            color={
              colors.textMuted
            }
          />

          <Text
            style={[
              styles.governanceText,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            {
              portfolio.governanceMode
            }
          </Text>
        </View>

        <View
          style={
            styles.openButton
          }
        >
          <Text
            style={[
              styles.openText,
              {
                color:
                  colors.text,
              },
            ]}
          >
            Voir
          </Text>

          <Ionicons
            name="arrow-forward"
            size={15}
            color={
              colors.text
            }
          />
        </View>
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
      paddingBottom:
        36,

      paddingHorizontal:
        18,

      paddingTop:
        14,
    },

    separator: {
      height:
        12,
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

      marginTop:
        20,

      minHeight:
        50,

      paddingHorizontal:
        14,
    },

    searchInput: {
      flex: 1,

      fontSize:
        13,

      minHeight:
        48,

      paddingVertical:
        0,
    },

    radar: {
      borderRadius:
        22,

      borderWidth:
        1,

      marginTop:
        14,

      overflow:
        'hidden',

      paddingHorizontal:
        16,

      paddingTop:
        17,
    },

    radarTop: {
      alignItems:
        'flex-start',

      flexDirection:
        'row',

      gap:
        12,
    },

    radarIcon: {
      alignItems:
        'center',

      borderRadius:
        13,

      height:
        42,

      justifyContent:
        'center',

      width:
        42,
    },

    radarCopy: {
      flex: 1,
    },

    radarEyebrow: {
      fontSize:
        8.5,

      fontWeight:
        '900',

      letterSpacing:
        1.1,
    },

    radarTitle: {
      fontSize:
        18,

      fontWeight:
        '900',

      letterSpacing:
        -0.45,

      lineHeight:
        23,

      marginTop:
        4,
    },

    radarDescription: {
      fontSize:
        10.5,

      lineHeight:
        16,

      marginTop:
        5,
    },

    stats: {
      borderTopWidth:
        StyleSheet.hairlineWidth,

      flexDirection:
        'row',

      marginTop:
        17,

      paddingVertical:
        14,
    },

    metric: {
      alignItems:
        'center',

      flex: 1,
    },

    metricValue: {
      fontSize:
        15,

      fontWeight:
        '900',
    },

    metricLabel: {
      fontSize:
        8,

      fontWeight:
        '700',

      marginTop:
        3,
    },

    metricDivider: {
      width:
        StyleSheet.hairlineWidth,
    },

    sectionHeading: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      marginBottom:
        11,

      marginTop:
        25,
    },

    sectionEyebrow: {
      fontSize:
        8,

      fontWeight:
        '900',

      letterSpacing:
        1.05,
    },

    sectionTitle: {
      fontSize:
        18,

      fontWeight:
        '900',

      letterSpacing:
        -0.4,

      marginTop:
        3,
    },

    categoryScroll: {
      gap:
        7,

      paddingRight:
        10,
    },

    categoryButton: {
      alignItems:
        'center',

      borderRadius:
        12,

      borderWidth:
        1,

      flexDirection:
        'row',

      gap:
        7,

      minHeight:
        40,

      paddingHorizontal:
        11,
    },

    categoryButtonLabel: {
      fontSize:
        10,

      fontWeight:
        '900',
    },

    categoryCount: {
      alignItems:
        'center',

      borderRadius:
        999,

      justifyContent:
        'center',

      minHeight:
        19,

      minWidth:
        19,

      paddingHorizontal:
        5,
    },

    categoryCountText: {
      fontSize:
        7.5,

      fontWeight:
        '900',
    },

    chartCard: {
      borderRadius:
        18,

      borderWidth:
        1,

      padding:
        14,
    },

    chartHeader: {
      alignItems:
        'flex-start',

      flexDirection:
        'row',

      justifyContent:
        'space-between',
    },

    chartTitle: {
      fontSize:
        13,

      fontWeight:
        '900',
    },

    chartDescription: {
      fontSize:
        8.5,

      marginTop:
        3,
    },

    chartBadge: {
      alignItems:
        'center',

      borderRadius:
        999,

      flexDirection:
        'row',

      gap:
        4,

      paddingHorizontal:
        8,

      paddingVertical:
        5,
    },

    chartBadgeText: {
      fontSize:
        7.5,

      fontWeight:
        '900',
    },

    chartTotal: {
      fontSize:
        19,

      fontWeight:
        '900',
    },

    chartEmpty: {
      alignItems:
        'center',

      gap:
        7,

      justifyContent:
        'center',

      minHeight:
        125,
    },

    performanceChart: {
      flexDirection:
        'row',

      height:
        154,

      marginTop:
        14,

      position:
        'relative',
    },

    zeroLine: {
      height:
        StyleSheet.hairlineWidth,

      left:
        0,

      position:
        'absolute',

      right:
        0,

      top:
        79,
    },

    performanceSlot: {
      alignItems:
        'center',

      flex:
        1,

      minWidth:
        0,
    },

    performanceValue: {
      fontSize:
        7,

      fontWeight:
        '900',

      height:
        18,

      maxWidth:
        50,

      textAlign:
        'center',
    },

    barArea: {
      height:
        112,

      width:
        22,
    },

    barHalf: {
      alignItems:
        'center',

      height:
        56,

      justifyContent:
        'flex-end',
    },

    negativeBarHalf: {
      justifyContent:
        'flex-start',
    },

    performanceBar: {
      borderRadius:
        5,

      minHeight:
        4,

      width:
        13,
    },

    performanceName: {
      fontSize:
        7,

      fontWeight:
        '700',

      maxWidth:
        48,

      textAlign:
        'center',
    },

    chartSpacer: {
      height:
        10,
    },

    categoryChart: {
      gap:
        12,

      marginTop:
        16,
    },

    categoryChartRow: {
      gap:
        6,
    },

    categoryChartLabelRow: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'space-between',
    },

    categoryChartLabel: {
      flex:
        1,

      fontSize:
        9,

      fontWeight:
        '800',
    },

    categoryChartPercent: {
      fontSize:
        8,

      fontWeight:
        '800',
    },

    categoryTrack: {
      borderRadius:
        999,

      height:
        7,

      overflow:
        'hidden',
    },

    categoryFill: {
      borderRadius:
        999,

      height:
        '100%',
    },

    featuredScroll: {
      gap:
        10,

      paddingRight:
        10,
    },

    featuredCard: {
      borderRadius:
        18,

      borderWidth:
        1,

      padding:
        14,

      width:
        210,
    },

    featuredTop: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'space-between',
    },

    featuredCategoryIcon: {
      alignItems:
        'center',

      borderRadius:
        11,

      height:
        36,

      justifyContent:
        'center',

      width:
        36,
    },

    performanceBadge: {
      alignItems:
        'center',

      borderRadius:
        999,

      flexDirection:
        'row',

      gap:
        3,

      paddingHorizontal:
        7,

      paddingVertical:
        5,
    },

    performanceBadgeText: {
      fontSize:
        8,

      fontWeight:
        '900',
    },

    featuredTitle: {
      fontSize:
        15,

      fontWeight:
        '900',

      letterSpacing:
        -0.3,

      lineHeight:
        19,

      marginTop:
        15,

      minHeight:
        38,
    },

    featuredOwner: {
      fontSize:
        8.5,

      fontWeight:
        '700',

      marginTop:
        4,
    },

    featuredMetrics: {
      flexDirection:
        'row',

      gap:
        28,

      marginTop:
        18,
    },

    featuredMetricValue: {
      fontSize:
        13,

      fontWeight:
        '900',
    },

    featuredMetricLabel: {
      fontSize:
        7.5,

      marginTop:
        2,
    },

    allocationStrip: {
      borderRadius:
        999,

      flexDirection:
        'row',

      height:
        7,

      marginTop:
        14,

      overflow:
        'hidden',
    },

    allocationEmpty: {
      borderRadius:
        999,

      height:
        7,

      marginTop:
        14,
    },

    resultsHeading: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      marginBottom:
        13,

      marginTop:
        28,
    },

    countPill: {
      alignItems:
        'center',

      borderRadius:
        999,

      justifyContent:
        'center',

      minHeight:
        29,

      minWidth:
        35,

      paddingHorizontal:
        9,
    },

    countText: {
      fontSize:
        10,

      fontWeight:
        '900',
    },

    stateBox: {
      alignItems:
        'center',

      gap:
        10,

      paddingVertical:
        32,
    },

    stateText: {
      fontSize:
        10,

      lineHeight:
        15,

      textAlign:
        'center',
    },

    errorBox: {
      alignItems:
        'flex-start',

      borderRadius:
        13,

      borderWidth:
        1,

      flexDirection:
        'row',

      gap:
        8,

      marginBottom:
        14,

      padding:
        12,
    },

    errorText: {
      flex: 1,

      fontSize:
        10,

      lineHeight:
        15,
    },

    empty: {
      alignItems:
        'center',

      borderRadius:
        18,

      borderWidth:
        1,

      padding:
        30,
    },

    emptyIcon: {
      alignItems:
        'center',

      borderRadius:
        999,

      height:
        44,

      justifyContent:
        'center',

      width:
        44,
    },

    emptyTitle: {
      fontSize:
        14,

      fontWeight:
        '900',

      marginTop:
        10,
    },

    resetButton: {
      alignItems:
        'center',

      borderRadius:
        10,

      justifyContent:
        'center',

      marginTop:
        15,

      minHeight:
        39,

      paddingHorizontal:
        15,
    },

    resetText: {
      fontSize:
        9,

      fontWeight:
        '900',
    },

    portfolioCard: {
      borderRadius:
        18,

      borderWidth:
        1,

      overflow:
        'hidden',

      padding:
        14,
    },

    portfolioHeader: {
      alignItems:
        'center',

      flexDirection:
        'row',
    },

    avatar: {
      borderRadius:
        18,

      height:
        36,

      width:
        36,
    },

    avatarFallback: {
      alignItems:
        'center',

      borderRadius:
        18,

      height:
        36,

      justifyContent:
        'center',

      width:
        36,
    },

    avatarInitials: {
      fontSize:
        9,

      fontWeight:
        '900',
    },

    ownerCopy: {
      flex:
        1,

      marginLeft:
        9,

      minWidth:
        0,
    },

    ownerName: {
      fontSize:
        10.5,

      fontWeight:
        '900',
    },

    ownerUsername: {
      fontSize:
        8,

      marginTop:
        2,
    },

    followersPill: {
      alignItems:
        'center',

      borderRadius:
        999,

      flexDirection:
        'row',

      gap:
        4,

      paddingHorizontal:
        7,

      paddingVertical:
        5,
    },

    followersText: {
      fontSize:
        8,

      fontWeight:
        '900',
    },

    portfolioTitleRow: {
      alignItems:
        'flex-start',

      flexDirection:
        'row',

      gap:
        10,

      marginTop:
        16,
    },

    portfolioTitleCopy: {
      flex:
        1,

      minWidth:
        0,
    },

    portfolioTitle: {
      fontSize:
        17,

      fontWeight:
        '900',

      letterSpacing:
        -0.4,

      lineHeight:
        21,
    },

    portfolioCategory: {
      fontSize:
        8,

      fontWeight:
        '700',

      marginTop:
        4,
    },

    cardPerformance: {
      alignItems:
        'center',

      borderRadius:
        999,

      flexDirection:
        'row',

      gap:
        4,

      paddingHorizontal:
        8,

      paddingVertical:
        6,
    },

    cardPerformanceText: {
      fontSize:
        9,

      fontWeight:
        '900',
    },

    portfolioDescription: {
      fontSize:
        10,

      lineHeight:
        15,

      marginTop:
        11,
    },

    allocationSection: {
      marginTop:
        15,
    },

    allocationHeading: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'space-between',
    },

    allocationLabel: {
      fontSize:
        8,

      fontWeight:
        '800',
    },

    assetsLabel: {
      fontSize:
        8,

      fontWeight:
        '700',
    },

    holdingsRow: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        6,

      marginTop:
        9,
    },

    holdingChip: {
      alignItems:
        'center',

      borderRadius:
        8,

      flexDirection:
        'row',

      gap:
        5,

      paddingHorizontal:
        7,

      paddingVertical:
        5,
    },

    holdingSymbol: {
      fontSize:
        8,

      fontWeight:
        '900',
    },

    holdingAllocation: {
      fontSize:
        7,
    },

    portfolioFooter: {
      alignItems:
        'center',

      borderTopWidth:
        StyleSheet.hairlineWidth,

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      marginTop:
        14,

      paddingTop:
        11,
    },

    governance: {
      alignItems:
        'center',

      flexDirection:
        'row',

      gap:
        5,
    },

    governanceText: {
      fontSize:
        7.5,

      fontWeight:
        '700',

      textTransform:
        'capitalize',
    },

    openButton: {
      alignItems:
        'center',

      flexDirection:
        'row',

      gap:
        5,
    },

    openText: {
      fontSize:
        9,

      fontWeight:
        '900',
    },
  });