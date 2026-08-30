import Ionicons from '@expo/vector-icons/Ionicons';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  usePortfolioSwipe,
} from '@/components/portfolio/portfolio-swipe-context';

import {
  useAuth,
} from '@/contexts/auth-context';

import {
  useTerysoTheme,
} from '@/contexts/theme-context';

import {
  supabase,
} from '@/lib/supabase';

type RuleStatus =
  | 'active'
  | 'archived';

type RuleConfig =
  Record<
    string,
    unknown
  >;

type PortfolioRule = {
  id: string;

  portfolio_id:
    string;

  source_proposal_id:
    string | null;

  title: string;

  description:
    string;

  category:
    string;

  config:
    RuleConfig;

  status:
    RuleStatus;

  adopted_at:
    string | null;

  created_by:
    string | null;

  created_at:
    string;

  updated_at:
    string;
};

type AssemblySummary = {
  viewer_can_propose:
    boolean;

  viewer_can_vote:
    boolean;

  human_members:
    number | string | null;

  ai_members:
    number | string | null;
};

type RuleSubmissionResult = {
  mode:
    | 'created'
    | 'proposal';

  rule_id:
    string | null;

  proposal_id:
    string | null;
};

type RuleTemplate = {
  id: string;

  title: string;

  description:
    string;

  category:
    string;

  key:
    string;

  value:
    string;

  unit:
    string;

  icon:
    | 'pie-chart-outline'
    | 'cash-outline'
    | 'shield-checkmark-outline'
    | 'layers-outline';
};

const CATEGORIES = [
  'Général',
  'Allocation',
  'Risque',
  'Liquidité',
  'Actifs',
  'Stratégie',
];

const TEMPLATES:
  RuleTemplate[] = [
    {
      id:
        'max-allocation',

      title:
        'Allocation maximale par actif',

      description:
        'Limiter le poids maximal d’un seul actif dans le portefeuille.',

      category:
        'Allocation',

      key:
        'max_allocation',

      value:
        '25',

      unit:
        '%',

      icon:
        'pie-chart-outline',
    },

    {
      id:
        'minimum-cash',

      title:
        'Réserve minimale de liquidités',

      description:
        'Conserver une part minimale du portefeuille disponible en espèces.',

      category:
        'Liquidité',

      key:
        'min_cash_percent',

      value:
        '10',

      unit:
        '%',

      icon:
        'cash-outline',
    },

    {
      id:
        'minimum-assets',

      title:
        'Diversification minimale',

      description:
        'Maintenir un nombre minimum d’actifs dans le portefeuille.',

      category:
        'Risque',

      key:
        'min_assets',

      value:
        '5',

      unit:
        'actifs',

      icon:
        'layers-outline',
    },

    {
      id:
        'risk-limit',

      title:
        'Exposition maximale',

      description:
        'Définir une limite d’exposition pour réduire le risque de concentration.',

      category:
        'Risque',

      key:
        'max_exposure',

      value:
        '30',

      unit:
        '%',

      icon:
        'shield-checkmark-outline',
    },
  ];

function formatDate(
  value:
    | string
    | null,
) {
  if (!value) {
    return '—';
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
    return '—';
  }

  return date.toLocaleDateString(
    'fr-FR',
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    },
  );
}

function normalizeValue(
  value: string,
) {
  const clean =
    value.trim();

  if (!clean) {
    return null;
  }

  const normalized =
    clean.replace(
      ',',
      '.',
    );

  const number =
    Number(
      normalized,
    );

  if (
    Number.isFinite(
      number,
    )
  ) {
    return number;
  }

  return clean;
}

function configEntries(
  config:
    RuleConfig,
) {
  const entries:
    {
      label:
        string;

      value:
        string;
    }[] = [];

  const key =
    typeof config.key ===
    'string'
      ? config.key
      : null;

  const value =
    config.value;

  const unit =
    typeof config.unit ===
    'string'
      ? config.unit
      : '';

  if (
    value !==
      undefined &&
    value !==
      null &&
    String(value)
      .trim()
  ) {
    entries.push({
      label:
        key
          ? key
              .replace(
                /_/g,
                ' ',
              )
          : 'Valeur',

      value:
        `${String(
          value,
        )}${
          unit
            ? ` ${unit}`
            : ''
        }`,
    });
  }

  for (
    const [
      entryKey,
      entryValue,
    ]
    of Object.entries(
      config,
    )
  ) {
    if (
      [
        'key',
        'value',
        'unit',
      ].includes(
        entryKey,
      )
    ) {
      continue;
    }

    if (
      entryValue ===
        null ||
      entryValue ===
        undefined ||
      typeof entryValue ===
        'object'
    ) {
      continue;
    }

    entries.push({
      label:
        entryKey.replace(
          /_/g,
          ' ',
        ),

      value:
        String(
          entryValue,
        ),
    });
  }

  return entries.slice(
    0,
    4,
  );
}

