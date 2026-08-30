import Ionicons from '@expo/vector-icons/Ionicons';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  usePortfolioSwipe,
} from '@/components/portfolio/portfolio-swipe-context';
import {
  TransactionSheet,
} from '@/components/teryso/transaction-sheet';
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

type ViewMode =
  | 'cash'
  | 'securities';

type ActivityRow = {
  operation_id: string;
  operation_type: string;
  occurred_at: string;
  asset_symbol:
    string | null;
  asset_name:
    string | null;
  quantity: Numeric;
  unit_price: Numeric;
  amount: Numeric;
  fees: Numeric;
  currency:
    string | null;
  note:
    string | null;
};

type DeleteRpc =
  | 'delete_portfolio_transaction'
  | 'delete_cash_movement'
  | 'delete_asset_movement'
  | 'delete_asset_swap'
  | 'delete_cash_transfer'
  | 'delete_asset_transfer';

const TYPE_LABELS:
  Record<
    string,
    string
  > = {
  buy:
    'Achat',

  sell:
    'Vente',

  deposit:
    'Dépôt',

  withdrawal:
    'Retrait',

  buy_spend:
    'Achat · espèces',

  sell_receive:
    'Vente · espèces',

  asset_deposit:
    'Dépôt d’actif',

  asset_withdrawal:
    'Retrait d’actif',

  swap:
    'Swap',

  cash_transfer:
    'Transfert espèces',

  cash_transfer_in:
    'Espèces entrantes',

  cash_transfer_out:
    'Espèces sortantes',

  asset_transfer:
    'Transfert d’actif',

  asset_transfer_in:
    'Actif entrant',

  asset_transfer_out:
    'Actif sortant',
};

function number(
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

function formatMoney(
  value: unknown,
  currency =
    'EUR',
) {
  const parsed =
    number(value);

  if (
    parsed ===
    null
  ) {
    return '—';
  }

  return new Intl.NumberFormat(
    'fr-FR',
    {
      style:
        'currency',

      currency,

      maximumFractionDigits:
        2,
    },
  ).format(parsed);
}

function formatQuantity(
  value: unknown,
) {
  const parsed =
    number(value);

  if (
    parsed ===
    null
  ) {
    return '—';
  }

  return parsed.toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits:
        8,
    },
  );
}

function cashOperation(
  type: string,
) {
  return (
    type ===
      'deposit' ||
    type ===
      'withdrawal' ||
    type.startsWith(
      'cash_transfer',
    )
  );
}

function operationIcon(
  type: string,
) {
  if (
    type ===
    'buy'
  ) {
    return 'cart-outline' as const;
  }

  if (
    type ===
      'sell' ||
    type ===
      'withdrawal' ||
    type.endsWith(
      '_out',
    )
  ) {
    return 'arrow-up-outline' as const;
  }

  if (
    type.includes(
      'transfer',
    ) ||
    type ===
      'swap'
  ) {
    return 'swap-horizontal-outline' as const;
  }

  return 'arrow-down-outline' as const;
}

function deleteTarget(
  row:
    ActivityRow,
): {
  rpc:
    DeleteRpc;

  parameter:
    string;
} {
  if (
    row.operation_type ===
      'buy' ||
    row.operation_type ===
      'sell'
  ) {
    return {
      rpc:
        'delete_portfolio_transaction',

      parameter:
        'p_transaction_id',
    };
  }

  if (
    row.operation_type ===
      'deposit' ||
    row.operation_type ===
      'withdrawal'
  ) {
    return {
      rpc:
        'delete_cash_movement',

      parameter:
        'p_cash_movement_id',
    };
  }

  if (
    row.operation_type ===
      'asset_deposit' ||
    row.operation_type ===
      'asset_withdrawal'
  ) {
    return {
      rpc:
        'delete_asset_movement',

      parameter:
        'p_asset_movement_id',
    };
  }

  if (
    row.operation_type ===
    'swap'
  ) {
    return {
      rpc:
        'delete_asset_swap',

      parameter:
        'p_asset_swap_id',
    };
  }

  if (
    row.operation_type.startsWith(
      'cash_transfer',
    )
  ) {
    return {
      rpc:
        'delete_cash_transfer',

      parameter:
        'p_cash_transfer_id',
    };
  }

  if (
    row.operation_type.startsWith(
      'asset_transfer',
    )
  ) {
    return {
      rpc:
        'delete_asset_transfer',

      parameter:
        'p_asset_transfer_id',
    };
  }

  throw new Error(
    'Cette opération ne peut pas être supprimée.',
  );
}

