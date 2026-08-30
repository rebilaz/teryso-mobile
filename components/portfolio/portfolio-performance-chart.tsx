import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {
    ActivityIndicator,
    Animated,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';

import Svg, {
    Circle,
    Defs,
    Line,
    LinearGradient,
    Path,
    Stop,
} from 'react-native-svg';

import {
    useTerysoTheme,
} from '@/contexts/theme-context';

export type PortfolioChartPoint = {
  snapshot_at: string;

  total_value:
    | number
    | string
    | null;

  currency:
    | string
    | null;
};

type NormalizedPoint = {
  date: string;
  value: number;
};

type Coordinate = {
  x: number;
  y: number;
  value: number;
  date: string;
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

function formatMoney(
  value: number,
  currency: string,
) {
  try {
    return new Intl.NumberFormat(
      'fr-FR',
      {
        style:
          'currency',

        currency,

        notation:
          Math.abs(value) >=
          10_000
            ? 'compact'
            : 'standard',

        maximumFractionDigits:
          1,
      },
    ).format(value);
  } catch {
    return `${value.toLocaleString(
      'fr-FR',
      {
        maximumFractionDigits:
          1,
      },
    )} ${currency}`;
  }
}

function formatDate(
  value: string,
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

function buildSmoothPath(
  points: Coordinate[],
) {
  if (
    points.length ===
    0
  ) {
    return '';
  }

  if (
    points.length ===
    1
  ) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path =
    `M ${points[0].x} ${points[0].y}`;

  for (
    let index = 0;
    index <
    points.length - 1;
    index += 1
  ) {
    const p0 =
      points[
        Math.max(
          0,
          index - 1,
        )
      ];

    const p1 =
      points[index];

    const p2 =
      points[index + 1];

    const p3 =
      points[
        Math.min(
          points.length - 1,
          index + 2,
        )
      ];

    const cp1x =
      p1.x +
      (p2.x - p0.x) /
        6;

    const cp1y =
      p1.y +
      (p2.y - p0.y) /
        6;

    const cp2x =
      p2.x -
      (p3.x - p1.x) /
        6;

    const cp2y =
      p2.y -
      (p3.y - p1.y) /
        6;

    path +=
      ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return path;
}

/*
 * On limite volontairement
 * le nombre de points dessinés.
 *
 * 366 points SVG sur mobile
 * est inutile visuellement
 * et coûte plus cher à dessiner.
 */
function downsample(
  points:
    NormalizedPoint[],

  maxPoints =
    120,
) {
  if (
    points.length <=
    maxPoints
  ) {
    return points;
  }

  const result:
    NormalizedPoint[] =
    [];

  const step =
    (points.length - 1) /
    (maxPoints - 1);

  for (
    let index = 0;
    index <
    maxPoints;
    index += 1
  ) {
    const sourceIndex =
      Math.round(
        index * step,
      );

    const point =
      points[sourceIndex];

    if (
      point
    ) {
      result.push(
        point,
      );
    }
  }

  return result;
}

export function PortfolioPerformanceChart({
  points,
  currency,
  loading,
}: {
  points:
    PortfolioChartPoint[];

  currency:
    string;

  loading:
    boolean;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  const {
    width:
      windowWidth,
  } =
    useWindowDimensions();

  const [
    measuredWidth,
    setMeasuredWidth,
  ] =
    useState(0);

  const opacity =
    useRef(
      new Animated.Value(
        1,
      ),
    ).current;

  /*
   * Le graphique est dans :
   *
   * écran
   * - 40 px padding page
   * - ~30 px padding carte
   *
   * On garde cette largeur comme
   * fallback si onLayout ne fonctionne
   * pas immédiatement sur le Web.
   */
  const fallbackWidth =
    Math.max(
      windowWidth - 70,
      240,
    );

  const chartWidth =
    measuredWidth > 10
      ? measuredWidth
      : fallbackWidth;

  const chartHeight =
    190;

  const paddingLeft =
    5;

  const paddingRight =
    5;

  const paddingTop =
    17;

  const paddingBottom =
    16;

  useEffect(() => {
    opacity.setValue(
      0.55,
    );

    Animated.timing(
      opacity,
      {
        toValue: 1,

        duration: 220,

        useNativeDriver:
          true,
      },
    ).start();
  }, [
    points,
    opacity,
  ]);

  /*
   * Nettoyage des données.
   */
  const normalized =
    useMemo<
      NormalizedPoint[]
    >(
      () => {
        const valid:
          NormalizedPoint[] =
          [];

        for (
          const point
          of points
        ) {
          const value =
            toNumber(
              point.total_value,
            );

          const date =
            new Date(
              point.snapshot_at,
            );

          if (
            value ===
              null ||
            Number.isNaN(
              date.getTime(),
            )
          ) {
            continue;
          }

          valid.push({
            value,

            date:
              point.snapshot_at,
          });
        }

        valid.sort(
          (
            left,
            right,
          ) =>
            new Date(
              left.date,
            ).getTime() -
            new Date(
              right.date,
            ).getTime(),
        );

        return downsample(
          valid,
        );
      },
      [
        points,
      ],
    );

  const coordinates =
    useMemo<
      Coordinate[]
    >(
      () => {
        if (
          normalized.length ===
          0
        ) {
          return [];
        }

        const values =
          normalized.map(
            (point) =>
              point.value,
          );

        let min =
          Math.min(
            ...values,
          );

        let max =
          Math.max(
            ...values,
          );

        /*
         * Si toutes les valeurs
         * sont identiques.
         */
        if (
          min ===
          max
        ) {
          const margin =
            Math.max(
              Math.abs(min) *
                0.03,

              1,
            );

          min -= margin;

          max += margin;
        }

        /*
         * Petite marge pour
         * éviter que la courbe
         * touche les bords.
         */
        const verticalMargin =
          Math.max(
            (max - min) *
              0.1,

            1,
          );

        min -=
          verticalMargin;

        max +=
          verticalMargin;

        const span =
          Math.max(
            max - min,
            1,
          );

        const usableWidth =
          Math.max(
            chartWidth -
              paddingLeft -
              paddingRight,

            1,
          );

        const usableHeight =
          chartHeight -
          paddingTop -
          paddingBottom;

        return normalized.map(
          (
            point,
            index,
          ) => {
            const x =
              normalized.length ===
              1
                ? chartWidth /
                  2
                : paddingLeft +
                  (
                    index /
                    (
                      normalized.length -
                      1
                    )
                  ) *
                    usableWidth;

            const y =
              paddingTop +
              (
                (
                  max -
                  point.value
                ) /
                span
              ) *
                usableHeight;

            return {
              x,
              y,

              value:
                point.value,

              date:
                point.date,
            };
          },
        );
      },
      [
        normalized,
        chartWidth,
      ],
    );

  const first =
    coordinates[0];

  const last =
    coordinates[
      coordinates.length -
        1
    ];

  const linePath =
    useMemo(
      () =>
        buildSmoothPath(
          coordinates,
        ),
      [
        coordinates,
      ],
    );

  const areaPath =
    useMemo(
      () => {
        if (
          coordinates.length <
          2
        ) {
          return '';
        }

        const firstPoint =
          coordinates[0];

        const lastPoint =
          coordinates[
            coordinates.length -
              1
          ];

        if (
          !firstPoint ||
          !lastPoint
        ) {
          return '';
        }

        const baseY =
          chartHeight -
          paddingBottom;

        return (
          `${linePath} ` +
          `L ${lastPoint.x} ${baseY} ` +
          `L ${firstPoint.x} ${baseY} Z`
        );
      },
      [
        coordinates,
        linePath,
      ],
    );

  /*
   * Aucun point et requête
   * réellement encore en cours.
   */
  if (
    loading &&
    normalized.length ===
      0
  ) {
    return (
      <View
        style={
          styles.loading
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
            styles.loadingText,
            {
              color:
                colors.textMuted,
            },
          ]}
        >
          Chargement de la courbe…
        </Text>
      </View>
    );
  }

  /*
   * La requête est terminée
   * mais aucun historique.
   */
  if (
    normalized.length ===
    0
  ) {
    return (
      <View
        style={
          styles.empty
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
          <Text
            style={[
              styles.emptyIconText,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            ↗
          </Text>
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
          Pas encore d’historique
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
          L’évolution du portefeuille apparaîtra ici.
        </Text>
      </View>
    );
  }

  /*
   * Un seul point :
   * pas de courbe possible,
   * mais on affiche quand même
   * la valeur.
   */
  if (
    !first ||
    !last ||
    coordinates.length <
    2
  ) {
    return (
      <View
        style={
          styles.singlePoint
        }
      >
        <Text
          style={[
            styles.currentValue,
            {
              color:
                colors.text,
            },
          ]}
        >
          {formatMoney(
            normalized[0]
              ?.value ??
              0,

            currency,
          )}
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
          Pas encore assez de données pour tracer la courbe.
        </Text>
      </View>
    );
  }

  const positive =
    last.value >=
    first.value;

  const lineColor =
    positive
      ? colors.positive
      : colors.negative;

  const performance =
    first.value !==
    0
      ? (
          (
            last.value -
            first.value
          ) /
          Math.abs(
            first.value,
          )
        ) *
        100
      : null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
        },
      ]}
    >
      <View
        style={
          styles.summaryRow
        }
      >
        <View>
          <Text
            style={[
              styles.currentValue,
              {
                color:
                  colors.text,
              },
            ]}
          >
            {formatMoney(
              last.value,
              currency,
            )}
          </Text>

          {performance !==
          null ? (
            <View
              style={
                styles.performanceRow
              }
            >
              <Text
                style={[
                  styles.performance,
                  {
                    color:
                      positive
                        ? colors.positive
                        : colors.negative,
                  },
                ]}
              >
                {performance >=
                0
                  ? '+'
                  : ''}

                {performance.toLocaleString(
                  'fr-FR',
                  {
                    maximumFractionDigits:
                      2,
                  },
                )}
                %
              </Text>

              <Text
                style={[
                  styles.performanceLabel,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                sur la période
              </Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              colors.textMuted
            }
          />
        ) : null}
      </View>

      {/*
       * IMPORTANT :
       *
       * On mesure si possible,
       * MAIS on n'attend jamais
       * cette mesure pour afficher.
       */}
      <View
        onLayout={(
          event,
        ) => {
          const nextWidth =
            event
              .nativeEvent
              .layout
              .width;

          if (
            nextWidth >
              10 &&
            Math.abs(
              nextWidth -
                measuredWidth,
            ) >
              1
          ) {
            setMeasuredWidth(
              nextWidth,
            );
          }
        }}
        style={[
          styles.chart,
          {
            height:
              chartHeight,
          },
        ]}
      >
        <Svg
          width={
            chartWidth
          }
          height={
            chartHeight
          }
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          <Defs>
            <LinearGradient
              id="portfolioPerformanceGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <Stop
                offset="0"
                stopColor={
                  lineColor
                }
                stopOpacity={
                  0.22
                }
              />

              <Stop
                offset="0.5"
                stopColor={
                  lineColor
                }
                stopOpacity={
                  0.07
                }
              />

              <Stop
                offset="1"
                stopColor={
                  lineColor
                }
                stopOpacity={
                  0
                }
              />
            </LinearGradient>
          </Defs>

          {[
            0.25,
            0.5,
            0.75,
          ].map(
            (
              ratio,
            ) => (
              <Line
                key={
                  ratio
                }
                x1={0}
                x2={
                  chartWidth
                }
                y1={
                  chartHeight *
                  ratio
                }
                y2={
                  chartHeight *
                  ratio
                }
                stroke={
                  colors.border
                }
                strokeWidth={
                  1
                }
                opacity={
                  0.45
                }
              />
            ),
          )}

          {areaPath ? (
            <Path
              d={
                areaPath
              }
              fill="url(#portfolioPerformanceGradient)"
            />
          ) : null}

          <Path
            d={
              linePath
            }
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

          <Circle
            cx={
              first.x
            }
            cy={
              first.y
            }
            r={3}
            fill={
              colors.surface
            }
            stroke={
              lineColor
            }
            strokeWidth={
              2
            }
          />

          <Circle
            cx={
              last.x
            }
            cy={
              last.y
            }
            r={4.5}
            fill={
              colors.surface
            }
            stroke={
              lineColor
            }
            strokeWidth={
              2.5
            }
          />
        </Svg>
      </View>

      <View
        style={
          styles.dates
        }
      >
        <Text
          style={[
            styles.date,
            {
              color:
                colors.textMuted,
            },
          ]}
        >
          {formatDate(
            first.date,
          )}
        </Text>

        <Text
          style={[
            styles.date,
            {
              color:
                colors.textMuted,
            },
          ]}
        >
          {formatDate(
            last.date,
          )}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      width:
        '100%',
    },

    summaryRow: {
      alignItems:
        'flex-start',

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      minHeight:
        41,

      paddingTop:
        2,
    },

    currentValue: {
      fontSize:
        13,

      fontWeight:
        '900',
    },

    performanceRow: {
      alignItems:
        'center',

      flexDirection:
        'row',

      gap:
        5,

      marginTop:
        3,
    },

    performance: {
      fontSize:
        9,

      fontWeight:
        '900',
    },

    performanceLabel: {
      fontSize:
        8.5,
    },

    chart: {
      overflow:
        'hidden',

      width:
        '100%',
    },

    dates: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      marginTop:
        2,
    },

    date: {
      fontSize:
        8.5,

      fontWeight:
        '700',
    },

    loading: {
      alignItems:
        'center',

      height:
        230,

      justifyContent:
        'center',
    },

    loadingText: {
      fontSize:
        9.5,

      marginTop:
        9,
    },

    empty: {
      alignItems:
        'center',

      height:
        230,

      justifyContent:
        'center',

      paddingHorizontal:
        24,
    },

    emptyIcon: {
      alignItems:
        'center',

      borderRadius:
        999,

      height:
        38,

      justifyContent:
        'center',

      marginBottom:
        10,

      width:
        38,
    },

    emptyIconText: {
      fontSize:
        18,

      fontWeight:
        '900',
    },

    emptyTitle: {
      fontSize:
        13,

      fontWeight:
        '900',
    },

    emptyText: {
      fontSize:
        9.5,

      lineHeight:
        15,

      marginTop:
        5,

      maxWidth:
        250,

      textAlign:
        'center',
    },

    singlePoint: {
      alignItems:
        'center',

      height:
        230,

      justifyContent:
        'center',
    },
  });