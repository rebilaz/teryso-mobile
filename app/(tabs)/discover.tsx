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
    RefreshControl,
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
    PortfolioCard,
} from '@/components/teryso/portfolio-card';
import {
    useTerysoTheme,
} from '@/contexts/theme-context';
import {
    getPublicPortfolios,
    type PublicPortfolio,
} from '@/lib/teryso';

export default function DiscoverScreen() {
  const router =
    useRouter();

  const {
    colors,
  } = useTerysoTheme();

  const [
    portfolios,
    setPortfolios,
  ] =
    useState<PublicPortfolio[]>(
      [],
    );

  const [
    query,
    setQuery,
  ] = useState('');

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const loadPortfolios =
    useCallback(
      async (
        isRefresh = false,
      ) => {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        try {
          setPortfolios(
            await getPublicPortfolios(),
          );
        } catch (loadError) {
          console.error(
            loadError,
          );

          setError(
            'Impossible de charger les portefeuilles pour le moment.',
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadPortfolios();
  }, [loadPortfolios]);

  const filteredPortfolios =
    useMemo(() => {
      const normalizedQuery =
        query
          .trim()
          .toLocaleLowerCase(
            'fr',
          );

      if (!normalizedQuery) {
        return portfolios;
      }

      return portfolios.filter(
        (portfolio) =>
          [
            portfolio.name,
            portfolio.description,
            portfolio.owner
              ?.displayName,
            portfolio.owner
              ?.username,
          ]
            .filter(Boolean)
            .some((value) =>
              value
                ?.toLocaleLowerCase(
                  'fr',
                )
                .includes(
                  normalizedQuery,
                ),
            ),
      );
    }, [portfolios, query]);

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
      <FlatList
        data={
          filteredPortfolios
        }
        keyExtractor={(
          item,
        ) => item.id}
        keyboardShouldPersistTaps="handled"
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
                size={20}
                color={
                  colors.textMuted
                }
              />

              <TextInput
                accessibilityLabel="Rechercher sur Teryso"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={
                  setQuery
                }
                placeholder="Utilisateur, portefeuille..."
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
                value={query}
              />
            </View>

            <View
              style={
                styles.hero
              }
            >
              <Text
                style={
                  styles.heroEyebrow
                }
              >
                TERYso
              </Text>

              <Text
                style={
                  styles.heroTitle
                }
              >
                Découvrez les
                convictions des
                investisseurs.
              </Text>

              <Text
                style={
                  styles.heroText
                }
              >
                Parcourez des
                portefeuilles
                publics, leurs
                stratégies et leurs
                créateurs.
              </Text>
            </View>

            <View
              style={
                styles.sectionTitleRow
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
                Portefeuilles
              </Text>

              <Text
                style={[
                  styles.count,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                {
                  filteredPortfolios.length
                }
              </Text>
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
                  Chargement…
                </Text>
              </View>
            ) : null}

            {error ? (
              <Text
                style={[
                  styles.error,
                  {
                    color:
                      colors.negative,
                  },
                ]}
              >
                {error}
              </Text>
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
                  borderColor:
                    colors.border,
                },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={26}
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
                Essayez un nom ou
                un portefeuille
                différent.
              </Text>
            </View>
          ) : null
        }
        renderItem={({
          item,
        }) => (
          <PortfolioCard
            portfolio={item}
            onPress={() =>
              router.push({
                pathname:
                  '/portfolio/[slug]',

                params: {
                  slug:
                    item.slug,
                },
              })
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },

    content: {
      paddingBottom: 30,
      paddingHorizontal: 18,
      paddingTop: 14,
    },

    separator: {
      height: 12,
    },

    search: {
      alignItems: 'center',
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      marginTop: 24,
      paddingHorizontal: 15,
    },

    searchInput: {
      flex: 1,
      fontSize: 14,
      height: 52,
    },

    hero: {
      backgroundColor:
        '#000000',
      borderRadius: 26,
      marginTop: 16,
      padding: 24,
    },

    heroEyebrow: {
      color: '#A3A3A3',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.5,
    },

    heroTitle: {
      color: '#FFFFFF',
      fontSize: 27,
      fontWeight: '900',
      letterSpacing: -1.1,
      lineHeight: 32,
      marginTop: 11,
    },

    heroText: {
      color: '#BBBBBB',
      fontSize: 13,
      lineHeight: 20,
      marginTop: 11,
    },

    sectionTitleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent:
        'space-between',
      marginBottom: 14,
      marginTop: 30,
    },

    sectionTitle: {
      fontSize: 21,
      fontWeight: '900',
      letterSpacing: -0.5,
    },

    count: {
      fontSize: 12,
      fontWeight: '800',
    },

    stateBox: {
      alignItems: 'center',
      gap: 12,
      paddingVertical: 30,
    },

    stateText: {
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
    },

    error: {
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 16,
      textAlign: 'center',
    },

    empty: {
      alignItems: 'center',
      borderRadius: 22,
      borderStyle: 'dashed',
      borderWidth: 1,
      gap: 8,
      padding: 28,
    },

    emptyTitle: {
      fontSize: 16,
      fontWeight: '900',
    },
  });