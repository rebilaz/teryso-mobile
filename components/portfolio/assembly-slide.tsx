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

import { usePortfolioSwipe } from '@/components/portfolio/portfolio-swipe-context';
import { useAuth } from '@/contexts/auth-context';
import { useTerysoTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';

type Numeric = number | string | null;
type Choice = 'for' | 'against';
type RuleStatus = 'active' | 'archived';
type RuleConfig = Record<string, unknown>;

type PortfolioRule = {
  id: string;
  portfolio_id: string;
  title: string;
  description: string;
  category: string;
  config: RuleConfig;
  status: RuleStatus;
};

type Proposal = {
  id: string;
  title: string;
  description: string;
  rule_title: string;
  rule_description: string;
  rule_category: string;
  rule_config: RuleConfig;
  target_rule_id: string | null;
  old_value: unknown;
  new_value: unknown;
  payload: Record<string, unknown>;
  status: string;
  opens_at: string;
  closes_at: string;
  quorum_votes: number;
  proposer_type: 'user' | 'ai';
};

type VoteSummary = {
  proposal_id: string;
  votes_for: Numeric;
  votes_against: Numeric;
  viewer_choice: Choice | null;
};

type AssemblySummary = {
  human_members: Numeric;
  ai_members: Numeric;
  viewer_can_propose: boolean;
  viewer_can_vote: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  open: 'Ouverte',
  approved: 'Adoptée',
  executed: 'Appliquée',
  rejected: 'Rejetée',
  expired: 'Expirée',
  cancelled: 'Annulée',
  passed: 'Adoptée',
};

function finiteNumber(value: Numeric) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function displayScalar(value: unknown) {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'number') {
    return value.toLocaleString('fr-FR', {
      maximumFractionDigits: 4,
    });
  }

  if (typeof value === 'string') {
    return value || '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }

  return '—';
}

function configValue(rule: PortfolioRule) {
  return displayScalar(rule.config?.value);
}

function configUnit(rule: PortfolioRule) {
  return typeof rule.config?.unit === 'string'
    ? rule.config.unit
    : '';
}

function proposalUnit(proposal: Proposal) {
  const payload = proposal.payload ?? {};

  if (typeof payload.unit === 'string') {
    return payload.unit;
  }

  const proposedConfig = payload.proposed_config;

  if (
    proposedConfig &&
    typeof proposedConfig === 'object' &&
    !Array.isArray(proposedConfig)
  ) {
    const unit = (proposedConfig as Record<string, unknown>).unit;

    if (typeof unit === 'string') {
      return unit;
    }
  }

  return '';
}

function normalizeProposalValue(value: string) {
  const clean = value.trim();

  if (!clean) {
    return null;
  }

  const numeric = Number(clean.replace(',', '.'));

  return Number.isFinite(numeric) ? numeric : clean;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  });
}

