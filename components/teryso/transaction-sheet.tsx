import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import {
    useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
    useAuth,
} from '@/contexts/auth-context';
import {
    useTerysoTheme,
} from '@/contexts/theme-context';
import {
    supabase,
} from '@/lib/supabase';

type OperationType =
  | 'buy'
  | 'sell'
  | 'deposit'
  | 'withdrawal';

type AssetType =
  | 'crypto'
  | 'stock'
  | 'etf'
  | 'index';

type IconName =
  ComponentProps<typeof Ionicons>['name'];

type Portfolio = {
  id: string;
  name: string;
  base_currency: string;
};

type AssetSearchResult = {
  id: string | null;
  source?: string | null;

  asset_type: AssetType;

  symbol: string;
  name: string;

  image_url: string | null;
  exchange: string | null;

  currency: string | null;

  price:
    | number
    | string
    | null;

  price_currency:
    | string
    | null;

  yahoo_symbol:
    | string
    | null;

  coingecko_id:
    | string
    | null;

  market_cap_rank:
    | number
    | null;
};

type Holding = {
  holding_id: string;
  asset_id: string;

  quantity:
    | number
    | string
    | null;

  average_buy_price:
    | number
    | string
    | null;

  currency:
    | string
    | null;

  asset_type: AssetType;

  symbol: string;
  name: string;

  image_url:
    | string
    | null;

  exchange:
    | string
    | null;

  current_price:
    | number
    | string
    | null;
};

type TransactionSheetProps = {
  visible: boolean;

  onClose: () => void;

  onCreated: (
    portfolioId: string,
  ) => void;
};

const OPERATIONS: {
  type: OperationType;
  title: string;
  subtitle: string;
  icon: IconName;
}[] = [
  {
    type: 'buy',
    title: 'Acheter',
    subtitle:
      'Ajouter un actif',
    icon:
      'arrow-down-outline',
  },
  {
    type: 'sell',
    title: 'Vendre',
    subtitle:
      'Vendre un actif détenu',
    icon:
      'arrow-up-outline',
  },
  {
    type: 'deposit',
    title: 'Déposer',
    subtitle:
      'Ajouter des espèces',
    icon:
      'add-outline',
  },
  {
    type: 'withdrawal',
    title: 'Retirer',
    subtitle:
      'Retirer des espèces',
    icon:
      'remove-outline',
  },
];

function parseNumber(
  value: string,
) {
  return Number(
    value
      .trim()
      .replace(',', '.'),
  );
}

function validPositive(
  value: number,
) {
  return (
    Number.isFinite(value) &&
    value > 0
  );
}

function validNonNegative(
  value: number,
) {
  return (
    Number.isFinite(value) &&
    value >= 0
  );
}

function formatNumber(
  value: unknown,
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return '—';
  }

  return number.toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits: 6,
    },
  );
}

function normalizeAsset(
  value: unknown,
): AssetSearchResult | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null;
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  const symbol =
    String(
      row.symbol ?? '',
    ).trim();

  const name =
    String(
      row.name ?? symbol,
    ).trim();

  const rawType =
    String(
      row.asset_type ??
        'stock',
    ).toLowerCase();

  if (
    !symbol ||
    !name
  ) {
    return null;
  }

  const assetType: AssetType =
    [
      'crypto',
      'stock',
      'etf',
      'index',
    ].includes(rawType)
      ? (rawType as AssetType)
      : 'stock';

  return {
    id:
      row.id === null ||
      row.id === undefined
        ? null
        : String(row.id),

    source:
      typeof row.source ===
      'string'
        ? row.source
        : null,

    asset_type:
      assetType,

    symbol,
    name,

    image_url:
      typeof row.image_url ===
      'string'
        ? row.image_url
        : null,

    exchange:
      typeof row.exchange ===
      'string'
        ? row.exchange
        : null,

    currency:
      typeof row.currency ===
      'string'
        ? row.currency
        : null,

    price:
      typeof row.price ===
        'number' ||
      typeof row.price ===
        'string'
        ? row.price
        : null,

    price_currency:
      typeof row.price_currency ===
      'string'
        ? row.price_currency
        : null,

    yahoo_symbol:
      typeof row.yahoo_symbol ===
      'string'
        ? row.yahoo_symbol
        : null,

    coingecko_id:
      typeof row.coingecko_id ===
      'string'
        ? row.coingecko_id
        : null,

    market_cap_rank:
      typeof row.market_cap_rank ===
      'number'
        ? row.market_cap_rank
        : null,
  };
}

