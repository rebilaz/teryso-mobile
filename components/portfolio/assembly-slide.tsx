import Ionicons from '@expo/vector-icons/Ionicons';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

type Numeric =
  | number
  | string
  | null;

type Choice =
  | 'for'
  | 'against';

type Proposal = {
  id: string;
  rule_title: string;
  rule_description: string;
  status: string;
  opens_at: string;
  closes_at: string;
  quorum_votes: number;

  proposer_type:
    | 'user'
    | 'ai';
};

type VoteSummary = {
  proposal_id: string;

  votes_for: Numeric;

  votes_against: Numeric;

  viewer_choice:
    Choice | null;
};

type AssemblySummary = {
  human_members: Numeric;

  ai_members: Numeric;

  viewer_can_propose: boolean;

  viewer_can_vote: boolean;
};

const STATUS_LABELS:
  Record<
    string,
    string
  > = {
  draft:
    'Brouillon',

  open:
    'Ouverte',

  approved:
    'Adoptée',

  executed:
    'Appliquée',

  rejected:
    'Rejetée',

  expired:
    'Expirée',

  cancelled:
    'Annulée',

  passed:
    'Adoptée',
};

const ACTION_TYPES = [
  {
    value:
      'change_rule_limit',

    label:
      'Modifier une limite',
  },

  {
    value:
      'add_allowed_asset',

    label:
      'Ajouter un actif',
  },

  {
    value:
      'remove_allowed_asset',

    label:
      'Retirer un actif',
  },

  {
    value:
      'change_min_cash',

    label:
      'Minimum de cash',
  },

  {
    value:
      'change_max_allocation',

    label:
      'Allocation maximale',
  },

  {
    value:
      'change_strategy_parameter',

    label:
      'Paramètre stratégie',
  },
] as const;

type ActionType =
  (typeof ACTION_TYPES)[number]['value'];

type Colors =
  ReturnType<
    typeof useTerysoTheme
  >['colors'];

/*
 * IMPORTANT :
 * export nommé attendu par
 * portfolio-layout.tsx
 */