export function TransactionsSlide() {
  const {
    colors,
  } =
    useTerysoTheme();

  const {
    selectedPortfolio,
    selectedPortfolioId,
    selectPortfolio,
    refreshKey,
  } =
    usePortfolioSwipe();

  const [
    activity,
    setActivity,
  ] =
    useState<
      ActivityRow[]
    >([]);

  const [
    mode,
    setMode,
  ] =
    useState<ViewMode>(
      'cash',
    );

  const [
    search,
    setSearch,
  ] =
    useState('');

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
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    transactionOpen,
    setTransactionOpen,
  ] =
    useState(false);

  const load =
    useCallback(
      async (
        refresh =
          false,
      ) => {
        if (
          !selectedPortfolioId
        ) {
          setActivity([]);
          return;
        }

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        try {
          const {
            data,
            error:
              activityError,
          } =
            await supabase.rpc(
              'get_portfolio_activity',
              {
                p_portfolio_id:
                  selectedPortfolioId,
              },
            );

          if (
            activityError
          ) {
            throw activityError;
          }

          setActivity(
            Array.isArray(
              data,
            )
              ? (data as ActivityRow[])
              : [],
          );
        } catch (
          loadError
        ) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Impossible de charger les transactions.',
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

  useEffect(() => {
    void load();
  }, [
    load,
    refreshKey,
  ]);

  const filtered =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLocaleLowerCase(
              'fr',
            );

        return activity.filter(
          (row) => {
            const correctMode =
              mode ===
              'cash'
                ? cashOperation(
                    row.operation_type,
                  )
                : !cashOperation(
                    row.operation_type,
                  );

            if (
              !correctMode
            ) {
              return false;
            }

            if (
              !query
            ) {
              return true;
            }

            return [
              row.asset_symbol,
              row.asset_name,
              row.note,
              TYPE_LABELS[
                row.operation_type
              ] ??
                row.operation_type,
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
                      query,
                    ),
              );
          },
        );
      },
      [
        activity,
        mode,
        search,
      ],
    );

  async function remove(
    row:
      ActivityRow,
  ) {
    try {
      setError(null);

      const target =
        deleteTarget(
          row,
        );

      const {
        error:
          deleteError,
      } =
        await supabase.rpc(
          target.rpc,
          {
            [target.parameter]:
              row.operation_id,
          },
        );

      if (
        deleteError
      ) {
        throw deleteError;
      }

      await load(true);
    } catch (
      deleteError
    ) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : 'Impossible de supprimer cette opération.';

      setError(
        message,
      );

      if (
        Platform.OS ===
        'web'
      ) {
        if (
          typeof window !==
          'undefined'
        ) {
          window.alert(
            `Suppression impossible\n\n${message}`,
          );
        }

        return;
      }

      Alert.alert(
        'Suppression impossible',
        message,
      );
    }
  }

  function confirmRemove(
    row:
      ActivityRow,
  ) {
    if (
      Platform.OS ===
      'web'
    ) {
      const confirmed =
        typeof window !==
        'undefined'
          ? window.confirm(
              'Supprimer cette opération ?\n\nLes soldes et positions seront recalculés.',
            )
          : false;

      if (
        confirmed
      ) {
        void remove(
          row,
        );
      }

      return;
    }

    Alert.alert(
      'Supprimer cette opération ?',
      'Les soldes et positions seront recalculés.',
      [
        {
          text:
            'Annuler',

          style:
            'cancel',
        },

        {
          text:
            'Supprimer',

          style:
            'destructive',

          onPress:
            () =>
              void remove(
                row,
              ),
        },
      ],
    );
  }

  return (
    <>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
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
        contentContainerStyle={
          styles.content
        }
      >
        <View
          style={
            styles.top
          }
        >
          <View>
            <Text
              style={[
                styles.title,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Transactions
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              {activity.length}{' '}
              opération
              {activity.length !==
              1
                ? 's'
                : ''}
            </Text>
          </View>

          <Pressable
            disabled={
              !selectedPortfolio
            }
            onPress={() =>
              setTransactionOpen(
                true,
              )
            }
            style={[
              styles.addButton,
              {
                backgroundColor:
                  colors.brandFill,

                opacity:
                  selectedPortfolio
                    ? 1
                    : 0.4,
              },
            ]}
          >
            <Ionicons
              name="add"
              size={
                19
              }
              color={
                colors.brandText
              }
            />

            <Text
              style={[
                styles.addText,
                {
                  color:
                    colors.brandText,
                },
              ]}
            >
              Ajouter
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.segment,
            {
              backgroundColor:
                colors.surfaceStrong,
            },
          ]}
        >
          {([
            {
              key:
                'cash',
              label:
                'Espèces',
            },

            {
              key:
                'securities',
              label:
                'Titres & actifs',
            },
          ] as const).map(
            (item) => {
              const active =
                mode ===
                item.key;

              return (
                <Pressable
                  key={
                    item.key
                  }
                  onPress={() =>
                    setMode(
                      item.key,
                    )
                  }
                  style={[
                    styles.segmentButton,

                    active && {
                      backgroundColor:
                        colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color:
                          active
                            ? colors.text
                            : colors.textMuted,
                      },
                    ]}
                  >
                    {
                      item.label
                    }
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>

        <View
          style={[
            styles.search,
            {
              borderColor:
                colors.border,

              backgroundColor:
                colors.surface,
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={
              17
            }
            color={
              colors.textMuted
            }
          />

          <TextInput
            value={
              search
            }
            onChangeText={
              setSearch
            }
            placeholder={
              mode ===
              'cash'
                ? 'Type, note…'
                : 'Actif, note…'
            }
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
          />

          {search ? (
            <Pressable
              onPress={() =>
                setSearch(
                  '',
                )
              }
            >
              <Ionicons
                name="close-circle"
                size={
                  17
                }
                color={
                  colors.textMuted
                }
              />
            </Pressable>
          ) : null}
        </View>

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

        {!loading &&
        filtered.length ===
          0 ? (
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
              name="receipt-outline"
              size={
                28
              }
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
              Aucune opération
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
              Les opérations apparaîtront ici.
            </Text>
          </View>
        ) : null}

        {filtered.map(
          (row) => {
            const currency =
              row.currency ??
              selectedPortfolio
                ?.base_currency ??
              'EUR';

            const outgoing =
              row.operation_type ===
                'withdrawal' ||
              row.operation_type ===
                'cash_transfer_out';

            return (
              <View
                key={`${row.operation_type}-${row.operation_id}`}
                style={[
                  styles.row,
                  {
                    borderBottomColor:
                      colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.icon,
                    {
                      backgroundColor:
                        colors.surfaceStrong,
                    },
                  ]}
                >
                  <Ionicons
                    name={operationIcon(
                      row.operation_type,
                    )}
                    size={
                      17
                    }
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
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.rowTitle,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {TYPE_LABELS[
                      row.operation_type
                    ] ??
                      row.operation_type}
                  </Text>

                  <Text
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.rowSubtitle,
                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    {row.asset_symbol
                      ? `${row.asset_symbol}${
                          row.asset_name
                            ? ` · ${row.asset_name}`
                            : ''
                        }`
                      : row.note ??
                        row.asset_name ??
                        'Espèces'}
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
                    {new Date(
                      row.occurred_at,
                    ).toLocaleString(
                      'fr-FR',
                      {
                        dateStyle:
                          'medium',

                        timeStyle:
                          'short',
                      },
                    )}
                  </Text>
                </View>

                <View
                  style={
                    styles.right
                  }
                >
                  <Text
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.amount,
                      {
                        color:
                          mode ===
                          'cash'
                            ? outgoing
                              ? colors.negative
                              : colors.positive
                            : colors.text,
                      },
                    ]}
                  >
                    {mode ===
                    'cash'
                      ? outgoing
                        ? '− '
                        : '+ '
                      : ''}

                    {formatMoney(
                      row.amount,
                      currency,
                    )}
                  </Text>

                  {mode ===
                  'securities' ? (
                    <Text
                      style={[
                        styles.meta,
                        {
                          color:
                            colors.textMuted,
                        },
                      ]}
                    >
                      {formatQuantity(
                        row.quantity,
                      )}
                      {' · '}
                      {formatMoney(
                        row.unit_price,
                        currency,
                      )}
                    </Text>
                  ) : Number(
                      row.fees ??
                        0,
                    ) >
                    0 ? (
                    <Text
                      style={[
                        styles.meta,
                        {
                          color:
                            colors.textMuted,
                        },
                      ]}
                    >
                      Frais{' '}
                      {formatMoney(
                        row.fees,
                        currency,
                      )}
                    </Text>
                  ) : null}
                </View>

                <Pressable
                  accessibilityLabel="Supprimer"
                  hitSlop={
                    9
                  }
                  onPress={() =>
                    confirmRemove(
                      row,
                    )
                  }
                  style={
                    styles.delete
                  }
                >
                  <Ionicons
                    name="trash-outline"
                    size={
                      16
                    }
                    color={
                      colors.textMuted
                    }
                  />
                </Pressable>
              </View>
            );
          },
        )}
      </ScrollView>

      <TransactionSheet
        visible={
          transactionOpen
        }
        onClose={() =>
          setTransactionOpen(
            false,
          )
        }
        onCreated={(
          portfolioId,
        ) => {
          selectPortfolio(
            portfolioId,
          );

          setTransactionOpen(
            false,
          );

          setTimeout(
            () => {
              void load(
                true,
              );
            },
            0,
          );
        }}
      />
    </>
  );
}

const styles =
  StyleSheet.create({
    content: {
      paddingBottom:
        46,

      paddingHorizontal:
        20,

      paddingTop:
        22,
    },

    top: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      marginBottom:
        18,
    },

    title: {
      fontSize:
        21,

      fontWeight:
        '900',

      letterSpacing:
        -0.5,
    },

    subtitle: {
      fontSize:
        10,

      marginTop:
        4,
    },

    addButton: {
      alignItems:
        'center',

      borderRadius:
        12,

      flexDirection:
        'row',

      gap:
        4,

      minHeight:
        40,

      paddingHorizontal:
        12,
    },

    addText: {
      fontSize:
        11,

      fontWeight:
        '900',
    },

    segment: {
      borderRadius:
        12,

      flexDirection:
        'row',

      padding:
        3,
    },

    segmentButton: {
      alignItems:
        'center',

      borderRadius:
        9,

      flex:
        1,

      justifyContent:
        'center',

      minHeight:
        39,
    },

    segmentText: {
      fontSize:
        11,

      fontWeight:
        '900',
    },

    search: {
      alignItems:
        'center',

      borderRadius:
        12,

      borderWidth:
        1,

      flexDirection:
        'row',

      gap:
        8,

      marginTop:
        11,

      minHeight:
        44,

      paddingHorizontal:
        12,
    },

    searchInput: {
      flex:
        1,

      fontSize:
        13,

      minHeight:
        42,

      paddingVertical:
        0,
    },

    error: {
      fontSize:
        11,

      marginTop:
        14,
    },

    row: {
      alignItems:
        'center',

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      flexDirection:
        'row',

      gap:
        10,

      minHeight:
        78,

      paddingVertical:
        10,
    },

    icon: {
      alignItems:
        'center',

      borderRadius:
        19,

      height:
        38,

      justifyContent:
        'center',

      width:
        38,
    },

    rowCopy: {
      flex:
        1,

      minWidth:
        0,
    },

    rowTitle: {
      fontSize:
        12,

      fontWeight:
        '900',
    },

    rowSubtitle: {
      fontSize:
        9,

      marginTop:
        3,
    },

    date: {
      fontSize:
        8.5,

      marginTop:
        4,
    },

    right: {
      alignItems:
        'flex-end',

      maxWidth:
        112,
    },

    amount: {
      fontSize:
        10.5,

      fontWeight:
        '900',

      textAlign:
        'right',
    },

    meta: {
      fontSize:
        8.5,

      marginTop:
        4,

      textAlign:
        'right',
    },

    delete: {
      alignItems:
        'center',

      height:
        34,

      justifyContent:
        'center',

      width:
        25,
    },

    empty: {
      alignItems:
        'center',

      borderRadius:
        16,

      borderWidth:
        1,

      marginTop:
        20,

      padding:
        38,
    },

    emptyTitle: {
      fontSize:
        14,

      fontWeight:
        '900',

      marginTop:
        10,
    },

    emptyText: {
      fontSize:
        10,

      marginTop:
        5,
    },
  });