async function readFunctionError(
  error: unknown,
) {
  const source =
    error as {
      message?: string;
      context?: Response;
    };

  try {
    if (
      source.context
    ) {
      const payload =
        await source.context
          .clone()
          .json();

      if (
        payload?.details
      ) {
        return String(
          payload.details,
        );
      }

      if (
        payload?.message
      ) {
        return String(
          payload.message,
        );
      }

      if (
        payload?.error
      ) {
        return String(
          payload.error,
        );
      }
    }
  } catch {
    //
  }

  return (
    source.message ??
    'Une erreur est survenue.'
  );
}

async function invokeFunction(
  name: string,

  body: Record<
    string,
    unknown
  >,
) {
  const {
    data,
    error,
  } =
    await supabase
      .functions
      .invoke(
        name,
        {
          body,
        },
      );

  if (error) {
    throw new Error(
      await readFunctionError(
        error,
      ),
    );
  }

  if (
    data?.error
  ) {
    throw new Error(
      String(
        data.details ??
          data.message ??
          data.error,
      ),
    );
  }

  return data;
}

export function TransactionSheet({
  visible,
  onClose,
  onCreated,
}: TransactionSheetProps) {
  const {
    session,
  } = useAuth();

  const {
    colors,
  } = useTerysoTheme();

  const insets =
    useSafeAreaInsets();

  const translateY =
    useRef(
      new Animated.Value(
        700,
      ),
    ).current;

  const overlayOpacity =
    useRef(
      new Animated.Value(
        0,
      ),
    ).current;

  const [
    operation,
    setOperation,
  ] =
    useState<
      OperationType | null
    >(null);

  const [
    portfolioMenuOpen,
    setPortfolioMenuOpen,
  ] = useState(false);

  const [
    portfolios,
    setPortfolios,
  ] =
    useState<Portfolio[]>(
      [],
    );

  const [
    selectedPortfolioId,
    setSelectedPortfolioId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    loadingPortfolios,
    setLoadingPortfolios,
  ] = useState(false);

  const [
    holdings,
    setHoldings,
  ] =
    useState<Holding[]>(
      [],
    );

  const [
    holdingsLoading,
    setHoldingsLoading,
  ] = useState(false);

  const [
    selectedHoldingId,
    setSelectedHoldingId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    assetQuery,
    setAssetQuery,
  ] = useState('');

  const [
    assetResults,
    setAssetResults,
  ] =
    useState<
      AssetSearchResult[]
    >([]);

  const [
    selectedAsset,
    setSelectedAsset,
  ] =
    useState<
      AssetSearchResult | null
    >(null);

  const [
    assetSearchLoading,
    setAssetSearchLoading,
  ] = useState(false);

  const [
    quantity,
    setQuantity,
  ] = useState('');

  const [
    price,
    setPrice,
  ] = useState('');

  const [
    amount,
    setAmount,
  ] = useState('');

  const [
    fees,
    setFees,
  ] = useState('0');

  const [
    currency,
    setCurrency,
  ] = useState('EUR');

  const [
    note,
    setNote,
  ] = useState('');

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

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

  const selectedHolding =
    useMemo(
      () =>
        holdings.find(
          (holding) =>
            holding.asset_id ===
            selectedHoldingId,
        ) ?? null,
      [
        holdings,
        selectedHoldingId,
      ],
    );

  const resetForm =
    useCallback(() => {
      setOperation(null);

      setPortfolioMenuOpen(
        false,
      );

      setHoldings([]);

      setSelectedHoldingId(
        null,
      );

      setAssetQuery('');

      setAssetResults([]);

      setSelectedAsset(
        null,
      );

      setQuantity('');

      setPrice('');

      setAmount('');

      setFees('0');

      setNote('');

      setError(null);
    }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    translateY.setValue(
      700,
    );

    overlayOpacity.setValue(
      0,
    );

    Animated.parallel([
      Animated.spring(
        translateY,
        {
          toValue: 0,
          damping: 24,
          stiffness: 220,
          mass: 0.9,

          useNativeDriver:
            true,
        },
      ),

      Animated.timing(
        overlayOpacity,
        {
          toValue: 1,
          duration: 180,

          useNativeDriver:
            true,
        },
      ),
    ]).start();
  }, [
    visible,
    translateY,
    overlayOpacity,
  ]);

  const closeSheet =
    useCallback(
      (
        afterClose?: () => void,
      ) => {
        if (
          submitting
        ) {
          return;
        }

        Animated.parallel([
          Animated.timing(
            translateY,
            {
              toValue: 700,
              duration: 220,

              useNativeDriver:
                true,
            },
          ),

          Animated.timing(
            overlayOpacity,
            {
              toValue: 0,
              duration: 180,

              useNativeDriver:
                true,
            },
          ),
        ]).start(() => {
          resetForm();

          onClose();

          afterClose?.();
        });
      },
      [
        onClose,
        overlayOpacity,
        resetForm,
        submitting,
        translateY,
      ],
    );

  const loadPortfolios =
    useCallback(
      async () => {
        const userId =
          session?.user.id;

        if (!userId) {
          return;
        }

        setLoadingPortfolios(
          true,
        );

        setError(null);

        try {
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
                'id,name,base_currency',
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
            (current) =>
              current &&
              rows.some(
                (portfolio) =>
                  portfolio.id ===
                  current,
              )
                ? current
                : rows[0]?.id ??
                  null,
          );
        } catch (
          loadError
        ) {
          setError(
            loadError instanceof
            Error
              ? loadError.message
              : 'Impossible de charger les portefeuilles.',
          );
        } finally {
          setLoadingPortfolios(
            false,
          );
        }
      },
      [
        session?.user.id,
      ],
    );

  useEffect(() => {
    if (visible) {
      void loadPortfolios();
    }
  }, [
    visible,
    loadPortfolios,
  ]);

  useEffect(() => {
    if (
      selectedPortfolio
    ) {
      setCurrency(
        selectedPortfolio
          .base_currency ||
          'EUR',
      );
    }
  }, [
    selectedPortfolio,
  ]);

  const loadHoldings =
    useCallback(
      async () => {
        if (
          !selectedPortfolioId
        ) {
          return;
        }

        setHoldingsLoading(
          true,
        );

        setError(null);

        try {
          const {
            data,
            error:
              holdingsError,
          } =
            await supabase.rpc(
              'get_private_portfolio_positions',
              {
                p_portfolio_id:
                  selectedPortfolioId,
              },
            );

          if (
            holdingsError
          ) {
            throw holdingsError;
          }

          const rows =
            Array.isArray(
              data,
            )
              ? (data as Holding[])
              : [];

          setHoldings(
            rows.filter(
              (holding) =>
                Number(
                  holding.quantity,
                ) > 0,
            ),
          );
        } catch (
          loadError
        ) {
          setError(
            loadError instanceof
            Error
              ? loadError.message
              : 'Impossible de charger les positions.',
          );
        } finally {
          setHoldingsLoading(
            false,
          );
        }
      },
      [
        selectedPortfolioId,
      ],
    );

  useEffect(() => {
    if (
      visible &&
      operation ===
        'sell' &&
      selectedPortfolioId
    ) {
      setSelectedHoldingId(
        null,
      );

      void loadHoldings();
    }
  }, [
    visible,
    operation,
    selectedPortfolioId,
    loadHoldings,
  ]);

  useEffect(() => {
    if (
      operation !==
        'buy' ||
      selectedAsset ||
      assetQuery.trim()
        .length < 2
    ) {
      setAssetResults(
        [],
      );

      return;
    }

    let cancelled =
      false;

    const timer =
      setTimeout(
        async () => {
          try {
            setAssetSearchLoading(
              true,
            );

            setError(null);

            const data =
              await invokeFunction(
                'search-assets',
                {
                  q:
                    assetQuery.trim(),

                  asset_types: [
                    'crypto',
                    'stock',
                    'etf',
                    'index',
                  ],

                  limit: 8,

                  include_prices:
                    true,
                },
              );

            const raw:
              unknown[] =
                Array.isArray(
                  data,
                )
                  ? data
                  : Array.isArray(
                        data?.results,
                      )
                    ? data.results
                    : Array.isArray(
                          data?.assets,
                        )
                      ? data.assets
                      : [];

            const normalized =
              raw
                .map(
                  normalizeAsset,
                )
                .filter(
                  (
                    asset,
                  ): asset is AssetSearchResult =>
                    asset !==
                    null,
                );

            if (
              !cancelled
            ) {
              setAssetResults(
                normalized,
              );
            }
          } catch (
            searchError
          ) {
            if (
              !cancelled
            ) {
              setError(
                searchError instanceof
                Error
                  ? searchError.message
                  : 'Recherche impossible.',
              );
            }
          } finally {
            if (
              !cancelled
            ) {
              setAssetSearchLoading(
                false,
              );
            }
          }
        },
        350,
      );

    return () => {
      cancelled = true;

      clearTimeout(
        timer,
      );
    };
  }, [
    assetQuery,
    operation,
    selectedAsset,
  ]);

  function selectPortfolio(
    portfolio: Portfolio,
  ) {
    setSelectedPortfolioId(
      portfolio.id,
    );

    setPortfolioMenuOpen(
      false,
    );

    setSelectedHoldingId(
      null,
    );

    setSelectedAsset(
      null,
    );

    setAssetQuery('');

    setQuantity('');

    setPrice('');

    setCurrency(
      portfolio.base_currency ||
        'EUR',
    );
  }

  function selectOperation(
    next: OperationType,
  ) {
    setOperation(next);

    setPortfolioMenuOpen(
      false,
    );

    setError(null);

    setQuantity('');
    setPrice('');
    setAmount('');
    setFees('0');
    setNote('');

    setSelectedAsset(
      null,
    );

    setAssetQuery('');

    setAssetResults([]);

    setSelectedHoldingId(
      null,
    );
  }

  function chooseAsset(
    asset: AssetSearchResult,
  ) {
    setSelectedAsset(
      asset,
    );

    setAssetQuery(
      `${asset.name} (${asset.symbol})`,
    );

    setAssetResults(
      [],
    );

    const nextPrice =
      Number(
        asset.price,
      );

    if (
      Number.isFinite(
        nextPrice,
      ) &&
      nextPrice > 0
    ) {
      setPrice(
        String(
          nextPrice,
        ),
      );
    }

    const nextCurrency =
      asset.price_currency ||
      asset.currency;

    if (
      nextCurrency
    ) {
      setCurrency(
        nextCurrency.toUpperCase(),
      );
    }
  }

  function chooseHolding(
    holding: Holding,
  ) {
    setSelectedHoldingId(
      holding.asset_id,
    );

    setQuantity('');

    const marketPrice =
      Number(
        holding.current_price,
      );

    if (
      Number.isFinite(
        marketPrice,
      ) &&
      marketPrice > 0
    ) {
      setPrice(
        String(
          marketPrice,
        ),
      );
    } else {
      setPrice('');
    }

    setCurrency(
      holding.currency ||
        selectedPortfolio
          ?.base_currency ||
        'EUR',
    );
  }

  async function submit() {
    if (
      !operation ||
      !selectedPortfolioId ||
      submitting
    ) {
      return;
    }

    setError(null);

    try {
      setSubmitting(true);

      const normalizedCurrency =
        currency
          .trim()
          .toUpperCase() ||
        'EUR';

      const operationDate =
        new Date()
          .toISOString();

      if (
        operation ===
          'buy' ||
        operation ===
          'sell'
      ) {
        const parsedQuantity =
          parseNumber(
            quantity,
          );

        const parsedPrice =
          parseNumber(
            price,
          );

        const parsedFees =
          parseNumber(
            fees || '0',
          );

        if (
          !validPositive(
            parsedQuantity,
          )
        ) {
          throw new Error(
            'La quantité doit être supérieure à 0.',
          );
        }

        if (
          !validPositive(
            parsedPrice,
          )
        ) {
          throw new Error(
            'Le prix doit être supérieur à 0.',
          );
        }

        if (
          !validNonNegative(
            parsedFees,
          )
        ) {
          throw new Error(
            'Les frais sont invalides.',
          );
        }

        if (
          operation ===
          'buy'
        ) {
          if (
            !selectedAsset
          ) {
            throw new Error(
              'Sélectionne un actif.',
            );
          }

          await invokeFunction(
            'add-transaction',
            {
              portfolio_id:
                selectedPortfolioId,

              transaction_type:
                'buy',

              asset_id:
                selectedAsset.id,

              asset_type:
                selectedAsset.asset_type,

              symbol:
                selectedAsset.symbol,

              name:
                selectedAsset.name,

              exchange:
                selectedAsset.exchange,

              yahoo_symbol:
                selectedAsset.yahoo_symbol,

              coingecko_id:
                selectedAsset.coingecko_id,

              image_url:
                selectedAsset.image_url,

              market_cap_rank:
                selectedAsset.market_cap_rank,

              quantity:
                parsedQuantity,

              price:
                parsedPrice,

              fees:
                parsedFees,

              fee_asset_id:
                null,

              fee_asset_is_traded_asset:
                false,

              fee_quantity:
                0,

              currency:
                normalizedCurrency,

              cash_currency:
                normalizedCurrency,

              transaction_date:
                operationDate,

              source_provider:
                selectedAsset.source ??
                null,

              note:
                note.trim() ||
                null,
            },
          );
        }

        if (
          operation ===
          'sell'
        ) {
          if (
            !selectedHolding
          ) {
            throw new Error(
              'Sélectionne un actif détenu.',
            );
          }

          const available =
            Number(
              selectedHolding.quantity,
            );

          if (
            Number.isFinite(
              available,
            ) &&
            parsedQuantity >
              available
          ) {
            throw new Error(
              `Tu détiens seulement ${formatNumber(
                available,
              )} ${selectedHolding.symbol}.`,
            );
          }

          await invokeFunction(
            'add-transaction',
            {
              portfolio_id:
                selectedPortfolioId,

              transaction_type:
                'sell',

              asset_id:
                selectedHolding.asset_id,

              asset_type:
                selectedHolding.asset_type,

              symbol:
                selectedHolding.symbol,

              name:
                selectedHolding.name,

              exchange:
                selectedHolding.exchange,

              quantity:
                parsedQuantity,

              price:
                parsedPrice,

              fees:
                parsedFees,

              fee_asset_id:
                null,

              fee_asset_is_traded_asset:
                false,

              fee_quantity:
                0,

              currency:
                normalizedCurrency,

              cash_currency:
                normalizedCurrency,

              transaction_date:
                operationDate,

              note:
                note.trim() ||
                null,
            },
          );
        }
      } else {
        const parsedAmount =
          parseNumber(
            amount,
          );

        const parsedFees =
          parseNumber(
            fees || '0',
          );

        if (
          !validPositive(
            parsedAmount,
          )
        ) {
          throw new Error(
            'Le montant doit être supérieur à 0.',
          );
        }

        if (
          !validNonNegative(
            parsedFees,
          )
        ) {
          throw new Error(
            'Les frais sont invalides.',
          );
        }

        await invokeFunction(
          'add-cash',
          {
            portfolio_id:
              selectedPortfolioId,

            movement_type:
              operation,

            amount:
              parsedAmount,

            fees:
              parsedFees,

            currency:
              normalizedCurrency,

            movement_date:
              operationDate,

            note:
              note.trim() ||
              null,

            counts_as_invested:
              true,
          },
        );
      }

      const createdPortfolioId =
        selectedPortfolioId;

      setSubmitting(false);

      closeSheet(() => {
        onCreated(
          createdPortfolioId,
        );
      });
    } catch (
      submitError
    ) {
      setSubmitting(false);

      setError(
        submitError instanceof
        Error
          ? submitError.message
          : 'Impossible d’enregistrer l’opération.',
      );
    }
  }

  const operationInfo =
    OPERATIONS.find(
      (item) =>
        item.type ===
        operation,
    );

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={() =>
        closeSheet()
      }
    >
      <View
        style={
          styles.modalRoot
        }
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.overlay,
            {
              opacity:
                overlayOpacity,
            },
          ]}
        />

        <Pressable
          style={
            StyleSheet.absoluteFill
          }
          onPress={() =>
            closeSheet()
          }
        />

        <KeyboardAvoidingView
          pointerEvents="box-none"
          behavior={
            Platform.OS ===
            'ios'
              ? 'padding'
              : undefined
          }
          style={
            styles.keyboard
          }
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor:
                  colors.surface,

                paddingBottom:
                  Math.max(
                    insets.bottom,
                    18,
                  ),

                transform: [
                  {
                    translateY,
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.handle,
                {
                  backgroundColor:
                    colors.borderStrong,
                },
              ]}
            />

            <View
              style={
                styles.header
              }
            >
              {operation ? (
                <Pressable
                  onPress={() => {
                    if (
                      submitting
                    ) {
                      return;
                    }

                    setOperation(
                      null,
                    );

                    setError(
                      null,
                    );
                  }}
                  style={
                    styles.headerButton
                  }
                >
                  <Ionicons
                    name="arrow-back"
                    size={22}
                    color={
                      colors.text
                    }
                  />
                </Pressable>
              ) : (
                <View
                  style={
                    styles.headerSpacer
                  }
                />
              )}

              <Text
                style={[
                  styles.headerTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {operationInfo
                  ?.title ??
                  'Ajouter'}
              </Text>

              <Pressable
                onPress={() =>
                  closeSheet()
                }
                style={
                  styles.headerButton
                }
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={
                    colors.text
                  }
                />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.scrollContent
              }
            >
              {loadingPortfolios ? (
                <ActivityIndicator
                  style={{
                    marginVertical:
                      25,
                  }}
                  color={
                    colors.text
                  }
                />
              ) : (
                <>
                  <Text
                    style={[
                      styles.sectionLabel,
                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    Portefeuille
                  </Text>

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
                      styles.minimalRow,
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
                        {selectedPortfolio
                          ?.name ??
                          'Choisir'}
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
                                selectPortfolio(
                                  portfolio,
                                )
                              }
                              style={[
                                styles.dropdownRow,
                                {
                                  borderBottomColor:
                                    colors.border,
                                },
                              ]}
                            >
                              <View
                                style={
                                  styles.checkSlot
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
                                  styles.rowCopy
                                }
                              >
                                <Text
                                  style={[
                                    styles.dropdownTitle,
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
                                    styles.rowSubtitle,
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

                  {!operation ? (
                    <>
                      <Text
                        style={[
                          styles.sectionLabel,
                          {
                            color:
                              colors.textMuted,
                          },
                        ]}
                      >
                        Opération
                      </Text>

                      {OPERATIONS.map(
                        (
                          item,
                        ) => {
                          const positive =
                            item.type ===
                              'buy' ||
                            item.type ===
                              'deposit';

                          return (
                            <Pressable
                              key={
                                item.type
                              }
                              onPress={() =>
                                selectOperation(
                                  item.type,
                                )
                              }
                              style={[
                                styles.minimalRow,
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
                                  name={
                                    item.icon
                                  }
                                  size={
                                    19
                                  }
                                  color={
                                    positive
                                      ? colors.positive
                                      : colors.negative
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
                                  {
                                    item.title
                                  }
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
                                  {
                                    item.subtitle
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
                            </Pressable>
                          );
                        },
                      )}
                    </>
                  ) : null}

                  {operation ===
                  'buy' ? (
                    <>
                      <Text
                        style={[
                          styles.sectionLabel,
                          {
                            color:
                              colors.textMuted,
                          },
                        ]}
                      >
                        Actif
                      </Text>

                      <View
                        style={[
                          styles.searchRow,
                          {
                            borderBottomColor:
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
                          value={
                            assetQuery
                          }
                          onChangeText={(
                            text,
                          ) => {
                            setAssetQuery(
                              text,
                            );

                            if (
                              selectedAsset
                            ) {
                              setSelectedAsset(
                                null,
                              );
                            }
                          }}
                          placeholder="Rechercher un actif"
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

                        {assetSearchLoading ? (
                          <ActivityIndicator
                            size="small"
                            color={
                              colors.text
                            }
                          />
                        ) : null}
                      </View>

                      {assetResults.map(
                        (
                          asset,
                        ) => (
                          <Pressable
                            key={`${asset.id ?? asset.symbol}-${asset.symbol}`}
                            onPress={() =>
                              chooseAsset(
                                asset,
                              )
                            }
                            style={[
                              styles.assetRow,
                              {
                                borderBottomColor:
                                  colors.border,
                              },
                            ]}
                          >
                            {asset.image_url ? (
                              <Image
                                source={{
                                  uri: asset.image_url,
                                }}
                                style={
                                  styles.assetImage
                                }
                              />
                            ) : (
                              <View
                                style={[
                                  styles.assetFallback,
                                  {
                                    backgroundColor:
                                      colors.surfaceStrong,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.assetFallbackText,
                                    {
                                      color:
                                        colors.text,
                                    },
                                  ]}
                                >
                                  {asset.symbol
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
                                {
                                  asset.name
                                }
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
                                {
                                  asset.symbol
                                }
                                {asset.exchange
                                  ? ` · ${asset.exchange}`
                                  : ''}
                              </Text>
                            </View>

                            <Text
                              style={[
                                styles.assetPrice,
                                {
                                  color:
                                    colors.textSecondary,
                                },
                              ]}
                            >
                              {asset.price
                                ? formatNumber(
                                    asset.price,
                                  )
                                : ''}
                            </Text>
                          </Pressable>
                        ),
                      )}
                    </>
                  ) : null}

                  {operation ===
                  'sell' ? (
                    <>
                      <Text
                        style={[
                          styles.sectionLabel,
                          {
                            color:
                              colors.textMuted,
                          },
                        ]}
                      >
                        Actif à vendre
                      </Text>

                      {holdingsLoading ? (
                        <ActivityIndicator
                          style={{
                            marginVertical:
                              20,
                          }}
                          color={
                            colors.text
                          }
                        />
                      ) : holdings.length ===
                        0 ? (
                        <Text
                          style={[
                            styles.emptyText,
                            {
                              color:
                                colors.textMuted,
                            },
                          ]}
                        >
                          Aucun actif détenu.
                        </Text>
                      ) : (
                        holdings.map(
                          (
                            holding,
                          ) => {
                            const active =
                              selectedHoldingId ===
                              holding.asset_id;

                            return (
                              <Pressable
                                key={
                                  holding.asset_id
                                }
                                onPress={() =>
                                  chooseHolding(
                                    holding,
                                  )
                                }
                                style={[
                                  styles.minimalRow,
                                  {
                                    borderBottomColor:
                                      colors.border,
                                  },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.assetFallback,
                                    {
                                      backgroundColor:
                                        colors.surfaceStrong,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.assetFallbackText,
                                      {
                                        color:
                                          colors.text,
                                      },
                                    ]}
                                  >
                                    {holding.symbol
                                      .slice(
                                        0,
                                        2,
                                      )
                                      .toUpperCase()}
                                  </Text>
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
                                    {
                                      holding.name
                                    }
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
                                    {formatNumber(
                                      holding.quantity,
                                    )}{' '}
                                    {
                                      holding.symbol
                                    }
                                  </Text>
                                </View>

                                {active ? (
                                  <Ionicons
                                    name="checkmark"
                                    size={
                                      20
                                    }
                                    color={
                                      colors.positive
                                    }
                                  />
                                ) : (
                                  <Ionicons
                                    name="chevron-forward"
                                    size={
                                      18
                                    }
                                    color={
                                      colors.textMuted
                                    }
                                  />
                                )}
                              </Pressable>
                            );
                          },
                        )
                      )}
                    </>
                  ) : null}

                  {(operation ===
                    'buy' ||
                    operation ===
                      'sell') ? (
                    <>
                      <View
                        style={
                          styles.twoColumns
                        }
                      >
                        <Field
                          label="Quantité"
                          value={
                            quantity
                          }
                          onChangeText={
                            setQuantity
                          }
                          placeholder="0"
                          colors={
                            colors
                          }
                        />

                        <Field
                          label="Prix"
                          value={
                            price
                          }
                          onChangeText={
                            setPrice
                          }
                          placeholder="0,00"
                          colors={
                            colors
                          }
                        />
                      </View>

                      <View
                        style={
                          styles.twoColumns
                        }
                      >
                        <Field
                          label="Frais"
                          value={
                            fees
                          }
                          onChangeText={
                            setFees
                          }
                          placeholder="0"
                          colors={
                            colors
                          }
                        />

                        <Field
                          label="Devise"
                          value={
                            currency
                          }
                          onChangeText={
                            setCurrency
                          }
                          placeholder="EUR"
                          keyboardType="default"
                          colors={
                            colors
                          }
                        />
                      </View>
                    </>
                  ) : null}

                  {(operation ===
                    'deposit' ||
                    operation ===
                      'withdrawal') ? (
                    <>
                      <View
                        style={
                          styles.twoColumns
                        }
                      >
                        <Field
                          label="Montant"
                          value={
                            amount
                          }
                          onChangeText={
                            setAmount
                          }
                          placeholder="0,00"
                          colors={
                            colors
                          }
                        />

                        <Field
                          label="Devise"
                          value={
                            currency
                          }
                          onChangeText={
                            setCurrency
                          }
                          placeholder="EUR"
                          keyboardType="default"
                          colors={
                            colors
                          }
                        />
                      </View>

                      <Field
                        label="Frais"
                        value={
                          fees
                        }
                        onChangeText={
                          setFees
                        }
                        placeholder="0"
                        colors={
                          colors
                        }
                      />
                    </>
                  ) : null}

                  {operation ? (
                    <>
                      <Text
                        style={[
                          styles.sectionLabel,
                          {
                            color:
                              colors.textMuted,
                          },
                        ]}
                      >
                        Note
                      </Text>

                      <TextInput
                        value={
                          note
                        }
                        onChangeText={
                          setNote
                        }
                        placeholder="Optionnel"
                        placeholderTextColor={
                          colors.textMuted
                        }
                        multiline
                        style={[
                          styles.noteInput,
                          {
                            borderBottomColor:
                              colors.border,

                            color:
                              colors.text,
                          },
                        ]}
                      />

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
                            {
                              error
                            }
                          </Text>
                        </View>
                      ) : null}

                      <Pressable
                        disabled={
                          submitting
                        }
                        onPress={() =>
                          void submit()
                        }
                        style={[
                          styles.submitButton,
                          {
                            backgroundColor:
                              colors.brandFill,

                            opacity:
                              submitting
                                ? 0.6
                                : 1,
                          },
                        ]}
                      >
                        {submitting ? (
                          <ActivityIndicator
                            color={
                              colors.brandText
                            }
                          />
                        ) : (
                          <Text
                            style={[
                              styles.submitText,
                              {
                                color:
                                  colors.brandText,
                              },
                            ]}
                          >
                            Confirmer
                          </Text>
                        )}
                      </Pressable>
                    </>
                  ) : null}
                </>
              )}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

type FieldProps = {
  label: string;
  value: string;

  placeholder: string;

  onChangeText: (
    value: string,
  ) => void;

  keyboardType?:
    | 'decimal-pad'
    | 'default';

  colors: {
    border: string;
    text: string;
    textMuted: string;
  };
};

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType = 'decimal-pad',
  colors,
}: FieldProps) {
  return (
    <View
      style={
        styles.field
      }
    >
      <Text
        style={[
          styles.inputLabel,
          {
            color:
              colors.textMuted,
          },
        ]}
      >
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={
          onChangeText
        }
        placeholder={
          placeholder
        }
        placeholderTextColor={
          colors.textMuted
        }
        keyboardType={
          keyboardType
        }
        style={[
          styles.input,
          {
            borderBottomColor:
              colors.border,

            color:
              colors.text,
          },
        ]}
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent:
        'flex-end',
    },

    overlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,

      backgroundColor:
        'rgba(0,0,0,0.5)',
    },

    keyboard: {
      justifyContent:
        'flex-end',
    },

    sheet: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,

      maxHeight: '90%',

      paddingHorizontal: 20,
      paddingTop: 9,
    },

    handle: {
      alignSelf: 'center',

      borderRadius: 999,

      height: 4,
      width: 40,

      marginBottom: 14,

      opacity: 0.4,
    },

    header: {
      alignItems: 'center',

      flexDirection: 'row',

      height: 48,
    },

    headerButton: {
      alignItems: 'center',

      height: 42,
      width: 42,

      justifyContent:
        'center',
    },

    headerSpacer: {
      height: 42,
      width: 42,
    },

    headerTitle: {
      flex: 1,

      fontSize: 18,
      fontWeight: '900',

      textAlign: 'center',
    },

    scrollContent: {
      paddingBottom: 22,
    },

    sectionLabel: {
      fontSize: 11,

      fontWeight: '800',

      marginBottom: 4,
      marginTop: 24,
    },

    minimalRow: {
      alignItems: 'center',

      borderBottomWidth: 1,

      flexDirection: 'row',

      minHeight: 68,

      paddingVertical: 9,
    },

    dropdownRow: {
      alignItems: 'center',

      borderBottomWidth: 1,

      flexDirection: 'row',

      minHeight: 58,

      paddingLeft: 6,
    },

    checkSlot: {
      alignItems: 'center',

      justifyContent:
        'center',

      width: 28,
    },

    smallIcon: {
      alignItems: 'center',

      borderRadius: 18,

      height: 36,
      width: 36,

      justifyContent:
        'center',
    },

    rowCopy: {
      flex: 1,

      marginLeft: 12,
    },

    rowTitle: {
      fontSize: 14,

      fontWeight: '800',
    },

    dropdownTitle: {
      fontSize: 13,

      fontWeight: '800',
    },

    rowSubtitle: {
      fontSize: 10,

      marginTop: 3,
    },

    searchRow: {
      alignItems: 'center',

      borderBottomWidth: 1,

      flexDirection: 'row',

      gap: 10,

      minHeight: 56,
    },

    searchInput: {
      flex: 1,

      fontSize: 14,
    },

    assetRow: {
      alignItems: 'center',

      borderBottomWidth: 1,

      flexDirection: 'row',

      minHeight: 62,

      paddingVertical: 8,
    },

    assetImage: {
      borderRadius: 18,

      height: 36,
      width: 36,
    },

    assetFallback: {
      alignItems: 'center',

      borderRadius: 18,

      height: 36,
      width: 36,

      justifyContent:
        'center',
    },

    assetFallbackText: {
      fontSize: 10,

      fontWeight: '900',
    },

    assetPrice: {
      fontSize: 10,

      fontWeight: '800',
    },

    twoColumns: {
      flexDirection: 'row',

      gap: 18,

      marginTop: 8,
    },

    field: {
      flex: 1,
    },

    inputLabel: {
      fontSize: 10,

      fontWeight: '800',

      marginTop: 18,
    },

    input: {
      borderBottomWidth: 1,

      fontSize: 15,

      height: 48,

      paddingHorizontal: 0,
    },

    noteInput: {
      borderBottomWidth: 1,

      fontSize: 14,

      minHeight: 65,

      paddingHorizontal: 0,
      paddingVertical: 10,

      textAlignVertical:
        'top',
    },

    errorRow: {
      alignItems:
        'flex-start',

      flexDirection: 'row',

      gap: 8,

      marginTop: 16,
    },

    errorText: {
      flex: 1,

      fontSize: 11,

      lineHeight: 16,
    },

    submitButton: {
      alignItems: 'center',

      borderRadius: 15,

      height: 54,

      justifyContent:
        'center',

      marginTop: 26,
    },

    submitText: {
      fontSize: 13,

      fontWeight: '900',
    },

    emptyText: {
      fontSize: 12,

      paddingVertical: 20,
    },
  });