export function RulesSlide() {
  const {
    colors,
  } =
    useTerysoTheme();

  const {
    session,
  } =
    useAuth();

  const {
    selectedPortfolio,
    selectedPortfolioId,
    refreshKey,
  } =
    usePortfolioSwipe();

  const [
    rules,
    setRules,
  ] =
    useState<
      PortfolioRule[]
    >([]);

  const [
    assemblySummary,
    setAssemblySummary,
  ] =
    useState<
      AssemblySummary | null
    >(null);

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
    notice,
    setNotice,
  ] =
    useState<
      string | null
    >(null);

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<RuleStatus>(
      'active',
    );

  const [
    modalOpen,
    setModalOpen,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    changingStatusId,
    setChangingStatusId,
  ] =
    useState<
      string | null
    >(null);

  const [
    title,
    setTitle,
  ] =
    useState('');

  const [
    description,
    setDescription,
  ] =
    useState('');

  const [
    category,
    setCategory,
  ] =
    useState(
      'Général',
    );

  const [
    parameterKey,
    setParameterKey,
  ] =
    useState('');

  const [
    parameterValue,
    setParameterValue,
  ] =
    useState('');

  const [
    unit,
    setUnit,
  ] =
    useState('');

  const governanceMode =
    selectedPortfolio
      ?.governance_mode ??
    'owner';

  const isOwner =
    Boolean(
      session?.user.id &&
        selectedPortfolio
          ?.user_id ===
          session.user.id,
    );

  const canCreate =
    governanceMode ===
    'owner'
      ? isOwner
      : Boolean(
          assemblySummary
            ?.viewer_can_propose,
        );

  const canManageDirectly =
    governanceMode ===
      'owner' &&
    isOwner;

  const load =
    useCallback(
      async (
        refresh =
          false,
      ) => {
        if (
          !selectedPortfolioId
        ) {
          setRules([]);

          setLoading(
            false,
          );

          setRefreshing(
            false,
          );

          return;
        }

        if (refresh) {
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
          const rulesPromise =
            supabase
              .from(
                'portfolio_rules',
              )
              .select(
                [
                  'id',
                  'portfolio_id',
                  'source_proposal_id',
                  'title',
                  'description',
                  'category',
                  'config',
                  'status',
                  'adopted_at',
                  'created_by',
                  'created_at',
                  'updated_at',
                ].join(','),
              )
              .eq(
                'portfolio_id',
                selectedPortfolioId,
              )
              .order(
                'created_at',
                {
                  ascending:
                    false,
                },
              );

          const assemblyPromise =
            governanceMode ===
            'assembly'
              ? supabase.rpc(
                  'get_portfolio_assembly_summary',
                  {
                    p_portfolio_id:
                      selectedPortfolioId,
                  },
                )
              : Promise.resolve({
                  data:
                    null,

                  error:
                    null,
                });

          const [
            rulesResult,
            assemblyResult,
          ] =
            await Promise.all([
              rulesPromise,
              assemblyPromise,
            ]);

          if (
            rulesResult.error
          ) {
            throw rulesResult.error;
          }

          if (
            assemblyResult.error
          ) {
            throw assemblyResult.error;
          }

          setRules(
            (
              rulesResult.data ??
              []
            ) as unknown as PortfolioRule[],
          );

          if (
            governanceMode ===
            'assembly'
          ) {
            const rows =
              Array.isArray(
                assemblyResult.data,
              )
                ? assemblyResult.data
                : [];

            setAssemblySummary(
              (
                rows[0] ??
                null
              ) as AssemblySummary | null,
            );
          } else {
            setAssemblySummary(
              null,
            );
          }
        } catch (
          loadError
        ) {
          console.error(
            '[RulesSlide]',
            loadError,
          );

          setError(
            loadError instanceof
            Error
              ? loadError.message
              : 'Impossible de charger les règles.',
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
        governanceMode,
        selectedPortfolioId,
      ],
    );

  useEffect(() => {
    void load();
  }, [
    load,
    refreshKey,
  ]);

  const filteredRules =
    useMemo(
      () =>
        rules.filter(
          (
            rule,
          ) =>
            rule.status ===
            statusFilter,
        ),
      [
        rules,
        statusFilter,
      ],
    );

  const activeCount =
    useMemo(
      () =>
        rules.filter(
          (
            rule,
          ) =>
            rule.status ===
            'active',
        ).length,
      [
        rules,
      ],
    );

  const archivedCount =
    rules.length -
    activeCount;

  const categoriesCount =
    useMemo(
      () =>
        new Set(
          rules
            .filter(
              (
                rule,
              ) =>
                rule.status ===
                'active',
            )
            .map(
              (
                rule,
              ) =>
                rule.category,
            ),
        ).size,
      [
        rules,
      ],
    );

  function resetForm() {
    setTitle('');

    setDescription('');

    setCategory(
      'Général',
    );

    setParameterKey('');

    setParameterValue('');

    setUnit('');
  }

  function openCreateModal() {
    resetForm();

    setNotice(
      null,
    );

    setError(
      null,
    );

    setModalOpen(
      true,
    );
  }

  function applyTemplate(
    template:
      RuleTemplate,
  ) {
    setTitle(
      template.title,
    );

    setDescription(
      template.description,
    );

    setCategory(
      template.category,
    );

    setParameterKey(
      template.key,
    );

    setParameterValue(
      template.value,
    );

    setUnit(
      template.unit,
    );
  }

  async function submitRule() {
    if (
      !selectedPortfolioId ||
      saving
    ) {
      return;
    }

    const cleanTitle =
      title.trim();

    if (
      cleanTitle.length <
      3
    ) {
      setError(
        'Le titre doit contenir au moins 3 caractères.',
      );

      return;
    }

    setSaving(
      true,
    );

    setError(
      null,
    );

    setNotice(
      null,
    );

    try {
      const config:
        RuleConfig =
        {};

      const key =
        parameterKey.trim();

      const value =
        normalizeValue(
          parameterValue,
        );

      const cleanUnit =
        unit.trim();

      if (key) {
        config.key =
          key;
      }

      if (
        value !==
        null
      ) {
        config.value =
          value;
      }

      if (
        cleanUnit
      ) {
        config.unit =
          cleanUnit;
      }

      const {
        data,
        error:
          submitError,
      } =
        await supabase.rpc(
          'submit_portfolio_rule',
          {
            p_portfolio_id:
              selectedPortfolioId,

            p_title:
              cleanTitle,

            p_description:
              description.trim(),

            p_category:
              category,

            p_config:
              config,
          },
        );

      if (
        submitError
      ) {
        throw submitError;
      }

      const result =
        data as RuleSubmissionResult | null;

      setModalOpen(
        false,
      );

      resetForm();

      if (
        result?.mode ===
        'proposal'
      ) {
        setNotice(
          'La règle a été envoyée à l’assemblée. Elle apparaîtra ici après son adoption.',
        );
      } else {
        setNotice(
          'La règle a été ajoutée au portefeuille.',
        );
      }

      await load(
        true,
      );
    } catch (
      submitError
    ) {
      console.error(
        '[RulesSlide submit]',
        submitError,
      );

      setError(
        submitError instanceof
        Error
          ? submitError.message
          : 'Impossible d’ajouter cette règle.',
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  async function changeStatus(
    rule:
      PortfolioRule,
  ) {
    if (
      !canManageDirectly ||
      changingStatusId
    ) {
      return;
    }

    const nextStatus:
      RuleStatus =
        rule.status ===
        'active'
          ? 'archived'
          : 'active';

    setChangingStatusId(
      rule.id,
    );

    setError(
      null,
    );

    setNotice(
      null,
    );

    try {
      const {
        error:
          statusError,
      } =
        await supabase.rpc(
          'set_portfolio_rule_status',
          {
            p_rule_id:
              rule.id,

            p_status:
              nextStatus,
          },
        );

      if (
        statusError
      ) {
        throw statusError;
      }

      setNotice(
        nextStatus ===
        'active'
          ? 'La règle est de nouveau active.'
          : 'La règle a été archivée.',
      );

      await load(
        true,
      );
    } catch (
      statusError
    ) {
      console.error(
        '[RulesSlide status]',
        statusError,
      );

      setError(
        statusError instanceof
        Error
          ? statusError.message
          : 'Impossible de modifier la règle.',
      );
    } finally {
      setChangingStatusId(
        null,
      );
    }
  }

  return (
    <>
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
        <View
          style={
            styles.heading
          }
        >
          <View
            style={
              styles.headingCopy
            }
          >
            <Text
              style={[
                styles.title,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Règles
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
              Cadre de gestion du portefeuille
            </Text>
          </View>

          {canCreate ? (
            <Pressable
              onPress={
                openCreateModal
              }
              style={({
                pressed,
              }) => [
                styles.addButton,

                {
                  backgroundColor:
                    colors.brandFill,

                  opacity:
                    pressed
                      ? 0.7
                      : 1,
                },
              ]}
            >
              <Ionicons
                name="add"
                size={18}
                color={
                  colors.brandText
                }
              />

              <Text
                style={[
                  styles.addButtonText,
                  {
                    color:
                      colors.brandText,
                  },
                ]}
              >
                Ajouter
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View
          style={
            styles.metrics
          }
        >
          <MetricCard
            icon="shield-checkmark-outline"
            value={
              activeCount
            }
            label="Actives"
          />

          <MetricCard
            icon="grid-outline"
            value={
              categoriesCount
            }
            label="Catégories"
          />

          <MetricCard
            icon="archive-outline"
            value={
              archivedCount
            }
            label="Archivées"
          />
        </View>

        {governanceMode ===
        'assembly' ? (
          <View
            style={[
              styles.governanceNotice,
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
                styles.noticeIcon,
                {
                  backgroundColor:
                    colors.surfaceStrong,
                },
              ]}
            >
              <Ionicons
                name="people-outline"
                size={18}
                color={
                  colors.text
                }
              />
            </View>

            <View
              style={
                styles.noticeCopy
              }
            >
              <Text
                style={[
                  styles.noticeTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Gouvernance par assemblée
              </Text>

              <Text
                style={[
                  styles.noticeDescription,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Toute nouvelle règle est soumise au vote avant d’être activée.
              </Text>
            </View>
          </View>
        ) : null}

        {notice ? (
          <View
            style={[
              styles.message,
              {
                backgroundColor:
                  colors.accentSoft,

                borderColor:
                  colors.accent,
              },
            ]}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={17}
              color={
                colors.positive
              }
            />

            <Text
              style={[
                styles.messageText,
                {
                  color:
                    colors.positive,
                },
              ]}
            >
              {notice}
            </Text>
          </View>
        ) : null}

        {error ? (
          <View
            style={[
              styles.message,
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
              size={17}
              color={
                colors.negative
              }
            />

            <Text
              style={[
                styles.messageText,
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

        <View
          style={[
            styles.filters,
            {
              backgroundColor:
                colors.surfaceStrong,
            },
          ]}
        >
          <FilterButton
            label={`Actives · ${activeCount}`}
            active={
              statusFilter ===
              'active'
            }
            onPress={() =>
              setStatusFilter(
                'active',
              )
            }
          />

          <FilterButton
            label={`Archivées · ${archivedCount}`}
            active={
              statusFilter ===
              'archived'
            }
            onPress={() =>
              setStatusFilter(
                'archived',
              )
            }
          />
        </View>

        {loading ? (
          <View
            style={
              styles.loading
            }
          >
            <ActivityIndicator
              color={
                colors.text
              }
            />
          </View>
        ) : null}

        {!loading &&
        filteredRules.length ===
          0 ? (
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
                name="document-text-outline"
                size={23}
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
              {statusFilter ===
              'active'
                ? 'Aucune règle active'
                : 'Aucune règle archivée'}
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
              {statusFilter ===
                'active' &&
              canCreate
                ? 'Ajoute une première règle pour définir le cadre de gestion.'
                : 'Les règles correspondantes apparaîtront ici.'}
            </Text>

            {statusFilter ===
              'active' &&
            canCreate ? (
              <Pressable
                onPress={
                  openCreateModal
                }
                style={[
                  styles.emptyButton,
                  {
                    backgroundColor:
                      colors.brandFill,
                  },
                ]}
              >
                <Ionicons
                  name="add"
                  size={16}
                  color={
                    colors.brandText
                  }
                />

                <Text
                  style={[
                    styles.emptyButtonText,
                    {
                      color:
                        colors.brandText,
                    },
                  ]}
                >
                  Ajouter une règle
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View
          style={
            styles.rules
          }
        >
          {filteredRules.map(
            (
              rule,
            ) => (
              <RuleCard
                key={
                  rule.id
                }
                rule={
                  rule
                }
                canManage={
                  canManageDirectly
                }
                loading={
                  changingStatusId ===
                  rule.id
                }
                onStatusChange={() =>
                  void changeStatus(
                    rule,
                  )
                }
              />
            ),
          )}
        </View>
      </ScrollView>

      <Modal
        visible={
          modalOpen
        }
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() =>
          setModalOpen(
            false,
          )
        }
      >
        <SafeAreaView
          style={[
            styles.modalSafeArea,
            {
              backgroundColor:
                colors.page,
            },
          ]}
        >
          <KeyboardAvoidingView
            behavior={
              Platform.OS ===
              'ios'
                ? 'padding'
                : undefined
            }
            style={
              styles.modalKeyboard
            }
          >
            <View
              style={[
                styles.modalHeader,
                {
                  borderBottomColor:
                    colors.border,
                },
              ]}
            >
              <Pressable
                onPress={() =>
                  setModalOpen(
                    false,
                  )
                }
                style={
                  styles.modalAction
                }
              >
                <Text
                  style={[
                    styles.cancelText,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  Annuler
                </Text>
              </Pressable>

              <Text
                style={[
                  styles.modalTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Nouvelle règle
              </Text>

              <Pressable
                disabled={
                  saving
                }
                onPress={() =>
                  void submitRule()
                }
                style={
                  styles.modalAction
                }
              >
                {saving ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.text
                    }
                  />
                ) : (
                  <Text
                    style={[
                      styles.saveText,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    Ajouter
                  </Text>
                )}
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.modalContent
              }
            >
              <View
                style={[
                  styles.modalIntro,
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
                    styles.modalIntroIcon,
                    {
                      backgroundColor:
                        colors.surfaceStrong,
                    },
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color={
                      colors.text
                    }
                  />
                </View>

                <View
                  style={
                    styles.modalIntroCopy
                  }
                >
                  <Text
                    style={[
                      styles.modalIntroTitle,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {governanceMode ===
                    'assembly'
                      ? 'Proposer une nouvelle règle'
                      : 'Créer une nouvelle règle'}
                  </Text>

                  <Text
                    style={[
                      styles.modalIntroText,
                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    {governanceMode ===
                    'assembly'
                      ? 'Elle sera envoyée à l’assemblée et activée uniquement après adoption.'
                      : 'Elle sera active immédiatement sur ce portefeuille.'}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.formSectionTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Modèles rapides
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.templates
                }
              >
                {TEMPLATES.map(
                  (
                    template,
                  ) => (
                    <Pressable
                      key={
                        template.id
                      }
                      onPress={() =>
                        applyTemplate(
                          template,
                        )
                      }
                      style={[
                        styles.template,

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
                          styles.templateIcon,
                          {
                            backgroundColor:
                              colors.surfaceStrong,
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            template.icon
                          }
                          size={18}
                          color={
                            colors.text
                          }
                        />
                      </View>

                      <Text
                        numberOfLines={
                          2
                        }
                        style={[
                          styles.templateTitle,
                          {
                            color:
                              colors.text,
                          },
                        ]}
                      >
                        {
                          template.title
                        }
                      </Text>

                      <Text
                        style={[
                          styles.templateCategory,
                          {
                            color:
                              colors.textMuted,
                          },
                        ]}
                      >
                        {
                          template.category
                        }
                      </Text>
                    </Pressable>
                  ),
                )}
              </ScrollView>

              <Field
                label="Titre"
                value={
                  title
                }
                onChangeText={
                  setTitle
                }
                placeholder="Ex. Allocation maximale par actif"
                colors={
                  colors
                }
              />

              <Field
                label="Description"
                value={
                  description
                }
                onChangeText={
                  setDescription
                }
                placeholder="Explique clairement la règle…"
                colors={
                  colors
                }
                multiline
              />

              <Text
                style={[
                  styles.fieldLabel,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Catégorie
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.categoryOptions
                }
              >
                {CATEGORIES.map(
                  (
                    option,
                  ) => {
                    const active =
                      category ===
                      option;

                    return (
                      <Pressable
                        key={
                          option
                        }
                        onPress={() =>
                          setCategory(
                            option,
                          )
                        }
                        style={[
                          styles.categoryOption,

                          {
                            backgroundColor:
                              active
                                ? colors.brandFill
                                : colors.surface,

                            borderColor:
                              active
                                ? colors.brandFill
                                : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryOptionText,
                            {
                              color:
                                active
                                  ? colors.brandText
                                  : colors.text,
                            },
                          ]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </ScrollView>

              <Text
                style={[
                  styles.formSectionTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Paramètre
              </Text>

              <Text
                style={[
                  styles.helper,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Cette partie est facultative. Elle permet d’associer une valeur mesurable à la règle.
              </Text>

              <Field
                label="Clé"
                value={
                  parameterKey
                }
                onChangeText={
                  setParameterKey
                }
                placeholder="Ex. max_allocation"
                colors={
                  colors
                }
                autoCapitalize="none"
              />

              <View
                style={
                  styles.twoColumns
                }
              >
                <View
                  style={
                    styles.column
                  }
                >
                  <Field
                    label="Valeur"
                    value={
                      parameterValue
                    }
                    onChangeText={
                      setParameterValue
                    }
                    placeholder="25"
                    colors={
                      colors
                    }
                  />
                </View>

                <View
                  style={
                    styles.column
                  }
                >
                  <Field
                    label="Unité"
                    value={
                      unit
                    }
                    onChangeText={
                      setUnit
                    }
                    placeholder="%"
                    colors={
                      colors
                    }
                  />
                </View>
              </View>

              {error ? (
                <View
                  style={[
                    styles.modalError,
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
                    size={17}
                    color={
                      colors.negative
                    }
                  />

                  <Text
                    style={[
                      styles.modalErrorText,
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

              <Pressable
                disabled={
                  saving
                }
                onPress={() =>
                  void submitRule()
                }
                style={({
                  pressed,
                }) => [
                  styles.mainSubmit,

                  {
                    backgroundColor:
                      colors.brandFill,

                    opacity:
                      saving ||
                      pressed
                        ? 0.65
                        : 1,
                  },
                ]}
              >
                {saving ? (
                  <ActivityIndicator
                    color={
                      colors.brandText
                    }
                  />
                ) : (
                  <>
                    <Text
                      style={[
                        styles.mainSubmitText,
                        {
                          color:
                            colors.brandText,
                        },
                      ]}
                    >
                      {governanceMode ===
                      'assembly'
                        ? 'Soumettre à l’assemblée'
                        : 'Ajouter la règle'}
                    </Text>

                    <Ionicons
                      name="arrow-forward"
                      size={17}
                      color={
                        colors.brandText
                      }
                    />
                  </>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function MetricCard({
  icon,
  value,
  label,
}: {
  icon:
    | 'shield-checkmark-outline'
    | 'grid-outline'
    | 'archive-outline';

  value:
    number;

  label:
    string;
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
      <Ionicons
        name={
          icon
        }
        size={16}
        color={
          colors.textMuted
        }
      />

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

function FilterButton({
  label,
  active,
  onPress,
}: {
  label:
    string;

  active:
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
        styles.filterButton,

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
          styles.filterText,
          {
            color:
              active
                ? colors.text
                : colors.textMuted,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RuleCard({
  rule,
  canManage,
  loading,
  onStatusChange,
}: {
  rule:
    PortfolioRule;

  canManage:
    boolean;

  loading:
    boolean;

  onStatusChange:
    () => void;
}) {
  const {
    colors,
  } =
    useTerysoTheme();

  const entries =
    configEntries(
      rule.config ??
        {},
    );

  const archived =
    rule.status ===
    'archived';

  return (
    <View
      style={[
        styles.ruleCard,
        {
          backgroundColor:
            colors.surface,

          borderColor:
            colors.border,

          opacity:
            archived
              ? 0.72
              : 1,
        },
      ]}
    >
      <View
        style={
          styles.ruleCardTop
        }
      >
        <View
          style={[
            styles.categoryPill,
            {
              backgroundColor:
                colors.surfaceStrong,
            },
          ]}
        >
          <Text
            style={[
              styles.categoryPillText,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            {
              rule.category
            }
          </Text>
        </View>

        <View
          style={[
            styles.statusPill,
            {
              backgroundColor:
                archived
                  ? colors.surfaceStrong
                  : colors.accentSoft,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  archived
                    ? colors.textMuted
                    : colors.positive,
              },
            ]}
          />

          <Text
            style={[
              styles.statusText,
              {
                color:
                  archived
                    ? colors.textMuted
                    : colors.positive,
              },
            ]}
          >
            {archived
              ? 'Archivée'
              : 'Active'}
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.ruleTitle,
          {
            color:
              colors.text,
          },
        ]}
      >
        {
          rule.title
        }
      </Text>

      {rule.description ? (
        <Text
          style={[
            styles.ruleDescription,
            {
              color:
                colors.textSecondary,
            },
          ]}
        >
          {
            rule.description
          }
        </Text>
      ) : null}

      {entries.length >
      0 ? (
        <View
          style={
            styles.configEntries
          }
        >
          {entries.map(
            (
              entry,
              index,
            ) => (
              <View
                key={`${entry.label}-${index}`}
                style={[
                  styles.configEntry,
                  {
                    backgroundColor:
                      colors.surfaceStrong,
                  },
                ]}
              >
                <Text
                  numberOfLines={
                    1
                  }
                  style={[
                    styles.configLabel,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  {
                    entry.label
                  }
                </Text>

                <Text
                  numberOfLines={
                    1
                  }
                  style={[
                    styles.configValue,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  {
                    entry.value
                  }
                </Text>
              </View>
            ),
          )}
        </View>
      ) : null}

      <View
        style={[
          styles.ruleFooter,
          {
            borderTopColor:
              colors.border,
          },
        ]}
      >
        <View
          style={
            styles.ruleMeta
          }
        >
          <Ionicons
            name={
              rule.source_proposal_id
                ? 'people-outline'
                : 'calendar-outline'
            }
            size={13}
            color={
              colors.textMuted
            }
          />

          <Text
            style={[
              styles.ruleMetaText,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            {rule.source_proposal_id
              ? `Adoptée par l’assemblée · ${formatDate(
                  rule.adopted_at,
                )}`
              : `Ajoutée le ${formatDate(
                  rule.adopted_at ??
                    rule.created_at,
                )}`}
          </Text>
        </View>

        {canManage ? (
          <Pressable
            disabled={
              loading
            }
            onPress={
              onStatusChange
            }
            style={({
              pressed,
            }) => [
              styles.statusAction,

              {
                backgroundColor:
                  colors.surfaceStrong,

                opacity:
                  pressed ||
                  loading
                    ? 0.6
                    : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.textMuted
                }
              />
            ) : (
              <>
                <Ionicons
                  name={
                    archived
                      ? 'refresh-outline'
                      : 'archive-outline'
                  }
                  size={14}
                  color={
                    colors.textMuted
                  }
                />

                <Text
                  style={[
                    styles.statusActionText,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  {archived
                    ? 'Réactiver'
                    : 'Archiver'}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  multiline =
    false,
  autoCapitalize =
    'sentences',
}: {
  label:
    string;

  value:
    string;

  onChangeText:
    (
      value:
        string,
    ) => void;

  placeholder:
    string;

  colors:
    ReturnType<
      typeof useTerysoTheme
    >['colors'];

  multiline?:
    boolean;

  autoCapitalize?:
    'none'
    | 'sentences'
    | 'words'
    | 'characters';
}) {
  return (
    <View
      style={
        styles.field
      }
    >
      <Text
        style={[
          styles.fieldLabel,
          {
            color:
              colors.textMuted,
          },
        ]}
      >
        {label}
      </Text>

      <TextInput
        value={
          value
        }
        onChangeText={
          onChangeText
        }
        placeholder={
          placeholder
        }
        placeholderTextColor={
          colors.textMuted
        }
        multiline={
          multiline
        }
        autoCapitalize={
          autoCapitalize
        }
        style={[
          styles.input,

          multiline &&
            styles.textArea,

          {
            backgroundColor:
              colors.surface,

            borderColor:
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
    content: {
      paddingBottom:
        50,

      paddingHorizontal:
        20,

      paddingTop:
        20,
    },

    heading: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      marginBottom:
        17,
    },

    headingCopy: {
      flex: 1,
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
        11,
    },

    addButtonText: {
      fontSize:
        10,

      fontWeight:
        '900',
    },

    metrics: {
      flexDirection:
        'row',

      gap:
        8,

      marginBottom:
        14,
    },

    metricCard: {
      borderRadius:
        14,

      borderWidth:
        1,

      flex:
        1,

      minHeight:
        90,

      padding:
        11,
    },

    metricValue: {
      fontSize:
        18,

      fontWeight:
        '900',

      marginTop:
        8,
    },

    metricLabel: {
      fontSize:
        8,

      fontWeight:
        '700',

      marginTop:
        2,
    },

    governanceNotice: {
      alignItems:
        'center',

      borderRadius:
        15,

      borderWidth:
        1,

      flexDirection:
        'row',

      gap:
        11,

      marginBottom:
        13,

      padding:
        13,
    },

    noticeIcon: {
      alignItems:
        'center',

      borderRadius:
        11,

      height:
        38,

      justifyContent:
        'center',

      width:
        38,
    },

    noticeCopy: {
      flex: 1,
    },

    noticeTitle: {
      fontSize:
        10.5,

      fontWeight:
        '900',
    },

    noticeDescription: {
      fontSize:
        8.5,

      lineHeight:
        13,

      marginTop:
        3,
    },

    message: {
      alignItems:
        'flex-start',

      borderRadius:
        12,

      borderWidth:
        1,

      flexDirection:
        'row',

      gap:
        8,

      marginBottom:
        12,

      padding:
        11,
    },

    messageText: {
      flex: 1,

      fontSize:
        9.5,

      lineHeight:
        14,
    },

    filters: {
      borderRadius:
        12,

      flexDirection:
        'row',

      gap:
        3,

      marginBottom:
        15,

      padding:
        4,
    },

    filterButton: {
      alignItems:
        'center',

      borderRadius:
        9,

      flex: 1,

      justifyContent:
        'center',

      minHeight:
        38,
    },

    filterText: {
      fontSize:
        9,

      fontWeight:
        '900',
    },

    loading: {
      alignItems:
        'center',

      paddingVertical:
        60,
    },

    rules: {
      gap:
        10,
    },

    ruleCard: {
      borderRadius:
        17,

      borderWidth:
        1,

      padding:
        14,
    },

    ruleCardTop: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'space-between',
    },

    categoryPill: {
      borderRadius:
        999,

      paddingHorizontal:
        8,

      paddingVertical:
        5,
    },

    categoryPillText: {
      fontSize:
        7.5,

      fontWeight:
        '900',

      textTransform:
        'uppercase',
    },

    statusPill: {
      alignItems:
        'center',

      borderRadius:
        999,

      flexDirection:
        'row',

      gap:
        5,

      paddingHorizontal:
        8,

      paddingVertical:
        5,
    },

    statusDot: {
      borderRadius:
        999,

      height:
        5,

      width:
        5,
    },

    statusText: {
      fontSize:
        7.5,

      fontWeight:
        '900',
    },

    ruleTitle: {
      fontSize:
        15,

      fontWeight:
        '900',

      lineHeight:
        20,

      marginTop:
        12,
    },

    ruleDescription: {
      fontSize:
        10,

      lineHeight:
        15,

      marginTop:
        5,
    },

    configEntries: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        7,

      marginTop:
        13,
    },

    configEntry: {
      borderRadius:
        10,

      minWidth:
        90,

      paddingHorizontal:
        9,

      paddingVertical:
        7,
    },

    configLabel: {
      fontSize:
        7,

      fontWeight:
        '700',

      textTransform:
        'capitalize',
    },

    configValue: {
      fontSize:
        10,

      fontWeight:
        '900',

      marginTop:
        2,
    },

    ruleFooter: {
      alignItems:
        'center',

      borderTopWidth:
        StyleSheet.hairlineWidth,

      flexDirection:
        'row',

      justifyContent:
        'space-between',

      marginTop:
        13,

      paddingTop:
        10,
    },

    ruleMeta: {
      alignItems:
        'center',

      flex:
        1,

      flexDirection:
        'row',

      gap:
        5,
    },

    ruleMetaText: {
      flex: 1,

      fontSize:
        7.5,

      lineHeight:
        11,
    },

    statusAction: {
      alignItems:
        'center',

      borderRadius:
        9,

      flexDirection:
        'row',

      gap:
        4,

      marginLeft:
        7,

      minHeight:
        32,

      paddingHorizontal:
        8,
    },

    statusActionText: {
      fontSize:
        8,

      fontWeight:
        '900',
    },

    empty: {
      alignItems:
        'center',

      borderRadius:
        17,

      borderWidth:
        1,

      paddingHorizontal:
        24,

      paddingVertical:
        38,
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

    emptyDescription: {
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

    emptyButton: {
      alignItems:
        'center',

      borderRadius:
        11,

      flexDirection:
        'row',

      gap:
        5,

      justifyContent:
        'center',

      marginTop:
        16,

      minHeight:
        42,

      paddingHorizontal:
        14,
    },

    emptyButtonText: {
      fontSize:
        9.5,

      fontWeight:
        '900',
    },

    modalSafeArea: {
      flex: 1,
    },

    modalKeyboard: {
      flex: 1,
    },

    modalHeader: {
      alignItems:
        'center',

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      flexDirection:
        'row',

      minHeight:
        58,

      paddingHorizontal:
        6,
    },

    modalAction: {
      alignItems:
        'center',

      justifyContent:
        'center',

      minHeight:
        44,

      minWidth:
        70,
    },

    modalTitle: {
      flex: 1,

      fontSize:
        14,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    cancelText: {
      fontSize:
        11,

      fontWeight:
        '800',
    },

    saveText: {
      fontSize:
        11,

      fontWeight:
        '900',
    },

    modalContent: {
      paddingBottom:
        50,

      paddingHorizontal:
        18,

      paddingTop:
        16,
    },

    modalIntro: {
      alignItems:
        'center',

      borderRadius:
        16,

      borderWidth:
        1,

      flexDirection:
        'row',

      gap:
        11,

      padding:
        13,
    },

    modalIntroIcon: {
      alignItems:
        'center',

      borderRadius:
        12,

      height:
        40,

      justifyContent:
        'center',

      width:
        40,
    },

    modalIntroCopy: {
      flex: 1,
    },

    modalIntroTitle: {
      fontSize:
        11,

      fontWeight:
        '900',
    },

    modalIntroText: {
      fontSize:
        8.5,

      lineHeight:
        13,

      marginTop:
        3,
    },

    formSectionTitle: {
      fontSize:
        13,

      fontWeight:
        '900',

      marginTop:
        22,
    },

    templates: {
      gap:
        8,

      paddingRight:
        8,

      paddingTop:
        10,
    },

    template: {
      borderRadius:
        14,

      borderWidth:
        1,

      minHeight:
        135,

      padding:
        11,

      width:
        155,
    },

    templateIcon: {
      alignItems:
        'center',

      borderRadius:
        10,

      height:
        34,

      justifyContent:
        'center',

      width:
        34,
    },

    templateTitle: {
      fontSize:
        10,

      fontWeight:
        '900',

      lineHeight:
        14,

      marginTop:
        12,
    },

    templateCategory: {
      fontSize:
        8,

      marginTop:
        5,
    },

    field: {
      marginTop:
        17,
    },

    fieldLabel: {
      fontSize:
        8.5,

      fontWeight:
        '900',

      marginBottom:
        7,

      textTransform:
        'uppercase',
    },

    input: {
      borderRadius:
        12,

      borderWidth:
        1,

      fontSize:
        12,

      minHeight:
        47,

      paddingHorizontal:
        12,

      paddingVertical:
        10,
    },

    textArea: {
      minHeight:
        105,

      textAlignVertical:
        'top',
    },

    categoryOptions: {
      gap:
        7,

      paddingRight:
        8,
    },

    categoryOption: {
      borderRadius:
        999,

      borderWidth:
        1,

      paddingHorizontal:
        10,

      paddingVertical:
        8,
    },

    categoryOptionText: {
      fontSize:
        9,

      fontWeight:
        '900',
    },

    helper: {
      fontSize:
        9,

      lineHeight:
        14,

      marginTop:
        5,
    },

    twoColumns: {
      flexDirection:
        'row',

      gap:
        9,
    },

    column: {
      flex: 1,
    },

    modalError: {
      alignItems:
        'flex-start',

      borderRadius:
        12,

      borderWidth:
        1,

      flexDirection:
        'row',

      gap:
        7,

      marginTop:
        18,

      padding:
        11,
    },

    modalErrorText: {
      flex: 1,

      fontSize:
        9.5,

      lineHeight:
        14,
    },

    mainSubmit: {
      alignItems:
        'center',

      borderRadius:
        14,

      flexDirection:
        'row',

      gap:
        7,

      justifyContent:
        'center',

      marginTop:
        22,

      minHeight:
        50,
    },

    mainSubmitText: {
      fontSize:
        11,

      fontWeight:
        '900',
    },
  });