export function AssemblySlide() {
  const { colors } = useTerysoTheme();
  const { session } = useAuth();

  const {
    selectedPortfolio,
    selectedPortfolioId,
    refreshKey,
  } = usePortfolioSwipe();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [rules, setRules] = useState<PortfolioRule[]>([]);
  const [votes, setVotes] = useState<Map<string, VoteSummary>>(
    new Map(),
  );
  const [summary, setSummary] =
    useState<AssemblySummary | null>(null);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRuleId, setSelectedRuleId] =
    useState<string | null>(null);
  const [proposedValue, setProposedValue] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const assemblyMode =
    selectedPortfolio?.governance_mode === 'assembly';

  const isOwner = Boolean(
    selectedPortfolio &&
      session?.user.id === selectedPortfolio.user_id,
  );

  const canPropose =
    selectedPortfolio?.governance_mode === 'owner'
      ? isOwner
      : Boolean(summary?.viewer_can_propose);

  const canVote = Boolean(
    assemblyMode && summary?.viewer_can_vote,
  );

  const activeRules = useMemo(
    () => rules.filter((rule) => rule.status === 'active'),
    [rules],
  );

  const selectedRule = useMemo(
    () =>
      activeRules.find((rule) => rule.id === selectedRuleId) ??
      null,
    [activeRules, selectedRuleId],
  );

  const load = useCallback(
    async (refresh = false) => {
      if (!selectedPortfolio || !selectedPortfolioId) {
        setProposals([]);
        setRules([]);
        setVotes(new Map());
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
        const assemblyPromise =
          selectedPortfolio.governance_mode === 'assembly'
            ? supabase.rpc('get_portfolio_assembly_summary', {
                p_portfolio_id: selectedPortfolioId,
              })
            : Promise.resolve({
                data: [],
                error: null,
              });

        const [
          proposalsResult,
          rulesResult,
          assemblyResult,
          votesResult,
        ] = await Promise.all([
          supabase
            .from('governance_proposals')
            .select(
              [
                'id',
                'title',
                'description',
                'rule_title',
                'rule_description',
                'rule_category',
                'rule_config',
                'target_rule_id',
                'old_value',
                'new_value',
                'payload',
                'status',
                'opens_at',
                'closes_at',
                'quorum_votes',
                'proposer_type',
              ].join(','),
            )
            .eq('portfolio_id', selectedPortfolioId)
            .order('created_at', { ascending: false }),

          supabase
            .from('portfolio_rules')
            .select(
              [
                'id',
                'portfolio_id',
                'title',
                'description',
                'category',
                'config',
                'status',
              ].join(','),
            )
            .eq('portfolio_id', selectedPortfolioId)
            .order('created_at', { ascending: false }),

          assemblyPromise,

          supabase.rpc('get_portfolio_proposal_vote_summary', {
            p_portfolio_id: selectedPortfolioId,
          }),
        ]);

        const firstError =
          proposalsResult.error ??
          rulesResult.error ??
          assemblyResult.error ??
          votesResult.error;

        if (firstError) {
          throw firstError;
        }

        setProposals(
          (proposalsResult.data ?? []) as unknown as Proposal[],
        );

        setRules(
          (rulesResult.data ?? []) as unknown as PortfolioRule[],
        );

        const assemblyRows = (assemblyResult.data ??
          []) as AssemblySummary[];

        setSummary(assemblyRows[0] ?? null);

        const voteRows = (votesResult.data ?? []) as VoteSummary[];

        setVotes(
          new Map(
            voteRows.map((vote) => [
              vote.proposal_id,
              vote,
            ]),
          ),
        );
      } catch (loadError) {
        console.error('[AssemblySlide]', loadError);

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Impossible de charger les propositions.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedPortfolio, selectedPortfolioId],
  );

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function resetProposalForm() {
    setSelectedRuleId(null);
    setProposedValue('');
    setReason('');
  }

  function openProposalModal() {
    if (activeRules.length === 0) {
      Alert.alert(
        'Aucune règle à modifier',
        'Crée d’abord une règle active dans l’onglet Règles.',
      );
      return;
    }

    resetProposalForm();
    setModalOpen(true);
  }

  function closeProposalModal() {
    if (saving) {
      return;
    }

    setModalOpen(false);
    resetProposalForm();
  }

  function selectRule(rule: PortfolioRule) {
    setSelectedRuleId(rule.id);
    setProposedValue(configValue(rule) === '—' ? '' : configValue(rule));
  }

  async function createProposal() {
    if (!selectedPortfolioId || saving) {
      return;
    }

    if (!selectedRule) {
      Alert.alert(
        'Règle requise',
        'Choisis la règle que tu veux modifier.',
      );
      return;
    }

    const value = normalizeProposalValue(proposedValue);

    if (value === null) {
      Alert.alert(
        'Nouvelle valeur requise',
        'Indique la nouvelle valeur proposée.',
      );
      return;
    }

    setSaving(true);

    try {
      const { error: createError } = await supabase.rpc(
        'create_rule_change_proposal',
        {
          p_portfolio_id: selectedPortfolioId,
          p_rule_id: selectedRule.id,
          p_description: reason.trim(),
          p_proposed_value: value,
          p_proposed_unit: configUnit(selectedRule) || null,
        },
      );

      if (createError) {
        throw createError;
      }

      setModalOpen(false);
      resetProposalForm();
      await load(true);
    } catch (createError) {
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

  async function vote(proposalId: string, choice: Choice) {
    try {
      const { error: voteError } = await supabase.rpc(
        'cast_governance_vote',
        {
          p_proposal_id: proposalId,
          p_choice: choice,
        },
      );

      if (voteError) {
        throw voteError;
      }

      await load(true);
    } catch (voteError) {
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
    decision: 'approve' | 'cancel',
  ) {
    try {
      const { error: decisionError } = await supabase.rpc(
        'decide_owner_proposal',
        {
          p_proposal_id: proposalId,
          p_decision: decision,
        },
      );

      if (decisionError) {
        throw decisionError;
      }

      await load(true);
    } catch (decisionError) {
      Alert.alert(
        'Action impossible',
        decisionError instanceof Error
          ? decisionError.message
          : 'Impossible d’effectuer cette action.',
      );
    }
  }

  return (
    <>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.text}
          />
        }
      >
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <Text style={[styles.title, { color: colors.text }]}>
              {assemblyMode ? 'Assemblée' : 'Propositions'}
            </Text>

            <Text
              style={[
                styles.subtitle,
                { color: colors.textMuted },
              ]}
            >
              Modifier une règle existante
            </Text>
          </View>

          {canPropose ? (
            <Pressable
              onPress={openProposalModal}
              style={({ pressed }) => [
                styles.newButton,
                {
                  backgroundColor: colors.brandFill,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons
                name="create-outline"
                size={17}
                color={colors.brandText}
              />

              <Text
                style={[
                  styles.newButtonText,
                  { color: colors.brandText },
                ]}
              >
                Proposer
              </Text>
            </Pressable>
          ) : null}
        </View>

        {assemblyMode ? (
          <View style={styles.summaryRow}>
            <SummaryCard
              label="Membres"
              value={String(
                finiteNumber(summary?.human_members ?? 0) +
                  finiteNumber(summary?.ai_members ?? 0),
              )}
            />

            <SummaryCard
              label="Règles actives"
              value={String(activeRules.length)}
            />
          </View>
        ) : null}

        {error ? (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={17}
              color={colors.negative}
            />

            <Text
              style={[
                styles.errorText,
                { color: colors.negative },
              ]}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : null}

        {!loading && proposals.length === 0 ? (
          <View
            style={[
              styles.empty,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="git-compare-outline"
              size={26}
              color={colors.textMuted}
            />

            <Text
              style={[
                styles.emptyTitle,
                { color: colors.text },
              ]}
            >
              Aucune proposition
            </Text>

            <Text
              style={[
                styles.emptyText,
                { color: colors.textMuted },
              ]}
            >
              Les changements de règles proposés apparaîtront ici.
            </Text>
          </View>
        ) : null}

        <View style={styles.proposalList}>
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              voteSummary={votes.get(proposal.id) ?? null}
              assemblyMode={assemblyMode}
              canVote={canVote}
              canOwnerDecide={!assemblyMode && isOwner}
              onVote={(choice) => void vote(proposal.id, choice)}
              onApprove={() =>
                void decide(proposal.id, 'approve')
              }
              onCancel={() =>
                void decide(proposal.id, 'cancel')
              }
            />
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={modalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeProposalModal}
      >
        <SafeAreaView
          style={[
            styles.modalSafeArea,
            { backgroundColor: colors.page },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.border },
            ]}
          >
            <Pressable
              onPress={closeProposalModal}
              disabled={saving}
              style={styles.modalAction}
            >
              <Text
                style={[
                  styles.cancelText,
                  { color: colors.textSecondary },
                ]}
              >
                Annuler
              </Text>
            </Pressable>

            <Text
              style={[
                styles.modalTitle,
                { color: colors.text },
              ]}
            >
              Modifier une règle
            </Text>

            <View style={styles.modalAction} />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalContent}
          >
            <Text
              style={[
                styles.sectionLabel,
                { color: colors.textMuted },
              ]}
            >
              RÈGLE À MODIFIER
            </Text>

            <View style={styles.ruleChoices}>
              {activeRules.map((rule) => {
                const selected = selectedRuleId === rule.id;

                return (
                  <Pressable
                    key={rule.id}
                    onPress={() => selectRule(rule)}
                    style={[
                      styles.ruleChoice,
                      {
                        backgroundColor: colors.surface,
                        borderColor: selected
                          ? colors.accent
                          : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.ruleChoiceTop}>
                      <View style={styles.ruleChoiceCopy}>
                        <Text
                          numberOfLines={2}
                          style={[
                            styles.ruleChoiceTitle,
                            { color: colors.text },
                          ]}
                        >
                          {rule.title}
                        </Text>

                        <Text
                          style={[
                            styles.ruleChoiceCategory,
                            { color: colors.textMuted },
                          ]}
                        >
                          {rule.category}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.radio,
                          {
                            borderColor: selected
                              ? colors.accent
                              : colors.border,
                          },
                        ]}
                      >
                        {selected ? (
                          <View
                            style={[
                              styles.radioDot,
                              { backgroundColor: colors.accent },
                            ]}
                          />
                        ) : null}
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.currentValue,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Actuellement : {configValue(rule)}
                      {configUnit(rule)
                        ? ` ${configUnit(rule)}`
                        : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedRule ? (
              <>
                <Text
                  style={[
                    styles.sectionLabel,
                    styles.valueLabel,
                    { color: colors.textMuted },
                  ]}
                >
                  NOUVELLE VALEUR
                </Text>

                <View
                  style={[
                    styles.valueInputRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <TextInput
                    value={proposedValue}
                    onChangeText={setProposedValue}
                    placeholder="Nouvelle valeur"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    style={[
                      styles.valueInput,
                      { color: colors.text },
                    ]}
                  />

                  {configUnit(selectedRule) ? (
                    <View
                      style={[
                        styles.unitPill,
                        {
                          backgroundColor:
                            colors.surfaceStrong,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.unitText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {configUnit(selectedRule)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text
                  style={[
                    styles.sectionLabel,
                    styles.reasonLabel,
                    { color: colors.textMuted },
                  ]}
                >
                  MOTIF · FACULTATIF
                </Text>

                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Pourquoi modifier cette règle ?"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={[
                    styles.reasonInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />

                <Pressable
                  disabled={saving}
                  onPress={() => void createProposal()}
                  style={({ pressed }) => [
                    styles.submitButton,
                    {
                      backgroundColor: colors.brandFill,
                      opacity: saving || pressed ? 0.65 : 1,
                    },
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.brandText} />
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.submitText,
                          { color: colors.brandText },
                        ]}
                      >
                        Proposer la modification
                      </Text>

                      <Ionicons
                        name="arrow-forward"
                        size={17}
                        color={colors.brandText}
                      />
                    </>
                  )}
                </Pressable>
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { colors } = useTerysoTheme();

  return (
    <View
      style={[
        styles.summaryCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.summaryValue,
          { color: colors.text },
        ]}
      >
        {value}
      </Text>

      <Text
        style={[
          styles.summaryLabel,
          { color: colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function ProposalCard({
  proposal,
  voteSummary,
  assemblyMode,
  canVote,
  canOwnerDecide,
  onVote,
  onApprove,
  onCancel,
}: {
  proposal: Proposal;
  voteSummary: VoteSummary | null;
  assemblyMode: boolean;
  canVote: boolean;
  canOwnerDecide: boolean;
  onVote: (choice: Choice) => void;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTerysoTheme();

  const open = proposal.status === 'open';
  const unit = proposalUnit(proposal);
  const votesFor = finiteNumber(voteSummary?.votes_for ?? 0);
  const votesAgainst = finiteNumber(
    voteSummary?.votes_against ?? 0,
  );

  const oldDisplay = `${displayScalar(proposal.old_value)}${
    unit ? ` ${unit}` : ''
  }`;

  const newDisplay = `${displayScalar(proposal.new_value)}${
    unit ? ` ${unit}` : ''
  }`;

  return (
    <View
      style={[
        styles.proposalCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.proposalTop}>
        <View
          style={[
            styles.changePill,
            { backgroundColor: colors.surfaceStrong },
          ]}
        >
          <Text
            style={[
              styles.changePillText,
              { color: colors.textSecondary },
            ]}
          >
            MODIFICATION DE RÈGLE
          </Text>
        </View>

        <Text
          style={[
            styles.statusText,
            {
              color:
                proposal.status === 'executed'
                  ? colors.positive
                  : colors.textMuted,
            },
          ]}
        >
          {STATUS_LABELS[proposal.status] ?? proposal.status}
        </Text>
      </View>

      <Text
        style={[
          styles.proposalTitle,
          { color: colors.text },
        ]}
      >
        {proposal.rule_title}
      </Text>

      {proposal.target_rule_id ? (
        <View
          style={[
            styles.changeBox,
            { backgroundColor: colors.surfaceStrong },
          ]}
        >
          <Text
            style={[
              styles.oldValue,
              { color: colors.textMuted },
            ]}
          >
            {oldDisplay}
          </Text>

          <Ionicons
            name="arrow-forward"
            size={16}
            color={colors.textMuted}
          />

          <Text
            style={[
              styles.newValue,
              { color: colors.text },
            ]}
          >
            {newDisplay}
          </Text>
        </View>
      ) : (
        <Text
          style={[
            styles.legacyText,
            { color: colors.textMuted },
          ]}
        >
          Proposition historique sans règle cible.
        </Text>
      )}

      {proposal.description ? (
        <Text
          style={[
            styles.proposalDescription,
            { color: colors.textSecondary },
          ]}
        >
          {proposal.description}
        </Text>
      ) : null}

      <View
        style={[
          styles.proposalMeta,
          { borderTopColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.metaText,
            { color: colors.textMuted },
          ]}
        >
          {open
            ? `Vote jusqu’au ${formatDateTime(
                proposal.closes_at,
              )}`
            : `Quorum ${proposal.quorum_votes}`}
        </Text>

        {assemblyMode ? (
          <Text
            style={[
              styles.metaText,
              { color: colors.textMuted },
            ]}
          >
            Pour {votesFor} · Contre {votesAgainst}
          </Text>
        ) : null}
      </View>

      {open && assemblyMode && canVote ? (
        <View style={styles.voteRow}>
          <VoteButton
            label={`Pour · ${votesFor}`}
            selected={voteSummary?.viewer_choice === 'for'}
            onPress={() => onVote('for')}
          />

          <VoteButton
            label={`Contre · ${votesAgainst}`}
            selected={voteSummary?.viewer_choice === 'against'}
            onPress={() => onVote('against')}
          />
        </View>
      ) : null}

      {open && canOwnerDecide ? (
        <View style={styles.ownerActions}>
          <Pressable
            onPress={onCancel}
            style={[
              styles.ownerAction,
              {
                backgroundColor: colors.surfaceStrong,
              },
            ]}
          >
            <Text
              style={[
                styles.ownerActionText,
                { color: colors.textMuted },
              ]}
            >
              Refuser
            </Text>
          </Pressable>

          <Pressable
            onPress={onApprove}
            style={[
              styles.ownerAction,
              { backgroundColor: colors.brandFill },
            ]}
          >
            <Text
              style={[
                styles.ownerActionText,
                { color: colors.brandText },
              ]}
            >
              Appliquer
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function VoteButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTerysoTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.voteButton,
        {
          backgroundColor: selected
            ? colors.brandFill
            : colors.surfaceStrong,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.voteButtonText,
          {
            color: selected
              ? colors.brandText
              : colors.text,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 50,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  headingCopy: {
    flex: 1,
  },

  title: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  subtitle: {
    fontSize: 10,
    marginTop: 4,
  },

  newButton: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 5,
    minHeight: 40,
    paddingHorizontal: 12,
  },

  newButtonText: {
    fontSize: 10,
    fontWeight: '900',
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },

  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  summaryValue: {
    fontSize: 17,
    fontWeight: '900',
  },

  summaryLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    marginTop: 3,
  },

  errorBox: {
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    padding: 11,
  },

  errorText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 14,
  },

  loading: {
    alignItems: 'center',
    paddingVertical: 60,
  },

  empty: {
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 38,
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 10,
  },

  emptyText: {
    fontSize: 9.5,
    lineHeight: 15,
    marginTop: 5,
    textAlign: 'center',
  },

  proposalList: {
    gap: 10,
  },

  proposalCard: {
    borderRadius: 17,
    borderWidth: 1,
    padding: 14,
  },

  proposalTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  changePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  changePillText: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  statusText: {
    fontSize: 8,
    fontWeight: '900',
  },

  proposalTitle: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
    marginTop: 12,
  },

  changeBox: {
    alignItems: 'center',
    borderRadius: 11,
    flexDirection: 'row',
    gap: 10,
    marginTop: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },

  oldValue: {
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'line-through',
  },

  newValue: {
    fontSize: 13,
    fontWeight: '900',
  },

  legacyText: {
    fontSize: 9,
    marginTop: 10,
  },

  proposalDescription: {
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
  },

  proposalMeta: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
  },

  metaText: {
    fontSize: 8,
    fontWeight: '700',
  },

  voteRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },

  voteButton: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 39,
  },

  voteButtonText: {
    fontSize: 9,
    fontWeight: '900',
  },

  ownerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },

  ownerAction: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 39,
  },

  ownerActionText: {
    fontSize: 9,
    fontWeight: '900',
  },

  modalSafeArea: {
    flex: 1,
  },

  modalHeader: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 5,
  },

  modalAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 76,
  },

  cancelText: {
    fontSize: 11,
    fontWeight: '800',
  },

  modalTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },

  modalContent: {
    paddingBottom: 45,
    paddingHorizontal: 18,
    paddingTop: 18,
  },

  sectionLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  ruleChoices: {
    gap: 8,
    marginTop: 9,
  },

  ruleChoice: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },

  ruleChoiceTop: {
    alignItems: 'center',
    flexDirection: 'row',
  },

  ruleChoiceCopy: {
    flex: 1,
    paddingRight: 10,
  },

  ruleChoiceTitle: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 15,
  },

  ruleChoiceCategory: {
    fontSize: 8,
    marginTop: 3,
  },

  currentValue: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 8,
  },

  radio: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },

  radioDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },

  valueLabel: {
    marginTop: 21,
  },

  valueInputRow: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 8,
    minHeight: 50,
    paddingHorizontal: 12,
  },

  valueInput: {
    flex: 1,
    fontSize: 13,
    minHeight: 48,
    paddingVertical: 0,
  },

  unitPill: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  unitText: {
    fontSize: 9,
    fontWeight: '900',
  },

  reasonLabel: {
    marginTop: 21,
  },

  reasonInput: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 11,
    marginTop: 8,
    minHeight: 88,
    paddingHorizontal: 12,
    paddingTop: 11,
    textAlignVertical: 'top',
  },

  submitButton: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 50,
  },

  submitText: {
    fontSize: 11,
    fontWeight: '900',
  },
});