export function AssemblySlide() {
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
    proposals,
    setProposals,
  ] =
    useState<
      Proposal[]
    >([]);

  const [
    votes,
    setVotes,
  ] =
    useState<
      Map<
        string,
        VoteSummary
      >
    >(
      new Map(),
    );

  const [
    summary,
    setSummary,
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
    modalOpen,
    setModalOpen,
  ] =
    useState(false);

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
    ruleKey,
    setRuleKey,
  ] =
    useState('');

  const [
    proposedValue,
    setProposedValue,
  ] =
    useState('');

  const [
    actionType,
    setActionType,
  ] =
    useState<ActionType>(
      'change_rule_limit',
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const load =
    useCallback(
      async (
        refresh =
          false,
      ) => {
        if (
          !selectedPortfolio ||
          !selectedPortfolioId
        ) {
          setProposals([]);

          setVotes(
            new Map(),
          );

          setSummary(null);

          setLoading(false);
          setRefreshing(false);

          return;
        }

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        try {
          const [
            proposalsResult,
            assemblyResult,
            votesResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  'governance_proposals',
                )
                .select(
                  [
                    'id',
                    'rule_title',
                    'rule_description',
                    'status',
                    'opens_at',
                    'closes_at',
                    'quorum_votes',
                    'proposer_type',
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
                ),

              selectedPortfolio
                .governance_mode ===
              'assembly'
                ? supabase.rpc(
                    'get_portfolio_assembly_summary',
                    {
                      p_portfolio_id:
                        selectedPortfolioId,
                    },
                  )
                : Promise.resolve({
                    data: [],
                    error: null,
                  }),

              supabase.rpc(
                'get_portfolio_proposal_vote_summary',
                {
                  p_portfolio_id:
                    selectedPortfolioId,
                },
              ),
            ]);

          const firstError =
            proposalsResult.error ??
            assemblyResult.error ??
            votesResult.error;

          if (firstError) {
            throw firstError;
          }

          setProposals(
            (proposalsResult.data ??
              []) as unknown as Proposal[],
          );

          const assemblyRows =
            (assemblyResult.data ??
              []) as AssemblySummary[];

          setSummary(
            assemblyRows[0] ??
              null,
          );

          const voteRows =
            (votesResult.data ??
              []) as VoteSummary[];

          setVotes(
            new Map(
              voteRows.map(
                (vote) => [
                  vote.proposal_id,
                  vote,
                ],
              ),
            ),
          );
        } catch (
          loadError
        ) {
          console.error(
            '[AssemblySlide]',
            loadError,
          );

          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Impossible de charger l’assemblée.',
          );
        } finally {
          setLoading(false);

          setRefreshing(false);
        }
      },
      [
        selectedPortfolio,
        selectedPortfolioId,
      ],
    );

  useEffect(() => {
    void load();
  }, [
    load,
    refreshKey,
  ]);

  const assemblyMode =
    selectedPortfolio
      ?.governance_mode ===
    'assembly';

  const isOwner =
    Boolean(
      selectedPortfolio &&
        session?.user.id ===
          selectedPortfolio.user_id,
    );

  const canPropose =
    selectedPortfolio
      ?.governance_mode ===
    'owner'
      ? isOwner
      : Boolean(
          summary
            ?.viewer_can_propose,
        );

  const canVote =
    Boolean(
      assemblyMode &&
        summary?.viewer_can_vote,
    );

  async function vote(
    proposalId: string,
    choice: Choice,
  ) {
    try {
      const {
        error:
          voteError,
      } =
        await supabase.rpc(
          'cast_governance_vote',
          {
            p_proposal_id:
              proposalId,

            p_choice:
              choice,
          },
        );

      if (voteError) {
        throw voteError;
      }

      await load(true);
    } catch (
      voteError
    ) {
      Alert.alert(
        'Vote impossible',

        voteError instanceof Error
          ? voteError.message
          : 'Impossible d’enregistrer le vote.',
      );
    }
  }

  async function decide(
    proposalId: string,

    decision:
      | 'approve'
      | 'cancel',
  ) {
    try {
      const {
        error:
          decisionError,
      } =
        await supabase.rpc(
          'decide_owner_proposal',
          {
            p_proposal_id:
              proposalId,

            p_decision:
              decision,
          },
        );

      if (decisionError) {
        throw decisionError;
      }

      await load(true);
    } catch (
      decisionError
    ) {
      Alert.alert(
        'Action impossible',

        decisionError instanceof Error
          ? decisionError.message
          : 'Impossible d’effectuer cette action.',
      );
    }
  }

  async function createProposal() {
    if (
      !selectedPortfolioId
    ) {
      return;
    }

    const cleanTitle =
      title.trim();

    if (
      cleanTitle.length <
      3
    ) {
      Alert.alert(
        'Titre requis',
        'Le titre doit contenir au moins 3 caractères.',
      );

      return;
    }

    setSaving(true);

    try {
      const {
        error:
          createError,
      } =
        await supabase.rpc(
          'create_governance_proposal',
          {
            p_portfolio_id:
              selectedPortfolioId,

            p_title:
              cleanTitle,

            p_description:
              description.trim(),

            p_action_type:
              actionType,

            p_payload: {
              rule_key:
                ruleKey.trim() ||
                null,

              proposed_value:
                proposedValue.trim() ||
                null,
            },
          },
        );

      if (createError) {
        throw createError;
      }

      setModalOpen(false);

      setTitle('');

      setDescription('');

      setRuleKey('');

      setProposedValue('');

      setActionType(
        'change_rule_limit',
      );

      await load(true);
    } catch (
      createError
    ) {
      Alert.alert(
        'Création impossible',

        createError instanceof Error
          ? createError.message
          : 'Impossible de créer la proposition.',
      );
    } finally {
      setSaving(false);
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
              {assemblyMode
                ? 'Assemblée'
                : 'Propositions'}
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
              {proposals.length}{' '}
              proposition
              {proposals.length !==
              1
                ? 's'
                : ''}
            </Text>
          </View>

          {canPropose ? (
            <Pressable
              onPress={() =>
                setModalOpen(
                  true,
                )
              }
              style={({
                pressed,
              }) => [
                styles.newButton,

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
                  styles.newButtonText,
                  {
                    color:
                      colors.brandText,
                  },
                ]}
              >
                Nouvelle
              </Text>
            </Pressable>
          ) : null}
        </View>

        {assemblyMode ? (
          <View
            style={
              styles.summaryGrid
            }
          >
            <SummaryCard
              icon="people-outline"
              label="Humains"
              value={String(
                Number(
                  summary
                    ?.human_members ??
                    0,
                ),
              )}
            />

            <SummaryCard
              icon="hardware-chip-outline"
              label="IA"
              value={String(
                Number(
                  summary
                    ?.ai_members ??
                    0,
                ),
              )}
            />
          </View>
        ) : (
          <View
            style={[
              styles.ownerNotice,
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
                name="person-outline"
                size={17}
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
                Gouvernance propriétaire
              </Text>

              <Text
                style={[
                  styles.noticeText,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Les propositions sont décidées directement par le propriétaire du portefeuille.
              </Text>
            </View>
          </View>
        )}

        {error ? (
          <View
            style={[
              styles.errorBox,
              {
                borderColor:
                  colors.border,

                backgroundColor:
                  colors.surface,
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
        proposals.length ===
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
                name="people-outline"
                size={22}
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
              Aucune proposition
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
              Les nouvelles décisions du portefeuille apparaîtront ici.
            </Text>
          </View>
        ) : null}

        <View
          style={
            styles.cards
          }
        >
          {proposals.map(
            (proposal) => {
              const voteSummary =
                votes.get(
                  proposal.id,
                );

              const myVote =
                voteSummary
                  ?.viewer_choice;

              const closesAt =
                new Date(
                  proposal.closes_at,
                );

              const isOpen =
                proposal.status ===
                  'open' &&
                !Number.isNaN(
                  closesAt.getTime(),
                ) &&
                closesAt.getTime() >
                  Date.now();

              const eligible =
                canVote &&
                isOpen;

              return (
                <View
                  key={
                    proposal.id
                  }
                  style={[
                    styles.card,
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
                      styles.cardTop
                    }
                  >
                    <StatusPill
                      status={
                        proposal.status
                      }
                      colors={
                        colors
                      }
                    />

                    <View
                      style={
                        styles.proposerRow
                      }
                    >
                      <Ionicons
                        name={
                          proposal.proposer_type ===
                          'ai'
                            ? 'hardware-chip-outline'
                            : 'person-outline'
                        }
                        size={13}
                        color={
                          colors.textMuted
                        }
                      />

                      <Text
                        style={[
                          styles.proposer,
                          {
                            color:
                              colors.textMuted,
                          },
                        ]}
                      >
                        {proposal.proposer_type ===
                        'ai'
                          ? 'IA'
                          : 'Humain'}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {
                      proposal.rule_title
                    }
                  </Text>

                  {proposal.rule_description ? (
                    <Text
                      style={[
                        styles.cardDescription,
                        {
                          color:
                            colors.textSecondary,
                        },
                      ]}
                    >
                      {
                        proposal.rule_description
                      }
                    </Text>
                  ) : null}

                  <View
                    style={
                      styles.dateRow
                    }
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={13}
                      color={
                        colors.textMuted
                      }
                    />

                    <Text
                      style={[
                        styles.cardDate,
                        {
                          color:
                            colors.textMuted,
                        },
                      ]}
                    >
                      {formatDate(
                        proposal.opens_at,
                      )}
                      {' → '}
                      {formatDate(
                        proposal.closes_at,
                      )}
                    </Text>
                  </View>

                  {assemblyMode ? (
                    <>
                      <View
                        style={
                          styles.voteCounts
                        }
                      >
                        <View
                          style={[
                            styles.voteCount,
                            {
                              backgroundColor:
                                colors.accentSoft,
                            },
                          ]}
                        >
                          <Ionicons
                            name="thumbs-up-outline"
                            size={14}
                            color={
                              colors.positive
                            }
                          />

                          <Text
                            style={[
                              styles.voteCountText,
                              {
                                color:
                                  colors.positive,
                              },
                            ]}
                          >
                            {Number(
                              voteSummary
                                ?.votes_for ??
                                0,
                            )}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.voteCount,
                            {
                              backgroundColor:
                                colors.surfaceStrong,
                            },
                          ]}
                        >
                          <Ionicons
                            name="thumbs-down-outline"
                            size={14}
                            color={
                              colors.negative
                            }
                          />

                          <Text
                            style={[
                              styles.voteCountText,
                              {
                                color:
                                  colors.negative,
                              },
                            ]}
                          >
                            {Number(
                              voteSummary
                                ?.votes_against ??
                                0,
                            )}
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.quorum,
                            {
                              color:
                                colors.textMuted,
                            },
                          ]}
                        >
                          Quorum{' '}
                          {
                            proposal.quorum_votes
                          }
                        </Text>
                      </View>

                      <View
                        style={
                          styles.actions
                        }
                      >
                        <Pressable
                          disabled={
                            !eligible
                          }
                          onPress={() =>
                            void vote(
                              proposal.id,
                              'for',
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.actionButton,

                            {
                              borderColor:
                                myVote ===
                                'for'
                                  ? colors.positive
                                  : colors.border,

                              backgroundColor:
                                myVote ===
                                'for'
                                  ? colors.accentSoft
                                  : colors.surface,

                              opacity:
                                !eligible
                                  ? 0.4
                                  : pressed
                                    ? 0.7
                                    : 1,
                            },
                          ]}
                        >
                          <Ionicons
                            name="thumbs-up-outline"
                            size={15}
                            color={
                              colors.positive
                            }
                          />

                          <Text
                            style={[
                              styles.actionText,
                              {
                                color:
                                  colors.positive,
                              },
                            ]}
                          >
                            Pour
                          </Text>
                        </Pressable>

                        <Pressable
                          disabled={
                            !eligible
                          }
                          onPress={() =>
                            void vote(
                              proposal.id,
                              'against',
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.actionButton,

                            {
                              borderColor:
                                myVote ===
                                'against'
                                  ? colors.negative
                                  : colors.border,

                              backgroundColor:
                                colors.surface,

                              opacity:
                                !eligible
                                  ? 0.4
                                  : pressed
                                    ? 0.7
                                    : 1,
                            },
                          ]}
                        >
                          <Ionicons
                            name="thumbs-down-outline"
                            size={15}
                            color={
                              colors.negative
                            }
                          />

                          <Text
                            style={[
                              styles.actionText,
                              {
                                color:
                                  colors.negative,
                              },
                            ]}
                          >
                            Contre
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  ) : isOwner &&
                    proposal.status ===
                      'open' ? (
                    <View
                      style={
                        styles.actions
                      }
                    >
                      <Pressable
                        onPress={() =>
                          void decide(
                            proposal.id,
                            'approve',
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.actionButton,

                          {
                            backgroundColor:
                              colors.brandFill,

                            borderColor:
                              colors.brandFill,

                            opacity:
                              pressed
                                ? 0.7
                                : 1,
                          },
                        ]}
                      >
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={
                            colors.brandText
                          }
                        />

                        <Text
                          style={[
                            styles.actionText,
                            {
                              color:
                                colors.brandText,
                            },
                          ]}
                        >
                          Appliquer
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          void decide(
                            proposal.id,
                            'cancel',
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.actionButton,

                          {
                            borderColor:
                              colors.border,

                            opacity:
                              pressed
                                ? 0.7
                                : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.actionText,
                            {
                              color:
                                colors.text,
                            },
                          ]}
                        >
                          Annuler
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            },
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
                  styles.modalCancel,
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
              Nouvelle proposition
            </Text>

            <Pressable
              disabled={
                saving
              }
              onPress={() =>
                void createProposal()
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
                    styles.modalCreate,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  Créer
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
            <Field
              label="Titre"
              value={
                title
              }
              onChangeText={
                setTitle
              }
              placeholder="Ex. Réduire l’exposition maximale"
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
              placeholder="Décris la modification proposée…"
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
              Type d’action
            </Text>

            <View
              style={
                styles.chips
              }
            >
              {ACTION_TYPES.map(
                (option) => {
                  const active =
                    option.value ===
                    actionType;

                  return (
                    <Pressable
                      key={
                        option.value
                      }
                      onPress={() =>
                        setActionType(
                          option.value,
                        )
                      }
                      style={[
                        styles.chip,

                        {
                          borderColor:
                            active
                              ? colors.borderStrong
                              : colors.border,

                          backgroundColor:
                            active
                              ? colors.surfaceStrong
                              : colors.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color:
                              active
                                ? colors.text
                                : colors.textMuted,
                          },
                        ]}
                      >
                        {
                          option.label
                        }
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>

            <Field
              label="Règle concernée"
              value={
                ruleKey
              }
              onChangeText={
                setRuleKey
              }
              placeholder="Ex. max_allocation"
              colors={
                colors
              }
            />

            <Field
              label="Nouvelle valeur"
              value={
                proposedValue
              }
              onChangeText={
                setProposedValue
              }
              placeholder="Ex. 25"
              colors={
                colors
              }
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon:
    | 'people-outline'
    | 'hardware-chip-outline';

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
        styles.summaryCard,
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
          styles.summaryIcon,
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
          styles.summaryLabel,
          {
            color:
              colors.textMuted,
          },
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.summaryValue,
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

function StatusPill({
  status,
  colors,
}: {
  status: string;

  colors: Colors;
}) {
  const positive =
    status ===
      'approved' ||
    status ===
      'executed' ||
    status ===
      'passed';

  const negative =
    status ===
      'rejected' ||
    status ===
      'cancelled' ||
    status ===
      'expired';

  return (
    <View
      style={[
        styles.status,

        {
          borderColor:
            positive
              ? colors.positive
              : negative
                ? colors.negative
                : colors.border,

          backgroundColor:
            positive
              ? colors.accentSoft
              : colors.surfaceStrong,
        },
      ]}
    >
      <Text
        style={[
          styles.statusText,
          {
            color:
              positive
                ? colors.positive
                : negative
                  ? colors.negative
                  : colors.textSecondary,
          },
        ]}
      >
        {STATUS_LABELS[
          status
        ] ??
          status}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  multiline = false,
}: {
  label: string;

  value: string;

  onChangeText: (
    value: string,
  ) => void;

  placeholder:
    string;

  colors:
    Colors;

  multiline?:
    boolean;
}) {
  return (
    <>
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
        value={value}
        onChangeText={
          onChangeText
        }
        multiline={
          multiline
        }
        placeholder={
          placeholder
        }
        placeholderTextColor={
          colors.textMuted
        }
        style={[
          styles.input,

          multiline &&
            styles.textArea,

          {
            color:
              colors.text,

            borderColor:
              colors.border,

            backgroundColor:
              colors.surface,
          },
        ]}
      />
    </>
  );
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
      fontSize: 21,

      fontWeight:
        '900',

      letterSpacing:
        -0.5,
    },

    subtitle: {
      fontSize: 10,

      marginTop: 4,
    },

    newButton: {
      alignItems:
        'center',

      borderRadius: 12,

      flexDirection:
        'row',

      gap: 4,

      minHeight: 40,

      paddingHorizontal:
        11,
    },

    newButtonText: {
      fontSize: 10,

      fontWeight:
        '900',
    },

    summaryGrid: {
      flexDirection:
        'row',

      gap: 10,

      marginBottom:
        18,
    },

    summaryCard: {
      borderRadius: 15,

      borderWidth: 1,

      flex: 1,

      minHeight: 112,

      padding: 13,
    },

    summaryIcon: {
      alignItems:
        'center',

      borderRadius: 10,

      height: 32,

      justifyContent:
        'center',

      width: 32,
    },

    summaryLabel: {
      fontSize: 9,

      marginTop: 9,
    },

    summaryValue: {
      fontSize: 19,

      fontWeight:
        '900',

      marginTop: 3,
    },

    ownerNotice: {
      alignItems:
        'center',

      borderRadius: 15,

      borderWidth: 1,

      flexDirection:
        'row',

      gap: 11,

      marginBottom: 18,

      padding: 13,
    },

    noticeIcon: {
      alignItems:
        'center',

      borderRadius: 11,

      height: 36,

      justifyContent:
        'center',

      width: 36,
    },

    noticeCopy: {
      flex: 1,
    },

    noticeTitle: {
      fontSize: 11,

      fontWeight:
        '900',
    },

    noticeText: {
      fontSize: 9,

      lineHeight: 14,

      marginTop: 3,
    },

    errorBox: {
      alignItems:
        'flex-start',

      borderRadius: 12,

      borderWidth: 1,

      flexDirection:
        'row',

      gap: 8,

      marginBottom: 14,

      padding: 11,
    },

    errorText: {
      flex: 1,

      fontSize: 10,

      lineHeight: 15,
    },

    loading: {
      alignItems:
        'center',

      paddingVertical: 50,
    },

    cards: {
      gap: 11,
    },

    card: {
      borderRadius: 16,

      borderWidth: 1,

      padding: 15,
    },

    cardTop: {
      alignItems:
        'center',

      flexDirection:
        'row',

      justifyContent:
        'space-between',
    },

    status: {
      borderRadius: 999,

      borderWidth: 1,

      paddingHorizontal: 8,

      paddingVertical: 4,
    },

    statusText: {
      fontSize: 8.5,

      fontWeight:
        '900',

      textTransform:
        'uppercase',
    },

    proposerRow: {
      alignItems:
        'center',

      flexDirection:
        'row',

      gap: 4,
    },

    proposer: {
      fontSize: 9,

      fontWeight:
        '800',
    },

    cardTitle: {
      fontSize: 15,

      fontWeight:
        '900',

      lineHeight: 21,

      marginTop: 12,
    },

    cardDescription: {
      fontSize: 11,

      lineHeight: 17,

      marginTop: 5,
    },

    dateRow: {
      alignItems:
        'center',

      flexDirection:
        'row',

      gap: 5,

      marginTop: 10,
    },

    cardDate: {
      fontSize: 9,
    },

    voteCounts: {
      alignItems:
        'center',

      flexDirection:
        'row',

      gap: 7,

      marginTop: 12,
    },

    voteCount: {
      alignItems:
        'center',

      borderRadius: 9,

      flexDirection:
        'row',

      gap: 5,

      paddingHorizontal: 8,

      paddingVertical: 5,
    },

    voteCountText: {
      fontSize: 11,

      fontWeight:
        '900',
    },

    quorum: {
      fontSize: 9,

      marginLeft:
        'auto',
    },

    actions: {
      flexDirection:
        'row',

      gap: 8,

      marginTop: 13,
    },

    actionButton: {
      alignItems:
        'center',

      borderRadius: 10,

      borderWidth: 1,

      flex: 1,

      flexDirection:
        'row',

      gap: 5,

      justifyContent:
        'center',

      minHeight: 40,
    },

    actionText: {
      fontSize: 11,

      fontWeight:
        '900',
    },

    empty: {
      alignItems:
        'center',

      borderRadius: 16,

      borderWidth: 1,

      paddingHorizontal: 25,

      paddingVertical: 36,
    },

    emptyIcon: {
      alignItems:
        'center',

      borderRadius: 999,

      height: 44,

      justifyContent:
        'center',

      width: 44,
    },

    emptyTitle: {
      fontSize: 14,

      fontWeight:
        '900',

      marginTop: 10,
    },

    emptyText: {
      fontSize: 9.5,

      lineHeight: 15,

      marginTop: 5,

      maxWidth: 240,

      textAlign:
        'center',
    },

    modalSafeArea: {
      flex: 1,
    },

    modalHeader: {
      alignItems:
        'center',

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      flexDirection:
        'row',

      minHeight: 58,

      paddingHorizontal: 7,
    },

    modalAction: {
      alignItems:
        'center',

      justifyContent:
        'center',

      minHeight: 44,

      minWidth: 68,
    },

    modalCancel: {
      fontSize: 12,

      fontWeight:
        '800',
    },

    modalCreate: {
      fontSize: 12,

      fontWeight:
        '900',
    },

    modalTitle: {
      flex: 1,

      fontSize: 14,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    modalContent: {
      paddingBottom: 50,

      paddingHorizontal: 20,
    },

    fieldLabel: {
      fontSize: 10,

      fontWeight:
        '800',

      marginBottom: 7,

      marginTop: 18,

      textTransform:
        'uppercase',
    },

    input: {
      borderRadius: 12,

      borderWidth: 1,

      fontSize: 13,

      minHeight: 47,

      paddingHorizontal: 12,

      paddingVertical: 11,
    },

    textArea: {
      minHeight: 115,

      textAlignVertical:
        'top',
    },

    chips: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap: 7,
    },

    chip: {
      borderRadius: 999,

      borderWidth: 1,

      paddingHorizontal: 10,

      paddingVertical: 7,
    },

    chipText: {
      fontSize: 10,

      fontWeight:
        '800',
    },
  });