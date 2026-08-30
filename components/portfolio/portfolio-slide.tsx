import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
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
  PortfolioPerformanceChart,
  type PortfolioChartPoint,
} from '@/components/portfolio/portfolio-performance-chart';
import {
  usePortfolioSwipe,
} from '@/components/portfolio/portfolio-swipe-context';
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

type Overview = {
  portfolio_id: string;

  assets_count: Numeric;

  assets_value: Numeric;

  cash_value: Numeric;

  total_value: Numeric;

  total_deposits: Numeric;

  total_withdrawals: Numeric;

  net_contributions: Numeric;

  total_invested: Numeric;

  cost_basis: Numeric;

  gain: Numeric;

  gain_percent: Numeric;

  currency:
    string | null;
};

type Position = {
  holding_id: string;

  quantity: Numeric;

  average_buy_price: Numeric;

  currency: string;

  asset_id: string;

  asset_type: string;

  symbol: string;

  name: string;

  image_url:
    string | null;

  exchange:
    string | null;

  current_price: Numeric;

  change_24h: Numeric;

  fetched_at:
    string | null;

  price_timestamp:
    string | null;
};

type PositionRow =
  Position & {
    value: number;

    allocation: number;

    invested: number;

    gain:
      number | null;

    gainPercent:
      number | null;
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
    number ===
    null
  ) {
    return '—';
  }

  try {
    return new Intl.NumberFormat(
      'fr-FR',
      {
        style:
          'currency',

        currency,

        maximumFractionDigits:
          2,
      },
    ).format(number);
  } catch {
    return `${number.toLocaleString(
      'fr-FR',
      {
        maximumFractionDigits:
          2,
      },
    )} ${currency}`;
  }
}

