import Ionicons from '@expo/vector-icons/Ionicons';
import {
    Image,
} from 'expo-image';
import {
    useLocalSearchParams,
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
    Alert,
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

type Numeric =
  | number
  | string
  | null;

type PortfolioRange =
  | '1M'
  | '1A'
  | 'MAX';

type Portfolio = {
  id: string;
  name: string;
  slug: string;
  description: string;
  base_currency: string;
  is_public: boolean;
  governance_mode: string;
};

type Overview = {
  portfolio_id: string;

  assets_count:
    Numeric;

  assets_value:
    Numeric;

  cash_value:
    Numeric;

  total_value:
    Numeric;

  total_deposits:
    Numeric;

  total_withdrawals:
    Numeric;

  net_contributions:
    Numeric;

  total_invested:
    Numeric;

  cost_basis:
    Numeric;

  gain:
    Numeric;

  gain_percent:
    Numeric;

  currency:
    string | null;
};

type ChartPoint = {
  snapshot_at: string;

  total_value:
    Numeric;

  currency:
    string | null;
};

type Position = {
  holding_id: string;

  quantity:
    Numeric;

  average_buy_price:
    Numeric;

  currency: string;

  asset_id: string;

  asset_type: string;

  symbol: string;

  name: string;

  image_url:
    string | null;

  exchange:
    string | null;

  current_price:
    Numeric;

  change_24h:
    Numeric;

  fetched_at:
    string | null;

  price_timestamp:
    string | null;
};

type PositionWithValue =
  Position & {
    value: number;
    allocation: number;
    invested: number;
    gain: number | null;
    gainPercent:
      number | null;
  };

const MANAGEMENT_ITEMS = [
  {
    title:
      'Transactions',

    subtitle:
      'Historique des opérations',

    icon:
      'swap-horizontal-outline' as const,
  },

  {
    title:
      'Assemblée',

    subtitle:
      'Votes et décisions',

    icon:
      'people-outline' as const,
  },

  {
    title:
      'Règles',

    subtitle:
      'Stratégie de gestion',

    icon:
      'document-text-outline' as const,
  },

  {
    title:
      'Positions',

    subtitle:
      'Tous les actifs détenus',

    icon:
      'layers-outline' as const,
  },
];

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

function formatQuantity(
  value: unknown,
) {
  const number =
    toNumber(value);

  if (
    number === null
  ) {
    return '—';
  }

  return number.toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits:
        6,
    },
  );
}

function formatChartDate(
  value: string,
  range: PortfolioRange,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  if (
    range === '1M'
  ) {
    return date.toLocaleDateString(
      'fr-FR',
      {
        day: '2-digit',
        month: 'short',
      },
    );
  }

  return date.toLocaleDateString(
    'fr-FR',
    {
      month: 'short',
      year: '2-digit',
    },
  );
}

function getAssetTypeLabel(
  type: string,
) {
  const labels:
    Record<
      string,
      string
    > = {
    stock: 'Action',
    etf: 'ETF',
    crypto: 'Crypto',
    index: 'Indice',
  };

  return (
    labels[type] ??
    type
  );
}

