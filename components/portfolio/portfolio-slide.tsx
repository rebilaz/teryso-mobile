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
  currency: string | null;
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
  image_url: string | null;
  exchange: string | null;
  current_price: Numeric;
  change_24h: Numeric;
  fetched_at: string | null;
  price_timestamp: string | null;
};

type PositionRow =
  Position & {
    value: number;
    invested: number;
    gain: number | null;
    gainPercent: number | null;
  };

function toNumber(
  value: unknown,
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
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

function formatPositionMoney(
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

        minimumFractionDigits:
          0,

        maximumFractionDigits:
          Math.abs(number) <
          100
            ? 2
            : 0,
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

  return `${number >= 0 ? '+' : ''}${number.toLocaleString(
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

function formatHeldAmount(
  position: PositionRow,
) {
  const quantity =
    toNumber(
      position.quantity,
    );

  if (
    quantity ===
    null
  ) {
    return '—';
  }

  const formatted =
    formatQuantity(
      quantity,
    );

  if (
    position.asset_type ===
    'crypto'
  ) {
    return `${formatted} ${position.symbol}`;
  }

  return `${formatted} ${
    Math.abs(quantity) === 1
      ? 'titre'
      : 'titres'
  }`;
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
          setOverview(
            null,
          );

          setPositions(
            [],
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

        setError(
          null,
        );

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
            (
              overviewResult.data as
                | Overview
                | null
            ) ??
              null,
          );

          setPositions(
            Array.isArray(
              positionsResult.data,
            )
              ? (
                  positionsResult.data as Position[]
                )
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
          setLoading(
            false,
          );

          setRefreshing(
            false,
          );
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
          setChartPoints(
            [],
          );

          setChartLoading(
            false,
          );

          return;
        }

        setChartLoading(
          true,
        );

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
              ? (
                  data as PortfolioChartPoint[]
                )
              : [],
          );
        } catch (
          chartError
        ) {
          console.error(
            '[PortfolioSlide] loadChart',
            chartError,
          );

          setChartPoints(
            [],
          );
        } finally {
          setChartLoading(
            false,
          );
        }
      },
      [
        selectedPortfolioId,
        range,
      ],
    );

  useEffect(
    () => {
      void loadOverview();
    },
    [
      loadOverview,
      refreshKey,
    ],
  );

  useEffect(
    () => {
      void loadChart();
    },
    [
      loadChart,
      refreshKey,
    ],
  );

  const currency =
    overview?.currency ||
    selectedPortfolio
      ?.base_currency ||
    'EUR';

  const positionRows =
    useMemo<
      PositionRow[]
    >(
      () =>
        positions
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
                  ? (
                      gain /
                      invested
                    ) *
                    100
                  : null;

              return {
                ...position,

                value,

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
          ),
      [
        positions,
      ],
    );

  async function handleRefresh() {
    await Promise.all([
      loadOverview(
        true,
      ),

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
            style={styles.chartSection}
          >
            <View
              style={
                styles.chartHeading
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
                            backgroundColor:
                              colors.surfaceStrong,
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
          </View>

          <View
            style={
              styles.metricsRow
            }
          >
            <Metric
              label="Actifs"
              value={formatCompactMoney(
                overview.assets_value,
                currency,
              )}
            />

            <Metric
              label="Espèces"
              value={formatCompactMoney(
                overview.cash_value,
                currency,
              )}
            />

            <Metric
              label="Apports"
              value={formatCompactMoney(
                overview.net_contributions,
                currency,
              )}
            />
          </View>

          <View
            style={
              styles.positionsHeader
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
              Positions
            </Text>

            <Text
              style={[
                styles.positionsCount,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              {positionRows.length}
            </Text>
          </View>

          {positionRows.length ===
          0 ? (
            <View
              style={
                styles.noPositions
              }
            >
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
              style={
                styles.positionsList
              }
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

function Metric({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
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
        numberOfLines={
          1
        }
        adjustsFontSizeToFit
      >
        {
          value
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
        {
          label
        }
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
          transition={
            160
          }
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
          styles.positionCenter
        }
      >
        <Text
          numberOfLines={
            1
          }
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
          numberOfLines={
            1
          }
          style={[
            styles.positionDetails,
            {
              color:
                colors.textMuted,
            },
          ]}
        >
          {position.symbol}
          {' · '}
          {formatHeldAmount(
            position,
          )}
        </Text>
      </View>

      <View
        style={
          styles.positionRight
        }
      >
        <Text
          numberOfLines={
            1
          }
          style={[
            styles.positionValue,
            {
              color:
                colors.text,
            },
          ]}
        >
          {formatPositionMoney(
            position.value,
            position.currency ||
              currency,
          )}
        </Text>

        <Text
          numberOfLines={
            1
          }
          style={[
            styles.positionGain,
            {
              color:
                position.gainPercent ===
                null
                  ? colors.textMuted
                  : positive
                    ? colors.positive
                    : colors.negative,
            },
          ]}
        >
          {position.gainPercent ===
          null
            ? '—'
            : formatPercent(
                position.gainPercent,
              )}
        </Text>
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
        20,

      paddingTop:
        2,
    },

    balanceLabel: {
      fontSize:
        10,

      fontWeight:
        '700',
    },

    totalValue: {
      fontSize:
        37,

      fontWeight:
        '900',

      letterSpacing:
        -1.7,

      lineHeight:
        44,

      marginTop:
        3,
    },

    performanceRow: {
      alignItems:
        'center',

      flexDirection:
        'row',

      gap:
        9,

      marginTop:
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
        10,

      fontWeight:
        '600',
    },

    chartSection: {
      marginBottom:
        18,
    },

    chartHeading: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      marginBottom:
        8,
    },

    sectionTitle: {
      fontSize:
        18,

      fontWeight:
        '900',

      letterSpacing:
        -0.4,
    },

    rangeRow: {
      alignItems:
        'center',

      flexDirection:
        'row',

      gap:
        3,
    },

    rangeButton: {
      alignItems:
        'center',

      borderRadius:
        8,

      justifyContent:
        'center',

      minHeight:
        31,

      minWidth:
        39,

      paddingHorizontal:
        8,
    },

    rangeText: {
      fontSize:
        9,

      fontWeight:
        '900',
    },

    metricsRow: {
      flexDirection:
        'row',

      gap:
        18,

      marginBottom:
        30,

      paddingBottom:
        4,

      paddingTop:
        8,
    },

    metric: {
      alignItems:
        'center',

      flex:
        1,

      minWidth:
        0,
    },

    metricValue: {
      fontSize:
        16.5,

      fontWeight:
        '900',

      letterSpacing:
        -0.35,

      lineHeight:
        21,

      textAlign:
        'center',
    },

    metricLabel: {
      fontSize:
        10,

      fontWeight:
        '700',

      marginTop:
        4,

      textAlign:
        'center',
    },

    positionsHeader: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      marginBottom:
        7,
    },

    positionsCount: {
      fontSize:
        9,

      fontWeight:
        '800',
    },

    /*
     * Pas de fond, pas de bordure et pas de gros cadre.
     * La liste fait directement partie de la page.
     */
    positionsList: {
      paddingHorizontal:
        0,
    },

    /*
     * Une position = exactement deux lignes de texte :
     * 1. Nom / valeur
     * 2. Symbole + quantité / performance
     */
    positionRow: {
      alignItems:
        'center',

      flexDirection:
        'row',

      minHeight:
        68,

      paddingVertical:
        9,
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
        9,

      fontWeight:
        '900',
    },

    positionCenter: {
      flex:
        1,

      marginLeft:
        10,

      minWidth:
        0,
    },

    positionName: {
      fontSize:
        13.5,

      fontWeight:
        '900',

      lineHeight:
        15,
    },

    positionDetails: {
      fontSize:
        10,

      lineHeight:
        12,

      marginTop:
        2,
    },

    positionRight: {
      alignItems:
        'flex-end',

      justifyContent:
        'center',

      marginLeft:
        10,

      maxWidth:
        120,

      minWidth:
        78,
    },

    positionValue: {
      fontSize:
        13.5,

      fontWeight:
        '900',

      lineHeight:
        15,

      textAlign:
        'right',
    },

    positionGain: {
      fontSize:
        10.5,

      fontWeight:
        '900',

      lineHeight:
        12,

      marginTop:
        2,

      textAlign:
        'right',
    },

    noPositions: {
      paddingVertical:
        24,
    },

    noPositionsTitle: {
      fontSize:
        12,

      fontWeight:
        '900',
    },

    noPositionsText: {
      fontSize:
        9.5,

      lineHeight:
        15,

      marginTop:
        4,

      maxWidth:
        250,
    },
  });
