import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ThemeColors } from '@/constants/theme';
import { useTerysoTheme } from '@/contexts/theme-context';
import {
  getPortfolioSnapshot,
  getPublicPortfolioBySlug,
  type PortfolioSnapshot,
  type PublicPortfolio,
} from '@/lib/teryso';

export default function PortfolioDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTerysoTheme();
  const requestIdRef = useRef(0);

  const [portfolio, setPortfolio] = useState<PublicPortfolio | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!slug) {
        setLoading(false);
        setPortfolio(null);
        setSnapshot(null);
        setPortfolioError('Adresse de portefeuille invalide.');
        return;
      }

      const requestId = ++requestIdRef.current;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setPortfolioError(null);
      setSnapshotError(null);

      try {
        const nextPortfolio = await getPublicPortfolioBySlug(slug);

        if (requestId !== requestIdRef.current) return;

        setPortfolio(nextPortfolio);

        if (!nextPortfolio) {
          setSnapshot(null);
          return;
        }

        try {
          const nextSnapshot = await getPortfolioSnapshot(nextPortfolio.id);

          if (requestId !== requestIdRef.current) return;

          setSnapshot(nextSnapshot);
        } catch (error) {
          if (requestId !== requestIdRef.current) return;

          console.error('[PortfolioDetail] snapshot', error);
          setSnapshot(null);
          setSnapshotError(
            'Les positions et métriques ne peuvent pas être chargées pour le moment.',
          );
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) return;

        console.error('[PortfolioDetail] portfolio', error);
        setPortfolio(null);
        setSnapshot(null);
        setPortfolioError(
          'Ce portefeuille ne peut pas être chargé pour le moment.',
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [slug],
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);

      return () => {
        requestIdRef.current += 1;
      };
    }, [load]),
  );

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor: colors.page,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          {
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          accessibilityLabel="Retour"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={[
            styles.iconButton,
            {
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={colors.text}
          />
        </Pressable>

        <Text
          style={[
            styles.headerBrand,
            {
              color: colors.text,
            },
          ]}
        >
          Teryso
        </Text>

        <View style={styles.iconButtonPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : portfolioError || !portfolio ? (
        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={28}
            color={colors.text}
          />

          <Text
            style={[
              styles.errorTitle,
              {
                color: colors.text,
              },
            ]}
          >
            Portefeuille indisponible
          </Text>

          <Text
            style={[
              styles.centerText,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            {portfolioError ?? 'Ce portefeuille n’est plus public.'}
          </Text>

          <RetryButton
            colors={colors}
            onPress={() => void load(false)}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={colors.text}
            />
          }
        >
          <View style={styles.ownerRow}>
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: colors.surfaceStrong,
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {(portfolio.owner?.displayName || 'T')
                  .slice(0, 1)
                  .toUpperCase()}
              </Text>
            </View>

            <View>
              <Text
                style={[
                  styles.ownerName,
                  {
                    color: colors.text,
                  },
                ]}
              >
                {portfolio.owner?.displayName || 'Teryso'}
              </Text>

              <Text
                style={[
                  styles.ownerUsername,
                  {
                    color: colors.textMuted,
                  },
                ]}
              >
                @{portfolio.owner?.username ?? 'teryso'}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.title,
              {
                color: colors.text,
              },
            ]}
          >
            {portfolio.name}
          </Text>

          <Text
            style={[
              styles.description,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            {portfolio.description || 'Un portefeuille public Teryso.'}
          </Text>

          <View style={styles.pills}>
            {[
              portfolio.baseCurrency,
              portfolio.governanceMode === 'assembly'
                ? 'Assemblée'
                : 'Piloté',
              'Compte unique',
            ].map((label) => (
              <View
                key={label}
                style={[
                  styles.pill,
                  {
                    backgroundColor: colors.surfaceStrong,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    {
                      color: colors.textSecondary,
                    },
                  ]}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.statement}>
            <Text style={styles.statementEyebrow}>
              Principe Teryso
            </Text>

            <Text style={styles.statementText}>
              Une stratégie publique, un portefeuille, un seul compte.
            </Text>
          </View>

          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.text,
              },
            ]}
          >
            Vue d’ensemble
          </Text>

          {snapshotError ? (
            <View
              style={[
                styles.errorCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="warning-outline"
                size={24}
                color={colors.text}
              />

              <Text
                style={[
                  styles.errorCardTitle,
                  {
                    color: colors.text,
                  },
                ]}
              >
                Données temporairement indisponibles
              </Text>

              <Text
                style={[
                  styles.centerText,
                  {
                    color: colors.textSecondary,
                  },
                ]}
              >
                {snapshotError}
              </Text>

              <RetryButton
                colors={colors}
                onPress={() => void load(true)}
                compact
              />
            </View>
          ) : snapshot ? (
            <>
              <View style={styles.metricsGrid}>
                <MetricCard
                  colors={colors}
                  label="Performance"
                  value={formatPerformance(snapshot.performance)}
                />

                <MetricCard
                  colors={colors}
                  label="Actifs"
                  value={snapshot.assetsCount?.toString() ?? '—'}
                />
              </View>

              {snapshot.holdings.length > 0 ? (
                <View
                  style={[
                    styles.holdingsCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {snapshot.holdings
                    .slice(0, 8)
                    .map((holding, index) => (
                      <View
                        key={
                          holding.portfolioAssetId ??
                          `${holding.symbol}-${index}`
                        }
                        style={[
                          styles.holdingRow,
                          index > 0 && {
                            borderTopColor: colors.border,
                            borderTopWidth: 1,
                          },
                        ]}
                      >
                        <View style={styles.holdingCopy}>
                          <Text
                            style={[
                              styles.holdingSymbol,
                              {
                                color: colors.text,
                              },
                            ]}
                          >
                            {holding.symbol}
                          </Text>

                          <Text
                            numberOfLines={1}
                            style={[
                              styles.holdingName,
                              {
                                color: colors.textMuted,
                              },
                            ]}
                          >
                            {holding.name}
                          </Text>

                          <Text
                            style={[
                              styles.holdingQuantity,
                              {
                                color: colors.textSecondary,
                              },
                            ]}
                          >
                            {formatQuantity(holding.quantity)}{' '}
                            {holding.symbol}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.holdingPercent,
                            {
                              color: colors.text,
                            },
                          ]}
                        >
                          {formatAllocation(
                            holding.allocationPercent,
                          )}
                        </Text>
                      </View>
                    ))}
                </View>
              ) : (
                <View
                  style={[
                    styles.emptyCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.emptyCardTitle,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    Aucune position
                  </Text>

                  <Text
                    style={[
                      styles.centerText,
                      {
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    Ce portefeuille ne contient actuellement aucun actif.
                  </Text>
                </View>
              )}
            </>
          ) : null}

          <Text
            style={[
              styles.risk,
              {
                color: colors.textMuted,
              },
            ]}
          >
            Teryso ne fournit aucun conseil financier. Investir comporte un
            risque de perte en capital.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function MetricCard({
  colors,
  label,
  value,
}: {
  colors: ThemeColors;
  label: string;
  value: string;
}) {
  return (
    <View
      style={[
        styles.metricCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.metricLabel,
          {
            color: colors.textMuted,
          },
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.metricValue,
          {
            color: colors.text,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function RetryButton({
  colors,
  onPress,
  compact = false,
}: {
  colors: ThemeColors;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.retryButton,
        compact && styles.retryButtonCompact,
        {
          borderColor: colors.borderStrong,
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <Ionicons
        name="refresh-outline"
        size={17}
        color={colors.text}
      />

      <Text
        style={[
          styles.retryButtonText,
          {
            color: colors.text,
          },
        ]}
      >
        Réessayer
      </Text>
    </Pressable>
  );
}

function formatPerformance(value: number | null) {
  if (value === null) return '—';

  return `${value >= 0 ? '+' : ''}${value.toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
  })} %`;
}

function formatAllocation(value: number | null) {
  if (value === null) return '—';

  return `${value.toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
  })} %`;
}

function formatQuantity(value: number) {
  return value.toLocaleString('fr-FR', {
    maximumFractionDigits: 8,
    useGrouping: true,
  });
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  iconButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },

  iconButtonPlaceholder: {
    width: 42,
  },

  headerBrand: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.8,
  },

  center: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    padding: 28,
  },

  centerText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: '900',
  },

  content: {
    paddingBottom: 38,
    paddingHorizontal: 18,
    paddingTop: 24,
  },

  ownerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },

  avatar: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },

  avatarText: {
    fontSize: 14,
    fontWeight: '900',
  },

  ownerName: {
    fontSize: 13,
    fontWeight: '900',
  },

  ownerUsername: {
    fontSize: 11,
    marginTop: 2,
  },

  title: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.8,
    lineHeight: 42,
    marginTop: 24,
  },

  description: {
    fontSize: 15,
    lineHeight: 23,
    marginTop: 14,
  },

  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
  },

  pill: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  pillText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  statement: {
    backgroundColor: '#000000',
    borderRadius: 22,
    marginTop: 28,
    padding: 22,
  },

  statementEyebrow: {
    color: '#8D8D8D',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  statementText: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: 27,
    marginTop: 10,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 13,
    marginTop: 30,
  },

  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
  },

  metricCard: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    padding: 17,
  },

  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  metricValue: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 8,
  },

  holdingsCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
  },

  holdingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 17,
    paddingVertical: 14,
  },

  holdingCopy: {
    flex: 1,
    paddingRight: 12,
  },

  holdingSymbol: {
    fontSize: 13,
    fontWeight: '900',
  },

  holdingName: {
    fontSize: 11,
    marginTop: 3,
  },

  holdingQuantity: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },

  holdingPercent: {
    fontSize: 13,
    fontWeight: '900',
  },

  errorCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    gap: 9,
    padding: 22,
  },

  errorCardTitle: {
    fontSize: 15,
    fontWeight: '900',
  },

  emptyCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    gap: 7,
    marginTop: 12,
    padding: 22,
  },

  emptyCardTitle: {
    fontSize: 15,
    fontWeight: '900',
  },

  retryButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 46,
    paddingHorizontal: 18,
  },

  retryButtonCompact: {
    minHeight: 42,
  },

  retryButtonText: {
    fontSize: 12,
    fontWeight: '900',
  },

  risk: {
    fontSize: 10,
    lineHeight: 16,
    marginTop: 28,
    textAlign: 'center',
  },
});