export default function PortfolioScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      portfolioId?: string;
      refresh?: string;
    }>();

  const {
    session,
  } = useAuth();

  const {
    colors,
  } =
    useTerysoTheme();

  const [
    portfolios,
    setPortfolios,
  ] =
    useState<
      Portfolio[]
    >([]);

  const [
    selectedPortfolioId,
    setSelectedPortfolioId,
  ] =
    useState<
      string | null
    >(null);

  const [
    portfolioMenuOpen,
    setPortfolioMenuOpen,
  ] =
    useState(false);

  const [
    overview,
    setOverview,
  ] =
    useState<
      Overview | null
    >(null);

  const [
    chartPoints,
    setChartPoints,
  ] =
    useState<
      ChartPoint[]
    >([]);

  const [
    positions,
    setPositions,
  ] =
    useState<
      Position[]
    >([]);

  const [
    range,
    setRange,
  ] =
    useState<
      PortfolioRange
    >('1A');

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
    chartLoading,
    setChartLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const requestedPortfolioId =
    params.portfolioId;

  const selectedPortfolio =
    useMemo(
      () =>
        portfolios.find(
          (portfolio) =>
            portfolio.id ===
            selectedPortfolioId,
        ) ?? null,
      [
        portfolios,
        selectedPortfolioId,
      ],
    );

  const currency =
    overview?.currency ||
    selectedPortfolio
      ?.base_currency ||
    'EUR';

  const loadPortfolioList =
    useCallback(
      async () => {
        const userId =
          session?.user.id;

        if (!userId) {
          return;
        }

        const {
          data,
          error:
            portfolioError,
        } =
          await supabase
            .from(
              'portfolios',
            )
            .select(
              'id,name,slug,description,base_currency,is_public,governance_mode',
            )
            .eq(
              'user_id',
              userId,
            )
            .order(
              'created_at',
              {
                ascending:
                  true,
              },
            );

        if (
          portfolioError
        ) {
          throw portfolioError;
        }

        const rows =
          (data ??
            []) as Portfolio[];

        setPortfolios(
          rows,
        );

        setSelectedPortfolioId(
          (current) => {
            if (
              requestedPortfolioId &&
              rows.some(
                (
                  portfolio,
                ) =>
                  portfolio.id ===
                  requestedPortfolioId,
              )
            ) {
              return requestedPortfolioId;
            }

            if (
              current &&
              rows.some(
                (
                  portfolio,
                ) =>
                  portfolio.id ===
                  current,
              )
            ) {
              return current;
            }

            return (
              rows[0]?.id ??
              null
            );
          },
        );
      },
      [
        requestedPortfolioId,
        session?.user.id,
      ],
    );

  const loadDashboard =
    useCallback(
      async (
        portfolioId:
          string,

        nextRange:
          PortfolioRange,

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

        setChartLoading(
          true,
        );

        setError(null);

        try {
          const [
            overviewResult,
            positionsResult,
            chartResult,
          ] =
            await Promise.all([
              supabase.rpc(
                'get_private_portfolio_overview',
                {
                  p_portfolio_id:
                    portfolioId,
                },
              ),

              supabase.rpc(
                'get_private_portfolio_positions',
                {
                  p_portfolio_id:
                    portfolioId,
                },
              ),

              supabase.rpc(
                'get_private_portfolio_chart_points',
                {
                  p_portfolio_id:
                    portfolioId,

                  p_range:
                    nextRange,
                },
              ),
            ]);

          if (
            overviewResult.error
          ) {
            throw overviewResult.error;
          }

          if (
            positionsResult.error
          ) {
            throw positionsResult.error;
          }

          if (
            chartResult.error
          ) {
            throw chartResult.error;
          }

          setOverview(
            (overviewResult.data as
              | Overview
              | null) ??
              null,
          );

          setPositions(
            Array.isArray(
              positionsResult.data,
            )
              ? (positionsResult.data as Position[])
              : [],
          );

          setChartPoints(
            Array.isArray(
              chartResult.data,
            )
              ? (chartResult.data as ChartPoint[])
              : [],
          );
        } catch (
          loadError
        ) {
          console.error(
            'Dashboard portefeuille :',
            loadError,
          );

          setError(
            loadError instanceof
            Error
              ? loadError.message
              : 'Impossible de charger le portefeuille.',
          );
        } finally {
          setLoading(
            false,
          );

          setRefreshing(
            false,
          );

          setChartLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    async function start() {
      try {
        setLoading(
          true,
        );

        await loadPortfolioList();
      } catch (
        loadError
      ) {
        setError(
          loadError instanceof
          Error
            ? loadError.message
            : 'Impossible de charger les portefeuilles.',
        );

        setLoading(
          false,
        );
      }
    }

    void start();
  }, [
    loadPortfolioList,
    params.refresh,
  ]);

  useEffect(() => {
    if (
      selectedPortfolioId
    ) {
      void loadDashboard(
        selectedPortfolioId,
        range,
      );
    }
  }, [
    selectedPortfolioId,
    range,
    params.refresh,
    loadDashboard,
  ]);

  const orderedChartPoints =
    useMemo(
      () =>
        [...chartPoints]
          .filter(
            (point) =>
              toNumber(
                point.total_value,
              ) !== null &&
              !Number.isNaN(
                new Date(
                  point.snapshot_at,
                ).getTime(),
              ),
          )
          .sort(
            (
              left,
              right,
            ) =>
              new Date(
                left.snapshot_at,
              ).getTime() -
              new Date(
                right.snapshot_at,
              ).getTime(),
          ),
      [
        chartPoints,
      ],
    );

  const positionRows =
    useMemo<
      PositionWithValue[]
    >(() => {
      const assetsValue =
        numberOrZero(
          overview?.assets_value,
        );

      return positions
        .map(
          (
            position,
          ) => {
            const quantity =
              numberOrZero(
                position.quantity,
              );

            const currentPrice =
              numberOrZero(
                position.current_price,
              );

            const averagePrice =
              toNumber(
                position.average_buy_price,
              );

            const value =
              quantity *
              currentPrice;

            const invested =
              averagePrice !==
              null
                ? quantity *
                  averagePrice
                : 0;

            const gain =
              averagePrice !==
              null
                ? value -
                  invested
                : null;

            const gainPercent =
              gain !== null &&
              invested > 0
                ? (gain /
                    invested) *
                  100
                : null;

            const allocation =
              assetsValue > 0
                ? (value /
                    assetsValue) *
                  100
                : 0;

            return {
              ...position,
              value,
              allocation,
              invested,
              gain,
              gainPercent,
            };
          },
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.value -
            left.value,
        );
    }, [
      positions,
      overview?.assets_value,
    ]);

  async function refresh() {
    if (
      !selectedPortfolioId
    ) {
      return;
    }

    await Promise.all([
      loadPortfolioList(),

      loadDashboard(
        selectedPortfolioId,
        range,
        true,
      ),
    ]);
  }

  function choosePortfolio(
    portfolio: Portfolio,
  ) {
    setSelectedPortfolioId(
      portfolio.id,
    );

    setPortfolioMenuOpen(
      false,
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
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() =>
              void refresh()
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
          eyebrow="Gestion"
          title="Portefeuille"
        />

        {portfolios.length >
        0 ? (
          <View
            style={
              styles.portfolioSelectorSection
            }
          >
            <Pressable
              onPress={() =>
                setPortfolioMenuOpen(
                  (
                    current,
                  ) =>
                    !current,
                )
              }
              style={[
                styles.portfolioSelector,
                {
                  borderBottomColor:
                    colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.selectorIcon,
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
                  styles.selectorCopy
                }
              >
                <Text
                  style={[
                    styles.selectorName,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  {selectedPortfolio
                    ?.name ??
                    'Portefeuille'}
                </Text>

                <Text
                  style={[
                    styles.selectorSubtitle,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  {selectedPortfolio
                    ?.base_currency ??
                    ''}
                </Text>
              </View>

              <Ionicons
                name={
                  portfolioMenuOpen
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={18}
                color={
                  colors.textMuted
                }
              />
            </Pressable>

            {portfolioMenuOpen
              ? portfolios.map(
                  (
                    portfolio,
                  ) => {
                    const active =
                      portfolio.id ===
                      selectedPortfolioId;

                    return (
                      <Pressable
                        key={
                          portfolio.id
                        }
                        onPress={() =>
                          choosePortfolio(
                            portfolio,
                          )
                        }
                        style={[
                          styles.portfolioOption,
                          {
                            borderBottomColor:
                              colors.border,
                          },
                        ]}
                      >
                        <View
                          style={
                            styles.optionCheck
                          }
                        >
                          {active ? (
                            <Ionicons
                              name="checkmark"
                              size={
                                19
                              }
                              color={
                                colors.text
                              }
                            />
                          ) : null}
                        </View>

                        <View
                          style={
                            styles.selectorCopy
                          }
                        >
                          <Text
                            style={[
                              styles.optionName,
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
                              styles.selectorSubtitle,
                              {
                                color:
                                  colors.textMuted,
                              },
                            ]}
                          >
                            {
                              portfolio.base_currency
                            }
                          </Text>
                        </View>
                      </Pressable>
                    );
                  },
                )
              : null}
          </View>
        ) : null}

        {loading &&
        !overview ? (
          <ActivityIndicator
            style={{
              marginVertical:
                60,
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
        portfolios.length ===
          0 ? (
          <View
            style={
              styles.empty
            }
          >
            <Ionicons
              name="wallet-outline"
              size={30}
              color={
                colors.textMuted
              }
            />

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
                styles.emptyText,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Crée ton premier
              portefeuille pour
              commencer.
            </Text>
          </View>
        ) : null}

        {selectedPortfolio &&
        overview ? (
          <>
            <View
              style={
                styles.balanceSection
              }
            >
              <Text
                style={[
                  styles.balanceLabel,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Valeur totale
              </Text>

              <Text
                style={[
                  styles.totalValue,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {formatMoney(
                  overview.total_value,
                  currency,
                )}
              </Text>

              <View
                style={
                  styles.performanceRow
                }
              >
                <Ionicons
                  name={
                    numberOrZero(
                      overview.gain_percent,
                    ) >= 0
                      ? 'arrow-up'
                      : 'arrow-down'
                  }
                  size={14}
                  color={
                    numberOrZero(
                      overview.gain_percent,
                    ) >= 0
                      ? colors.positive
                      : colors.negative
                  }
                />

                <Text
                  style={[
                    styles.performance,
                    {
                      color:
                        numberOrZero(
                          overview.gain_percent,
                        ) >= 0
                          ? colors.positive
                          : colors.negative,
                    },
                  ]}
                >
                  {formatPercent(
                    overview.gain_percent,
                  )}
                </Text>

                <Text
                  style={[
                    styles.gainAmount,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  {formatMoney(
                    overview.gain,
                    currency,
                  )}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.chartSection,
                {
                  borderBottomColor:
                    colors.border,

                  borderTopColor:
                    colors.border,
                },
              ]}
            >
              <View
                style={
                  styles.chartHeader
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
                  Performance
                </Text>

                {chartLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.text
                    }
                  />
                ) : null}
              </View>

              <PortfolioLineChart
                points={
                  orderedChartPoints
                }
                range={
                  range
                }
                positive={
                  numberOrZero(
                    overview.gain_percent,
                  ) >= 0
                }
              />

              <View
                style={
                  styles.rangeRow
                }
              >
                {(
                  [
                    '1M',
                    '1A',
                    'MAX',
                  ] as PortfolioRange[]
                ).map(
                  (
                    option,
                  ) => {
                    const active =
                      range ===
                      option;

                    return (
                      <Pressable
                        key={
                          option
                        }
                        onPress={() =>
                          setRange(
                            option,
                          )
                        }
                        style={[
                          styles.rangeButton,
                          active && {
                            borderBottomColor:
                              colors.text,

                            borderBottomWidth:
                              2,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.rangeText,
                            {
                              color:
                                active
                                  ? colors.text
                                  : colors.textMuted,
                            },
                          ]}
                        >
                          {
                            option
                          }
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </View>

            <View
              style={
                styles.statsSection
              }
            >
              <StatRow
                icon="cash-outline"
                label="Espèces"
                value={formatCompactMoney(
                  overview.cash_value,
                  currency,
                )}
              />

              <StatRow
                icon="pie-chart-outline"
                label="Valeur des actifs"
                value={formatCompactMoney(
                  overview.assets_value,
                  currency,
                )}
              />

              <StatRow
                icon="arrow-down-outline"
                label="Apports nets"
                value={formatCompactMoney(
                  overview.net_contributions,
                  currency,
                )}
              />

              <StatRow
                icon="layers-outline"
                label="Positions"
                value={String(
                  numberOrZero(
                    overview.assets_count,
                  ),
                )}
                last
              />
            </View>

            <View
              style={
                styles.sectionHeading
              }
            >
              <View>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  Positions
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
                  {
                    positionRows.length
                  }{' '}
                  actif
                  {positionRows.length >
                  1
                    ? 's'
                    : ''}
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  Alert.alert(
                    'Positions',
                    'La page complète des positions sera branchée ensuite.',
                  )
                }
              >
                <Text
                  style={[
                    styles.seeAll,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  Voir tout
                </Text>
              </Pressable>
            </View>

            <View>
              {positionRows.length ===
              0 ? (
                <Text
                  style={[
                    styles.noPosition,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  Aucune position
                  pour le moment.
                </Text>
              ) : (
                positionRows
                  .slice(
                    0,
                    6,
                  )
                  .map(
                    (
                      position,
                    ) => (
                      <PositionRow
                        key={
                          position.asset_id
                        }
                        position={
                          position
                        }
                        currency={
                          currency
                        }
                      />
                    ),
                  )
              )}
            </View>

            <View
              style={
                styles.sectionHeading
              }
            >
              <View>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  Gestion
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
                  {
                    selectedPortfolio.name
                  }
                </Text>
              </View>
            </View>

            <View>
              {MANAGEMENT_ITEMS.map(
                (
                  item,
                ) => (
                  <Pressable
                    key={
                      item.title
                    }
                    onPress={() =>
                      Alert.alert(
                        item.title,
                        `La page ${item.title} sera branchée à l’étape suivante.`,
                      )
                    }
                    style={[
                      styles.managementRow,
                      {
                        borderBottomColor:
                          colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.managementIcon,
                        {
                          backgroundColor:
                            colors.surfaceStrong,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          item.icon
                        }
                        size={
                          19
                        }
                        color={
                          colors.text
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.managementCopy
                      }
                    >
                      <Text
                        style={[
                          styles.managementTitle,
                          {
                            color:
                              colors.text,
                          },
                        ]}
                      >
                        {
                          item.title
                        }
                      </Text>

                      <Text
                        style={[
                          styles.managementSubtitle,
                          {
                            color:
                              colors.textMuted,
                          },
                        ]}
                      >
                        {
                          item.subtitle
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
                  </Pressable>
                ),
              )}
            </View>

            {selectedPortfolio.is_public ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname:
                      '/portfolio/[slug]',

                    params: {
                      slug:
                        selectedPortfolio.slug,
                    },
                  })
                }
                style={[
                  styles.publicRow,
                  {
                    borderBottomColor:
                      colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.managementIcon,
                    {
                      backgroundColor:
                        colors.surfaceStrong,
                    },
                  ]}
                >
                  <Ionicons
                    name="globe-outline"
                    size={19}
                    color={
                      colors.text
                    }
                  />
                </View>

                <View
                  style={
                    styles.managementCopy
                  }
                >
                  <Text
                    style={[
                      styles.managementTitle,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    Page publique
                  </Text>

                  <Text
                    style={[
                      styles.managementSubtitle,
                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    Voir le portefeuille
                    comme les autres
                    utilisateurs
                  </Text>
                </View>

                <Ionicons
                  name="arrow-up-forward-outline"
                  size={18}
                  color={
                    colors.textMuted
                  }
                />
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon:
    | 'cash-outline'
    | 'pie-chart-outline'
    | 'arrow-down-outline'
    | 'layers-outline';

  label: string;
  value: string;
  last?: boolean;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  return (
    <View
      style={[
        styles.statRow,

        !last && {
          borderBottomColor:
            colors.border,

          borderBottomWidth:
            1,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={19}
        color={
          colors.textMuted
        }
      />

      <Text
        style={[
          styles.statLabel,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.statValue,
          {
            color:
              colors.text,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function PositionRow({
  position,
  currency,
}: {
  position:
    PositionWithValue;

  currency: string;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  const positive =
    position.gainPercent ===
      null ||
    position.gainPercent >=
      0;

  return (
    <Pressable
      onPress={() =>
        Alert.alert(
          position.name,
          `${formatQuantity(
            position.quantity,
          )} ${position.symbol}`,
        )
      }
      style={[
        styles.positionRow,
        {
          borderBottomColor:
            colors.border,
        },
      ]}
    >
      {position.image_url ? (
        <Image
          source={{
            uri:
              position.image_url,
          }}
          style={
            styles.positionLogo
          }
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View
          style={[
            styles.positionFallback,
            {
              backgroundColor:
                colors.surfaceStrong,
            },
          ]}
        >
          <Text
            style={[
              styles.positionFallbackText,
              {
                color:
                  colors.text,
              },
            ]}
          >
            {position.symbol
              .slice(0, 2)
              .toUpperCase()}
          </Text>
        </View>
      )}

      <View
        style={
          styles.positionCopy
        }
      >
        <Text
          numberOfLines={1}
          style={[
            styles.positionName,
            {
              color:
                colors.text,
            },
          ]}
        >
          {position.name}
        </Text>

        <Text
          numberOfLines={1}
          style={[
            styles.positionMeta,
            {
              color:
                colors.textMuted,
            },
          ]}
        >
          {position.symbol}
          {' · '}
          {getAssetTypeLabel(
            position.asset_type,
          )}
          {' · '}
          {formatQuantity(
            position.quantity,
          )}
        </Text>
      </View>

      <View
        style={
          styles.positionRight
        }
      >
        <Text
          style={[
            styles.positionValue,
            {
              color:
                colors.text,
            },
          ]}
        >
          {formatCompactMoney(
            position.value,
            position.currency ||
              currency,
          )}
        </Text>

        <View
          style={
            styles.positionPerformanceRow
          }
        >
          <Text
            style={[
              styles.positionAllocation,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            {position.allocation.toLocaleString(
              'fr-FR',
              {
                maximumFractionDigits:
                  1,
              },
            )}
            %
          </Text>

          {position.gainPercent !==
          null ? (
            <Text
              style={[
                styles.positionGain,
                {
                  color:
                    positive
                      ? colors.positive
                      : colors.negative,
                },
              ]}
            >
              {formatPercent(
                position.gainPercent,
              )}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function PortfolioLineChart({
  points,
  range,
  positive,
}: {
  points:
    ChartPoint[];

  range:
    PortfolioRange;

  positive:
    boolean;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  const [
    width,
    setWidth,
  ] =
    useState(0);

  const height =
    180;

  const paddingX =
    4;

  const paddingY =
    15;

  const normalized =
    useMemo(
      () =>
        points.flatMap(
          (
            point,
          ) => {
            const value =
              toNumber(
                point.total_value,
              );

            if (
              value === null
            ) {
              return [];
            }

            return [
              {
                ...point,
                value,
              },
            ];
          },
        ),
      [
        points,
      ],
    );

  const values =
    normalized.map(
      (
        point,
      ) =>
        point.value,
    );

  let min =
    values.length
      ? Math.min(
          ...values,
        )
      : 0;

  let max =
    values.length
      ? Math.max(
          ...values,
        )
      : 1;

  if (
    min === max
  ) {
    const margin =
      Math.max(
        Math.abs(
          min,
        ) * 0.02,
        1,
      );

    min -= margin;
    max += margin;
  }

  const span =
    Math.max(
      max - min,
      1,
    );

  const usableWidth =
    Math.max(
      width -
        paddingX * 2,
      0,
    );

  const usableHeight =
    height -
    paddingY * 2;

  const coordinates =
    normalized.map(
      (
        point,
        index,
      ) => {
        const x =
          normalized.length <
          2
            ? width / 2
            : paddingX +
              (index /
                (normalized.length -
                  1)) *
                usableWidth;

        const y =
          paddingY +
          ((max -
            point.value) /
            span) *
            usableHeight;

        return {
          ...point,
          x,
          y,
        };
      },
    );

  const lineColor =
    positive
      ? colors.positive
      : colors.negative;

  if (
    normalized.length <
    2
  ) {
    return (
      <View
        style={
          styles.chartEmpty
        }
      >
        <Ionicons
          name="analytics-outline"
          size={25}
          color={
            colors.textMuted
          }
        />

        <Text
          style={[
            styles.chartEmptyText,
            {
              color:
                colors.textMuted,
            },
          ]}
        >
          Pas encore assez de données
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View
        onLayout={(
          event,
        ) =>
          setWidth(
            event
              .nativeEvent
              .layout.width,
          )
        }
        style={[
          styles.chart,
          {
            height,
          },
        ]}
      >
        {[0.25, 0.5, 0.75].map(
          (
            ratio,
          ) => (
            <View
              key={
                ratio
              }
              style={[
                styles.gridLine,
                {
                  backgroundColor:
                    colors.border,

                  top:
                    height *
                    ratio,
                },
              ]}
            />
          ),
        )}

        {width > 0
          ? coordinates
              .slice(
                0,
                -1,
              )
              .map(
                (
                  point,
                  index,
                ) => {
                  const next =
                    coordinates[
                      index + 1
                    ];

                  const deltaX =
                    next.x -
                    point.x;

                  const deltaY =
                    next.y -
                    point.y;

                  const length =
                    Math.sqrt(
                      deltaX *
                        deltaX +
                        deltaY *
                          deltaY,
                    );

                  const angle =
                    Math.atan2(
                      deltaY,
                      deltaX,
                    );

                  const centerX =
                    (point.x +
                      next.x) /
                    2;

                  const centerY =
                    (point.y +
                      next.y) /
                    2;

                  return (
                    <View
                      key={`${point.snapshot_at}-${index}`}
                      style={[
                        styles.chartSegment,
                        {
                          backgroundColor:
                            lineColor,

                          left:
                            centerX -
                            length /
                              2,

                          top:
                            centerY -
                            1,

                          width:
                            length,

                          transform:
                            [
                              {
                                rotateZ:
                                  `${angle}rad`,
                              },
                            ],
                        },
                      ]}
                    />
                  );
                },
              )
          : null}

        {coordinates.length >
        0 ? (
          <View
            style={[
              styles.chartDot,
              {
                backgroundColor:
                  lineColor,

                left:
                  coordinates[
                    coordinates.length -
                      1
                  ].x -
                  4,

                top:
                  coordinates[
                    coordinates.length -
                      1
                  ].y -
                  4,
              },
            ]}
          />
        ) : null}
      </View>

      <View
        style={
          styles.chartLabels
        }
      >
        <Text
          style={[
            styles.chartDate,
            {
              color:
                colors.textMuted,
            },
          ]}
        >
          {formatChartDate(
            coordinates[0]
              .snapshot_at,
            range,
          )}
        </Text>

        <Text
          style={[
            styles.chartDate,
            {
              color:
                colors.textMuted,
            },
          ]}
        >
          {formatChartDate(
            coordinates[
              coordinates.length -
                1
            ].snapshot_at,
            range,
          )}
        </Text>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },

    content: {
      paddingBottom: 38,
      paddingHorizontal: 20,
      paddingTop: 14,
    },

    portfolioSelectorSection: {
      marginTop: 21,
    },

    portfolioSelector: {
      alignItems: 'center',

      borderBottomWidth: 1,

      flexDirection: 'row',

      minHeight: 63,

      paddingVertical: 8,
    },

    selectorIcon: {
      alignItems: 'center',

      borderRadius: 18,

      height: 36,
      width: 36,

      justifyContent:
        'center',
    },

    selectorCopy: {
      flex: 1,

      marginLeft: 12,
    },

    selectorName: {
      fontSize: 14,

      fontWeight: '900',
    },

    selectorSubtitle: {
      fontSize: 10,

      marginTop: 3,
    },

    portfolioOption: {
      alignItems: 'center',

      borderBottomWidth: 1,

      flexDirection: 'row',

      minHeight: 56,

      paddingVertical: 7,
    },

    optionCheck: {
      alignItems: 'center',

      justifyContent:
        'center',

      width: 28,
    },

    optionName: {
      fontSize: 13,

      fontWeight: '800',
    },

    balanceSection: {
      paddingBottom: 28,
      paddingTop: 34,
    },

    balanceLabel: {
      fontSize: 11,

      fontWeight: '700',
    },

    totalValue: {
      fontSize: 40,

      fontWeight: '900',

      letterSpacing: -2,

      marginTop: 5,
    },

    performanceRow: {
      alignItems: 'center',

      flexDirection: 'row',

      gap: 5,

      marginTop: 8,
    },

    performance: {
      fontSize: 13,

      fontWeight: '900',
    },

    gainAmount: {
      fontSize: 11,

      marginLeft: 5,
    },

    chartSection: {
      borderBottomWidth: 1,

      borderTopWidth: 1,

      paddingBottom: 17,

      paddingTop: 20,
    },

    chartHeader: {
      alignItems: 'center',

      flexDirection: 'row',

      justifyContent:
        'space-between',

      marginBottom: 14,
    },

    chart: {
      overflow: 'hidden',

      position: 'relative',
    },

    gridLine: {
      height: 1,

      left: 0,

      opacity: 0.5,

      position: 'absolute',

      right: 0,
    },

    chartSegment: {
      borderRadius: 999,

      height: 2,

      position: 'absolute',
    },

    chartDot: {
      borderRadius: 999,

      height: 8,

      position: 'absolute',

      width: 8,
    },

    chartLabels: {
      flexDirection: 'row',

      justifyContent:
        'space-between',

      marginTop: 6,
    },

    chartDate: {
      fontSize: 9,

      fontWeight: '700',
    },

    chartEmpty: {
      alignItems: 'center',

      height: 160,

      justifyContent:
        'center',
    },

    chartEmptyText: {
      fontSize: 11,

      marginTop: 8,
    },

    rangeRow: {
      flexDirection: 'row',

      gap: 26,

      marginTop: 10,
    },

    rangeButton: {
      paddingBottom: 6,

      paddingTop: 6,
    },

    rangeText: {
      fontSize: 11,

      fontWeight: '900',
    },

    statsSection: {
      paddingTop: 10,
    },

    statRow: {
      alignItems: 'center',

      flexDirection: 'row',

      minHeight: 59,
    },

    statLabel: {
      flex: 1,

      fontSize: 12,

      marginLeft: 12,
    },

    statValue: {
      fontSize: 13,

      fontWeight: '900',
    },

    sectionHeading: {
      alignItems: 'flex-end',

      flexDirection: 'row',

      justifyContent:
        'space-between',

      marginBottom: 7,

      marginTop: 35,
    },

    sectionTitle: {
      fontSize: 20,

      fontWeight: '900',

      letterSpacing: -0.5,
    },

    sectionSubtitle: {
      fontSize: 10,

      marginTop: 4,
    },

    seeAll: {
      fontSize: 11,

      fontWeight: '800',
    },

    positionRow: {
      alignItems: 'center',

      borderBottomWidth: 1,

      flexDirection: 'row',

      minHeight: 72,

      paddingVertical: 10,
    },

    positionLogo: {
      borderRadius: 20,

      height: 40,
      width: 40,
    },

    positionFallback: {
      alignItems: 'center',

      borderRadius: 20,

      height: 40,
      width: 40,

      justifyContent:
        'center',
    },

    positionFallbackText: {
      fontSize: 10,

      fontWeight: '900',
    },

    positionCopy: {
      flex: 1,

      marginLeft: 12,

      minWidth: 0,
    },

    positionName: {
      fontSize: 13,

      fontWeight: '900',
    },

    positionMeta: {
      fontSize: 9,

      marginTop: 4,
    },

    positionRight: {
      alignItems:
        'flex-end',

      marginLeft: 10,
    },

    positionValue: {
      fontSize: 12,

      fontWeight: '900',
    },

    positionPerformanceRow: {
      alignItems: 'center',

      flexDirection: 'row',

      gap: 7,

      marginTop: 4,
    },

    positionAllocation: {
      fontSize: 9,
    },

    positionGain: {
      fontSize: 9,

      fontWeight: '800',
    },

    noPosition: {
      fontSize: 11,

      paddingVertical: 25,

      textAlign: 'center',
    },

    managementRow: {
      alignItems: 'center',

      borderBottomWidth: 1,

      flexDirection: 'row',

      minHeight: 68,

      paddingVertical: 9,
    },

    managementIcon: {
      alignItems: 'center',

      borderRadius: 18,

      height: 36,
      width: 36,

      justifyContent:
        'center',
    },

    managementCopy: {
      flex: 1,

      marginLeft: 12,
    },

    managementTitle: {
      fontSize: 14,

      fontWeight: '800',
    },

    managementSubtitle: {
      fontSize: 10,

      marginTop: 3,
    },

    publicRow: {
      alignItems: 'center',

      borderBottomWidth: 1,

      flexDirection: 'row',

      marginTop: 26,

      minHeight: 68,

      paddingVertical: 9,
    },

    errorRow: {
      alignItems:
        'flex-start',

      flexDirection: 'row',

      gap: 8,

      marginTop: 24,
    },

    errorText: {
      flex: 1,

      fontSize: 11,

      lineHeight: 16,
    },

    empty: {
      alignItems: 'center',

      paddingVertical: 70,
    },

    emptyTitle: {
      fontSize: 17,

      fontWeight: '900',

      marginTop: 12,
    },

    emptyText: {
      fontSize: 11,

      marginTop: 6,

      textAlign: 'center',
    },
  });