function formatCompactMoney(
  value: unknown,
  currency = 'EUR',
) {
  const number =
    toNumber(value);

  if (
    number ===
    null
  ) {
    return '—';
  }

  try {
    return new Intl.NumberFormat(
      'fr-FR',
      {
        style:
          'currency',

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
  } catch {
    return `${number.toLocaleString(
      'fr-FR',
      {
        maximumFractionDigits:
          1,
      },
    )} ${currency}`;
  }
}

function formatPercent(
  value: unknown,
) {
  const number =
    toNumber(value);

  if (
    number ===
    null
  ) {
    return '—';
  }

  return `${
    number >=
    0
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
    number ===
    null
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

function getAssetTypeLabel(
  type: string,
) {
  const labels:
    Record<
      string,
      string
    > = {
    stock:
      'Action',

    etf:
      'ETF',

    crypto:
      'Crypto',

    index:
      'Indice',
  };

  return (
    labels[type] ??
    type
  );
}

export function PortfolioSlide() {
  const {
    colors,
  } =
    useTerysoTheme();

  const {
    selectedPortfolio,
    selectedPortfolioId,
    portfolioError,
    refreshKey,
  } =
    usePortfolioSwipe();

  const [
    overview,
    setOverview,
  ] =
    useState<
      Overview | null
    >(null);

  const [
    positions,
    setPositions,
  ] =
    useState<
      Position[]
    >([]);

  const [
    chartPoints,
    setChartPoints,
  ] =
    useState<
      PortfolioChartPoint[]
    >([]);

  const [
    range,
    setRange,
  ] =
    useState<PortfolioRange>(
      '1A',
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

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

  const loadOverview =
    useCallback(
      async (
        isRefresh =
          false,
      ) => {
        if (
          !selectedPortfolioId
        ) {
          setOverview(null);
          setPositions([]);
          setLoading(false);
          setRefreshing(false);

          return;
        }

        if (
          isRefresh
        ) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        try {
          const [
            overviewResult,
            positionsResult,
          ] =
            await Promise.all([
              supabase.rpc(
                'get_private_portfolio_overview',
                {
                  p_portfolio_id:
                    selectedPortfolioId,
                },
              ),

              supabase.rpc(
                'get_private_portfolio_positions',
                {
                  p_portfolio_id:
                    selectedPortfolioId,
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
        } catch (
          loadError
        ) {
          console.error(
            '[PortfolioSlide] loadOverview',
            loadError,
          );

          setError(
            loadError instanceof
            Error
              ? loadError.message
              : 'Impossible de charger le portefeuille.',
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        selectedPortfolioId,
      ],
    );

  const loadChart =
    useCallback(
      async () => {
        if (
          !selectedPortfolioId
        ) {
          setChartPoints([]);
          setChartLoading(false);

          return;
        }

        setChartLoading(true);

        try {
          const {
            data,
            error:
              chartError,
          } =
            await supabase.rpc(
              'get_private_portfolio_chart_points',
              {
                p_portfolio_id:
                  selectedPortfolioId,

                p_range:
                  range,
              },
            );

          if (
            chartError
          ) {
            throw chartError;
          }

          setChartPoints(
            Array.isArray(
              data,
            )
              ? (data as PortfolioChartPoint[])
              : [],
          );
        } catch (
          chartError
        ) {
          console.error(
            '[PortfolioSlide] loadChart',
            chartError,
          );

          setChartPoints([]);
        } finally {
          setChartLoading(false);
        }
      },
      [
        selectedPortfolioId,
        range,
      ],
    );

  useEffect(() => {
    void loadOverview();
  }, [
    loadOverview,
    refreshKey,
  ]);

  useEffect(() => {
    void loadChart();
  }, [
    loadChart,
    refreshKey,
  ]);

  const currency =
    overview?.currency ||
    selectedPortfolio
      ?.base_currency ||
    'EUR';

  const positionRows =
    useMemo<
      PositionRow[]
    >(
      () => {
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
                gain !==
                  null &&
                invested >
                  0
                  ? (gain /
                      invested) *
                    100
                  : null;

              const allocation =
                assetsValue >
                0
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
      },
      [
        positions,
        overview?.assets_value,
      ],
    );

  async function handleRefresh() {
    await Promise.all([
      loadOverview(true),
      loadChart(),
    ]);
  }

  if (
    !selectedPortfolio
  ) {
    return (
      <View
        style={
          styles.center
        }
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
            name="wallet-outline"
            size={25}
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
          Aucun portefeuille
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
          Crée un portefeuille pour commencer.
        </Text>
      </View>
    );
  }

  if (
    loading &&
    !overview
  ) {
    return (
      <View
        style={
          styles.center
        }
      >
        <ActivityIndicator
          size="small"
          color={
            colors.text
          }
        />
      </View>
    );
  }

  return (
    <ScrollView
      nestedScrollEnabled
      showsVerticalScrollIndicator={
        false
      }
      contentContainerStyle={
        styles.content
      }
      refreshControl={
        <RefreshControl
          refreshing={
            refreshing
          }
          onRefresh={() =>
            void handleRefresh()
          }
          tintColor={
            colors.text
          }
        />
      }
    >
      {portfolioError ||
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
            {error ??
              portfolioError}
          </Text>
        </View>
      ) : null}

      {overview ? (
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
              numberOfLines={
                1
              }
              adjustsFontSizeToFit
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
              <View
                style={[
                  styles.performanceBadge,
                  {
                    backgroundColor:
                      numberOrZero(
                        overview.gain_percent,
                      ) >=
                      0
                        ? colors.accentSoft
                        : colors.surfaceStrong,
                  },
                ]}
              >
                <Ionicons
                  name={
                    numberOrZero(
                      overview.gain_percent,
                    ) >=
                    0
                      ? 'trending-up'
                      : 'trending-down'
                  }
                  size={14}
                  color={
                    numberOrZero(
                      overview.gain_percent,
                    ) >=
                    0
                      ? colors.positive
                      : colors.negative
                  }
                />

                <Text
                  style={[
                    styles.performanceText,
                    {
                      color:
                        numberOrZero(
                          overview.gain_percent,
                        ) >=
                        0
                          ? colors.positive
                          : colors.negative,
                    },
                  ]}
                >
                  {formatPercent(
                    overview.gain_percent,
                  )}
                </Text>
              </View>

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
                  overview.gain,
                  currency,
                )}
              </Text>
            </View>
          </View>

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
                styles.chartHeading
              }
            >
              <View
                style={
                  styles.chartHeadingCopy
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

                <Text
                  style={[
                    styles.sectionSubtitle,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  Évolution de la valeur
                </Text>
              </View>
            </View>

            <PortfolioPerformanceChart
              points={
                chartPoints
              }
              currency={
                currency
              }
              loading={
                chartLoading
              }
            />

            <View
              style={[
                styles.rangeSelector,
                {
                  backgroundColor:
                    colors.surfaceStrong,
                },
              ]}
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
                      accessibilityRole="button"
                      onPress={() =>
                        setRange(
                          option,
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.rangeButton,

                        active && {
                          backgroundColor:
                            colors.surface,
                        },

                        {
                          opacity:
                            pressed
                              ? 0.65
                              : 1,
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
              styles.metricsGrid
            }
          >
            <MetricCard
              icon="cash-outline"
              label="Espèces"
              value={formatCompactMoney(
                overview.cash_value,
                currency,
              )}
            />

            <MetricCard
              icon="pie-chart-outline"
              label="Actifs"
              value={formatCompactMoney(
                overview.assets_value,
                currency,
              )}
            />

            <MetricCard
              icon="arrow-down-outline"
              label="Apports nets"
              value={formatCompactMoney(
                overview.net_contributions,
                currency,
              )}
            />

            <MetricCard
              icon="layers-outline"
              label="Positions"
              value={String(
                numberOrZero(
                  overview.assets_count,
                ),
              )}
            />
          </View>

          <View
            style={
              styles.positionsHeader
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
                {positionRows.length}{' '}
                actif
                {positionRows.length !==
                1
                  ? 's'
                  : ''}
              </Text>
            </View>
          </View>

          {positionRows.length ===
          0 ? (
            <View
              style={[
                styles.noPositions,
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
                  styles.noPositionsIcon,
                  {
                    backgroundColor:
                      colors.surfaceStrong,
                  },
                ]}
              >
                <Ionicons
                  name="layers-outline"
                  size={21}
                  color={
                    colors.textMuted
                  }
                />
              </View>

              <Text
                style={[
                  styles.noPositionsTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Aucune position
              </Text>

              <Text
                style={[
                  styles.noPositionsText,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Tes actifs apparaîtront ici après ta première transaction.
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.positionsList,
                {
                  backgroundColor:
                    colors.surface,

                  borderColor:
                    colors.border,
                },
              ]}
            >
              {positionRows.map(
                (
                  position,
                  index,
                ) => (
                  <PositionItem
                    key={
                      position.holding_id ||
                      position.asset_id
                    }
                    position={
                      position
                    }
                    currency={
                      currency
                    }
                    showBorder={
                      index <
                      positionRows.length -
                        1
                    }
                  />
                ),
              )}
            </View>
          )}
        </>
      ) : (
        <View
          style={
            styles.centerContent
          }
        >
          <Text
            style={[
              styles.emptyDescription,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            Impossible de charger les données du portefeuille.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon:
    | 'cash-outline'
    | 'pie-chart-outline'
    | 'arrow-down-outline'
    | 'layers-outline';

  label: string;

  value: string;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  return (
    <View
      style={[
        styles.metricCard,
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
          styles.metricIcon,
          {
            backgroundColor:
              colors.surfaceStrong,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={17}
          color={
            colors.text
          }
        />
      </View>

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

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
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
    </View>
  );
}

function PositionItem({
  position,
  currency,
  showBorder,
}: {
  position:
    PositionRow;

  currency:
    string;

  showBorder:
    boolean;
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
    <View
      style={[
        styles.positionRow,

        showBorder && {
          borderBottomColor:
            colors.border,

          borderBottomWidth:
            StyleSheet.hairlineWidth,
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
          transition={160}
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
              .slice(
                0,
                2,
              )
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
          {
            position.name
          }
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
          {
            position.symbol
          }
          {' · '}
          {getAssetTypeLabel(
            position.asset_type,
          )}
        </Text>

        <Text
          numberOfLines={1}
          style={[
            styles.positionQuantity,
            {
              color:
                colors.textMuted,
            },
          ]}
        >
          {formatQuantity(
            position.quantity,
          )}{' '}
          titres
        </Text>
      </View>

      <View
        style={
          styles.positionRight
        }
      >
        <Text
          numberOfLines={1}
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
  );
}

const styles =
  StyleSheet.create({
    content: {
      paddingBottom:
        48,

      paddingHorizontal:
        20,

      paddingTop:
        20,
    },

    center: {
      alignItems:
        'center',

      flex:
        1,

      justifyContent:
        'center',

      paddingHorizontal:
        35,
    },

    centerContent: {
      alignItems:
        'center',

      paddingVertical:
        60,
    },

    emptyIcon: {
      alignItems:
        'center',

      borderRadius:
        999,

      height:
        52,

      justifyContent:
        'center',

      width:
        52,
    },

    emptyTitle: {
      fontSize:
        16,

      fontWeight:
        '900',

      marginTop:
        14,
    },

    emptyDescription: {
      fontSize:
        11,

      lineHeight:
        17,

      marginTop:
        6,

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
        17,

      padding:
        12,
    },

    errorText: {
      flex:
        1,

      fontSize:
        10.5,

      lineHeight:
        16,
    },

    balanceSection: {
      paddingBottom:
        22,

      paddingTop:
        2,
    },

    balanceLabel: {
      fontSize:
        11,

      fontWeight:
        '700',
    },

    totalValue: {
      fontSize:
        38,

      fontWeight:
        '900',

      letterSpacing:
        -1.8,

      lineHeight:
        45,

      marginTop:
        4,
    },

    performanceRow: {
      alignItems:
        'center',

      flexDirection:
        'row',

      gap:
        9,

      marginTop:
        8,
    },

    performanceBadge: {
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

    performanceText: {
      fontSize:
        10.5,

      fontWeight:
        '900',
    },

    gainText: {
      fontSize:
        10.5,

      fontWeight:
        '600',
    },

    chartCard: {
      borderRadius:
        18,

      borderWidth:
        1,

      paddingHorizontal:
        15,

      paddingBottom:
        14,

      paddingTop:
        15,
    },

    chartHeading: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      marginBottom:
        9,
    },

    chartHeadingCopy: {
      flex:
        1,
    },

    sectionTitle: {
      fontSize:
        18,

      fontWeight:
        '900',

      letterSpacing:
        -0.4,
    },

    sectionSubtitle: {
      fontSize:
        9.5,

      lineHeight:
        14,

      marginTop:
        3,
    },

    rangeSelector: {
      borderRadius:
        11,

      flexDirection:
        'row',

      marginTop:
        12,

      padding:
        3,
    },

    rangeButton: {
      alignItems:
        'center',

      borderRadius:
        8,

      flex:
        1,

      justifyContent:
        'center',

      minHeight:
        35,
    },

    rangeText: {
      fontSize:
        10,

      fontWeight:
        '900',
    },

    metricsGrid: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        10,

      marginTop:
        18,
    },

    metricCard: {
      borderRadius:
        15,

      borderWidth:
        1,

      minHeight:
        114,

      padding:
        13,

      width:
        '48.5%',
    },

    metricIcon: {
      alignItems:
        'center',

      borderRadius:
        10,

      height:
        32,

      justifyContent:
        'center',

      width:
        32,
    },

    metricLabel: {
      fontSize:
        9.5,

      fontWeight:
        '600',

      marginTop:
        10,
    },

    metricValue: {
      fontSize:
        15,

      fontWeight:
        '900',

      marginTop:
        4,
    },

    positionsHeader: {
      marginBottom:
        10,

      marginTop:
        28,
    },

    positionsList: {
      borderRadius:
        16,

      borderWidth:
        1,

      overflow:
        'hidden',

      paddingHorizontal:
        13,
    },

    positionRow: {
      alignItems:
        'center',

      flexDirection:
        'row',

      minHeight:
        78,

      paddingVertical:
        11,
    },

    positionLogo: {
      borderRadius:
        20,

      height:
        40,

      width:
        40,
    },

    positionFallback: {
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

    positionFallbackText: {
      fontSize:
        10,

      fontWeight:
        '900',
    },

    positionCopy: {
      flex:
        1,

      marginLeft:
        11,

      minWidth:
        0,
    },

    positionName: {
      fontSize:
        12.5,

      fontWeight:
        '900',
    },

    positionMeta: {
      fontSize:
        8.5,

      marginTop:
        3,
    },

    positionQuantity: {
      fontSize:
        8.5,

      marginTop:
        3,
    },

    positionRight: {
      alignItems:
        'flex-end',

      marginLeft:
        9,

      maxWidth:
        115,
    },

    positionValue: {
      fontSize:
        11.5,

      fontWeight:
        '900',

      textAlign:
        'right',
    },

    positionAllocation: {
      fontSize:
        8.5,

      marginTop:
        3,
    },

    positionGain: {
      fontSize:
        8.5,

      fontWeight:
        '800',

      marginTop:
        2,
    },

    noPositions: {
      alignItems:
        'center',

      borderRadius:
        16,

      borderWidth:
        1,

      paddingHorizontal:
        24,

      paddingVertical:
        31,
    },

    noPositionsIcon: {
      alignItems:
        'center',

      borderRadius:
        999,

      height:
        43,

      justifyContent:
        'center',

      width:
        43,
    },

    noPositionsTitle: {
      fontSize:
        13,

      fontWeight:
        '900',

      marginTop:
        10,
    },

    noPositionsText: {
      fontSize:
        9.5,

      lineHeight:
        15,

      marginTop:
        5,

      maxWidth:
        240,

      textAlign:
        'center',
    },
  });