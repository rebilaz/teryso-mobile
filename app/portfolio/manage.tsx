import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TransactionSheet } from '@/components/teryso/transaction-sheet';
import { useAuth } from '@/contexts/auth-context';
import { useTerysoTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';

type Section = 'transactions' | 'assembly' | 'rules';
type Numeric = number | string | null;
type ViewMode = 'cash' | 'securities';
type Choice = 'for' | 'against';
type Priority = 1 | 2 | 3 | 4;
type DeleteRpc =
  | 'delete_portfolio_transaction'
  | 'delete_cash_movement'
  | 'delete_asset_movement'
  | 'delete_asset_swap'
  | 'delete_cash_transfer'
  | 'delete_asset_transfer';

type Portfolio = {
  id: string;
  name: string;
  slug: string;
  base_currency: string;
  user_id: string;
  governance_mode: 'owner' | 'assembly';
};

type ActivityRow = {
  operation_id: string;
  operation_type: string;
  occurred_at: string;
  asset_symbol: string | null;
  asset_name: string | null;
  quantity: Numeric;
  unit_price: Numeric;
  amount: Numeric;
  fees: Numeric;
  currency: string | null;
  note: string | null;
};

type Rule = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'active' | 'archived';
  adopted_at: string | null;
  source_proposal_id: string | null;
};

type Proposal = {
  id: string;
  rule_title: string;
  rule_description: string;
  status: string;
  opens_at: string;
  closes_at: string;
  quorum_votes: number;
  proposer_type: 'user' | 'ai';
};

type ProposalVoteSummary = {
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

const SECTIONS = [
  { key: 'transactions' as const, label: 'Transactions', icon: 'swap-horizontal-outline' as const },
  { key: 'assembly' as const, label: 'Assemblée', icon: 'people-outline' as const },
  { key: 'rules' as const, label: 'Règles', icon: 'document-text-outline' as const },
];

const OPERATION_LABELS: Record<string, string> = {
  buy: 'Achat',
  sell: 'Vente',
  deposit: 'Dépôt',
  withdrawal: 'Retrait',
  buy_spend: 'Achat · espèces',
  sell_receive: 'Vente · espèces',
  transfer_in: 'Transfert entrant',
  transfer_out: 'Transfert sortant',
  asset_deposit: 'Dépôt d’actif',
  asset_withdrawal: 'Retrait d’actif',
  swap: 'Swap',
  asset_transfer: 'Transfert d’actif',
  asset_transfer_in: 'Actif entrant',
  asset_transfer_out: 'Actif sortant',
  cash_transfer: 'Transfert espèces',
  cash_transfer_in: 'Espèces entrantes',
  cash_transfer_out: 'Espèces sortantes',
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

const ACTION_TYPES = [
  { value: 'change_rule_limit', label: 'Modifier une limite' },
  { value: 'add_allowed_asset', label: 'Ajouter un actif' },
  { value: 'remove_allowed_asset', label: 'Retirer un actif' },
  { value: 'change_min_cash', label: 'Minimum de cash' },
  { value: 'change_max_allocation', label: 'Allocation maximale' },
  { value: 'change_strategy_parameter', label: 'Paramètre de stratégie' },
] as const;

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatMoney(value: unknown, currency = 'EUR') {
  const number = toNumber(value);
  if (number === null) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 2,
  }).format(number);
}

function formatQuantity(value: unknown) {
  const number = toNumber(value);
  if (number === null) return '—';
  return number.toLocaleString('fr-FR', { maximumFractionDigits: 8 });
}

function formatDate(value: string, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return withTime
    ? date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
    : date.toLocaleDateString('fr-FR', { dateStyle: 'medium' });
}

function isCashOperation(type: string) {
  return (
    type === 'deposit' ||
    type === 'withdrawal' ||
    type === 'cash_transfer' ||
    type === 'cash_transfer_in' ||
    type === 'cash_transfer_out'
  );
}

function getDeleteTarget(row: ActivityRow): { rpc: DeleteRpc; parameter: string } {
  if (row.operation_type === 'buy' || row.operation_type === 'sell') {
    return { rpc: 'delete_portfolio_transaction', parameter: 'p_transaction_id' };
  }
  if (row.operation_type === 'deposit' || row.operation_type === 'withdrawal') {
    return { rpc: 'delete_cash_movement', parameter: 'p_cash_movement_id' };
  }
  if (
    row.operation_type === 'asset_deposit' ||
    row.operation_type === 'asset_withdrawal'
  ) {
    return { rpc: 'delete_asset_movement', parameter: 'p_asset_movement_id' };
  }
  if (row.operation_type === 'swap') {
    return { rpc: 'delete_asset_swap', parameter: 'p_asset_swap_id' };
  }
  if (row.operation_type.startsWith('cash_transfer')) {
    return { rpc: 'delete_cash_transfer', parameter: 'p_cash_transfer_id' };
  }
  if (row.operation_type.startsWith('asset_transfer')) {
    return { rpc: 'delete_asset_transfer', parameter: 'p_asset_transfer_id' };
  }
  throw new Error('Ce type d’opération ne peut pas encore être supprimé.');
}

function operationIcon(type: string) {
  if (type === 'buy') return 'cart-outline' as const;
  if (type === 'sell' || type.includes('out') || type === 'withdrawal') {
    return 'arrow-up-outline' as const;
  }
  if (type.includes('transfer') || type === 'swap') {
    return 'swap-horizontal-outline' as const;
  }
  return 'arrow-down-outline' as const;
}

function getPriority(rule: Rule): Priority {
  const value = `${rule.category} ${rule.title}`.toLowerCase();
  const fundamental = [
    'gouvernance', 'governance', 'mandat', 'mission', 'objectif', 'constitution',
    'protection', 'risque', 'risk', 'sécurité', 'securite', 'limite',
  ];
  const strategic = [
    'allocation', 'diversification', 'exposition', 'secteur', 'sector', 'actif',
    'asset', 'concentration', 'stratégie', 'strategie', 'strategy',
  ];
  const execution = [
    'achat', 'vente', 'buy', 'sell', 'arbitrage', 'rééquilibrage',
    'reequilibrage', 'rebalance', 'liquidité', 'liquidite', 'seuil', 'entrée',
    'entree', 'sortie',
  ];

  if (fundamental.some((keyword) => value.includes(keyword))) return 1;
  if (strategic.some((keyword) => value.includes(keyword))) return 2;
  if (execution.some((keyword) => value.includes(keyword))) return 3;
  return 4;
}

function priorityLabel(priority: Priority) {
  if (priority === 1) return 'Fondamental';
  if (priority === 2) return 'Stratégique';
  if (priority === 3) return 'Exécution';
  return 'Standard';
}

function sectionFromParam(value: string | string[] | undefined): Section {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized === 'assembly' || normalized === 'rules') return normalized;
  return 'transactions';
}

export default function PortfolioManageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ portfolioId?: string; section?: string }>();
  const { session } = useAuth();
  const { colors } = useTerysoTheme();
  const { width } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);

  const [section, setSection] = useState<Section>(sectionFromParam(params.section));
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [voteSummaries, setVoteSummaries] = useState(
    new Map<string, ProposalVoteSummary>(),
  );
  const [assemblySummary, setAssemblySummary] = useState<AssemblySummary | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cash');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionSheetOpen, setTransactionSheetOpen] = useState(false);

  const [proposalOpen, setProposalOpen] = useState(false);
  const [savingProposal, setSavingProposal] = useState(false);
  const [proposalTitle, setProposalTitle] = useState('');
  const [proposalDescription, setProposalDescription] = useState('');
  const [proposalRuleKey, setProposalRuleKey] = useState('');
  const [proposalValue, setProposalValue] = useState('');
  const [proposalActionType, setProposalActionType] =
    useState<(typeof ACTION_TYPES)[number]['value']>('change_rule_limit');

  const portfolioId = Array.isArray(params.portfolioId)
    ? params.portfolioId[0]
    : params.portfolioId;

  const load = useCallback(
    async (isRefresh = false) => {
      const userId = session?.user.id;

      if (!userId || !portfolioId) {
        setError('Portefeuille invalide.');
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const { data: portfolioData, error: portfolioError } = await supabase
          .from('portfolios')
          .select('id,name,slug,base_currency,user_id,governance_mode')
          .eq('id', portfolioId)
          .eq('user_id', userId)
          .maybeSingle();

        if (portfolioError) throw portfolioError;
        if (!portfolioData) {
          throw new Error('Portefeuille introuvable ou accès refusé.');
        }

        const nextPortfolio = portfolioData as Portfolio;
        setPortfolio(nextPortfolio);

        const [activityResult, rulesResult, proposalsResult, assemblyResult, voteResult] =
          await Promise.all([
            supabase.rpc('get_portfolio_activity', {
              p_portfolio_id: nextPortfolio.id,
            }),
            supabase
              .from('portfolio_rules')
              .select(
                'id,title,description,category,status,adopted_at,source_proposal_id',
              )
              .eq('portfolio_id', nextPortfolio.id)
              .eq('status', 'active')
              .order('created_at', { ascending: false }),
            supabase
              .from('governance_proposals')
              .select(
                'id,rule_title,rule_description,status,opens_at,closes_at,quorum_votes,proposer_type',
              )
              .eq('portfolio_id', nextPortfolio.id)
              .order('created_at', { ascending: false }),
            nextPortfolio.governance_mode === 'assembly'
              ? supabase.rpc('get_portfolio_assembly_summary', {
                  p_portfolio_id: nextPortfolio.id,
                })
              : Promise.resolve({ data: [], error: null }),
            supabase.rpc('get_portfolio_proposal_vote_summary', {
              p_portfolio_id: nextPortfolio.id,
            }),
          ]);

        const firstError =
          activityResult.error ??
          rulesResult.error ??
          proposalsResult.error ??
          assemblyResult.error ??
          voteResult.error;
        if (firstError) throw firstError;

        setActivity((activityResult.data ?? []) as ActivityRow[]);
        setRules((rulesResult.data ?? []) as Rule[]);
        setProposals((proposalsResult.data ?? []) as Proposal[]);

        const nextAssembly =
          (((assemblyResult.data ?? []) as AssemblySummary[])[0] ?? null);
        setAssemblySummary(nextAssembly);

        const summaries = (voteResult.data ?? []) as ProposalVoteSummary[];
        setVoteSummaries(
          new Map(summaries.map((summary) => [summary.proposal_id, summary])),
        );
      } catch (loadError) {
        console.error('[PortfolioManage]', loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Impossible de charger la gestion du portefeuille.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [portfolioId, session?.user.id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const next = sectionFromParam(params.section);
    const index = Math.max(
      SECTIONS.findIndex((item) => item.key === next),
      0,
    );
    setSection(next);
    requestAnimationFrame(() => {
      pagerRef.current?.scrollTo({ x: index * width, animated: false });
    });
  }, [params.section, width]);

  const filteredActivity = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    return activity.filter((row) => {
      const inView =
        viewMode === 'cash'
          ? isCashOperation(row.operation_type)
          : !isCashOperation(row.operation_type);

      if (!inView) return false;
      if (!query) return true;

      return [
        row.asset_symbol,
        row.asset_name,
        row.note,
        OPERATION_LABELS[row.operation_type] ?? row.operation_type,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase('fr').includes(query),
        );
    });
  }, [activity, search, viewMode]);

  const ruleGroups = useMemo(
    () =>
      ([1, 2, 3, 4] as Priority[])
        .map((priority) => ({
          priority,
          label: priorityLabel(priority),
          rules: rules.filter((rule) => getPriority(rule) === priority),
        }))
        .filter((group) => group.rules.length > 0),
    [rules],
  );

  function goToSection(nextSection: Section) {
    const index = Math.max(
      SECTIONS.findIndex((item) => item.key === nextSection),
      0,
    );
    setSection(nextSection);
    pagerRef.current?.scrollTo({ x: index * width, animated: true });
  }

  function onPagerEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width <= 0) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    const next = SECTIONS[index];
    if (next) setSection(next.key);
  }

  async function deleteOperation(row: ActivityRow) {
    try {
      const target = getDeleteTarget(row);
      const { error: deleteError } = await supabase.rpc(target.rpc, {
        [target.parameter]: row.operation_id,
      });
      if (deleteError) throw deleteError;
      await load(true);
    } catch (deleteError) {
      Alert.alert(
        'Suppression impossible',
        deleteError instanceof Error
          ? deleteError.message
          : 'Impossible de supprimer cette opération.',
      );
    }
  }

  function confirmDelete(row: ActivityRow) {
    Alert.alert(
      'Supprimer cette opération ?',
      'Les soldes et les positions seront recalculés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => void deleteOperation(row),
        },
      ],
    );
  }

  async function vote(proposalId: string, choice: Choice) {
    const { error: voteError } = await supabase.rpc('cast_governance_vote', {
      p_proposal_id: proposalId,
      p_choice: choice,
    });
    if (voteError) {
      Alert.alert('Vote impossible', voteError.message);
      return;
    }
    await load(true);
  }

  async function decide(proposalId: string, decision: 'approve' | 'cancel') {
    const { error: decisionError } = await supabase.rpc('decide_owner_proposal', {
      p_proposal_id: proposalId,
      p_decision: decision,
    });
    if (decisionError) {
      Alert.alert('Action impossible', decisionError.message);
      return;
    }
    await load(true);
  }

  async function createProposal() {
    if (!portfolio || proposalTitle.trim().length < 3) {
      Alert.alert('Titre requis', 'Ajoute un titre de 3 caractères minimum.');
      return;
    }

    setSavingProposal(true);
    const { error: createError } = await supabase.rpc(
      'create_governance_proposal',
      {
        p_portfolio_id: portfolio.id,
        p_title: proposalTitle.trim(),
        p_description: proposalDescription.trim(),
        p_action_type: proposalActionType,
        p_payload: {
          rule_key: proposalRuleKey.trim() || null,
          proposed_value: proposalValue.trim() || null,
        },
      },
    );
    setSavingProposal(false);

    if (createError) {
      Alert.alert('Création impossible', createError.message);
      return;
    }

    setProposalOpen(false);
    setProposalTitle('');
    setProposalDescription('');
    setProposalRuleKey('');
    setProposalValue('');
    setProposalActionType('change_rule_limit');
    await load(true);
  }

  const owner = Boolean(
    portfolio && session?.user.id === portfolio.user_id,
  );
  const canPropose =
    portfolio?.governance_mode === 'owner'
      ? owner
      : Boolean(assemblySummary?.viewer_can_propose);
  const canVote =
    portfolio?.governance_mode === 'assembly' &&
    Boolean(assemblySummary?.viewer_can_vote);

  if (loading && !portfolio) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.page }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.page }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityLabel="Retour"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={[styles.iconButton, { borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.text }]}>
            {portfolio?.name ?? 'Portefeuille'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            Gestion
          </Text>
        </View>

        <Pressable
          accessibilityLabel="Actualiser"
          accessibilityRole="button"
          disabled={refreshing}
          onPress={() => void load(true)}
          style={[styles.iconButton, { borderColor: colors.border }]}
        >
          <Ionicons name="refresh" size={19} color={colors.text} />
        </Pressable>
      </View>

      <View style={[styles.sectionTabs, { borderBottomColor: colors.border }]}>
        {SECTIONS.map((item) => {
          const active = item.key === section;
          return (
            <Pressable
              key={item.key}
              onPress={() => goToSection(item.key)}
              style={[
                styles.sectionTab,
                active && { borderBottomColor: colors.text },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={17}
                color={active ? colors.text : colors.textMuted}
              />
              <Text
                style={[
                  styles.sectionTabText,
                  { color: active ? colors.text : colors.textMuted },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View style={[styles.errorBanner, { borderBottomColor: colors.border }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.negative} />
          <Text style={[styles.errorText, { color: colors.negative }]}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onMomentumScrollEnd={onPagerEnd}
        style={styles.pager}
      >
        <View style={[styles.page, { width }]}>
          <TransactionsPage
            activity={filteredActivity}
            totalActivity={activity.length}
            currency={portfolio?.base_currency ?? 'EUR'}
            colors={colors}
            viewMode={viewMode}
            search={search}
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            onSearch={setSearch}
            onViewMode={setViewMode}
            onAdd={() => setTransactionSheetOpen(true)}
            onDelete={confirmDelete}
          />
        </View>

        <View style={[styles.page, { width }]}>
          <AssemblyPage
            portfolio={portfolio}
            proposals={proposals}
            voteSummaries={voteSummaries}
            summary={assemblySummary}
            canPropose={canPropose}
            canVote={canVote}
            isOwner={owner}
            colors={colors}
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            onNewProposal={() => setProposalOpen(true)}
            onVote={vote}
            onDecide={decide}
          />
        </View>

        <View style={[styles.page, { width }]}>
          <RulesPage
            groups={ruleGroups}
            total={rules.length}
            colors={colors}
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            onAssembly={() => goToSection('assembly')}
          />
        </View>
      </ScrollView>

      <TransactionSheet
        visible={transactionSheetOpen}
        onClose={() => setTransactionSheetOpen(false)}
        onCreated={() => {
          setTransactionSheetOpen(false);
          void load(true);
        }}
      />

      <ProposalModal
        visible={proposalOpen}
        colors={colors}
        title={proposalTitle}
        description={proposalDescription}
        ruleKey={proposalRuleKey}
        proposedValue={proposalValue}
        actionType={proposalActionType}
        saving={savingProposal}
        onTitle={setProposalTitle}
        onDescription={setProposalDescription}
        onRuleKey={setProposalRuleKey}
        onProposedValue={setProposalValue}
        onActionType={setProposalActionType}
        onClose={() => setProposalOpen(false)}
        onSubmit={() => void createProposal()}
      />
    </SafeAreaView>
  );
}

type Colors = ReturnType<typeof useTerysoTheme>['colors'];

function TransactionsPage({
  activity,
  totalActivity,
  currency,
  colors,
  viewMode,
  search,
  refreshing,
  onRefresh,
  onSearch,
  onViewMode,
  onAdd,
  onDelete,
}: {
  activity: ActivityRow[];
  totalActivity: number;
  currency: string;
  colors: Colors;
  viewMode: ViewMode;
  search: string;
  refreshing: boolean;
  onRefresh: () => void;
  onSearch: (value: string) => void;
  onViewMode: (value: ViewMode) => void;
  onAdd: () => void;
  onDelete: (row: ActivityRow) => void;
}) {
  return (
    <ScrollView
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.text}
        />
      }
      contentContainerStyle={styles.pageContent}
    >
      <View style={styles.pageHeading}>
        <View style={styles.headingCopy}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Transactions</Text>
          <Text style={[styles.pageSubtitle, { color: colors.textMuted }]}>
            {totalActivity} opération{totalActivity !== 1 ? 's' : ''}
          </Text>
        </View>

        <Pressable
          onPress={onAdd}
          style={[styles.primaryButton, { backgroundColor: colors.brandFill }]}
        >
          <Ionicons name="add" size={18} color={colors.brandText} />
          <Text style={[styles.primaryButtonText, { color: colors.brandText }]}>
            Ajouter
          </Text>
        </Pressable>
      </View>

      <View style={[styles.segment, { backgroundColor: colors.surfaceStrong }]}>
        {([
          { key: 'cash', label: 'Espèces' },
          { key: 'securities', label: 'Titres & actifs' },
        ] as { key: ViewMode; label: string }[]).map((item) => {
          const active = viewMode === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => onViewMode(item.key)}
              style={[
                styles.segmentButton,
                active && { backgroundColor: colors.surface },
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: active ? colors.text : colors.textMuted },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.searchBox, { borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={onSearch}
          placeholder={viewMode === 'cash' ? 'Type, note...' : 'Actif, note...'}
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>

      {activity.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="Aucune opération"
          subtitle="Les opérations de ce portefeuille apparaîtront ici."
          colors={colors}
        />
      ) : (
        <View>
          {activity.map((row) => {
            const rowCurrency = row.currency ?? currency;
            const outgoing =
              row.operation_type === 'withdrawal' ||
              row.operation_type === 'cash_transfer_out';

            return (
              <Pressable
                key={`${row.operation_type}-${row.operation_id}`}
                onLongPress={() => onDelete(row)}
                style={[styles.listRow, { borderBottomColor: colors.border }]}
              >
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: colors.surfaceStrong },
                  ]}
                >
                  <Ionicons
                    name={operationIcon(row.operation_type)}
                    size={18}
                    color={colors.text}
                  />
                </View>

                <View style={styles.rowCopy}>
                  <Text
                    numberOfLines={1}
                    style={[styles.rowTitle, { color: colors.text }]}
                  >
                    {OPERATION_LABELS[row.operation_type] ?? row.operation_type}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.rowSubtitle, { color: colors.textMuted }]}
                  >
                    {row.asset_symbol
                      ? `${row.asset_symbol}${row.asset_name ? ` · ${row.asset_name}` : ''}`
                      : row.asset_name ?? row.note ?? 'Espèces'}
                  </Text>
                  <Text style={[styles.rowDate, { color: colors.textMuted }]}>
                    {formatDate(row.occurred_at, true)}
                  </Text>
                </View>

                <View style={styles.rowRight}>
                  <Text
                    style={[
                      styles.rowAmount,
                      {
                        color:
                          viewMode === 'cash'
                            ? outgoing
                              ? colors.negative
                              : colors.positive
                            : colors.text,
                      },
                    ]}
                  >
                    {viewMode === 'cash' ? (outgoing ? '− ' : '+ ') : ''}
                    {formatMoney(row.amount, rowCurrency)}
                  </Text>

                  {viewMode === 'securities' ? (
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                      {formatQuantity(row.quantity)} ·{' '}
                      {formatMoney(row.unit_price, rowCurrency)}
                    </Text>
                  ) : Number(row.fees ?? 0) > 0 ? (
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                      Frais {formatMoney(row.fees, rowCurrency)}
                    </Text>
                  ) : null}
                </View>

                <Pressable
                  accessibilityLabel="Supprimer"
                  hitSlop={8}
                  onPress={() => onDelete(row)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
                </Pressable>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function AssemblyPage({
  portfolio,
  proposals,
  voteSummaries,
  summary,
  canPropose,
  canVote,
  isOwner,
  colors,
  refreshing,
  onRefresh,
  onNewProposal,
  onVote,
  onDecide,
}: {
  portfolio: Portfolio | null;
  proposals: Proposal[];
  voteSummaries: Map<string, ProposalVoteSummary>;
  summary: AssemblySummary | null;
  canPropose: boolean;
  canVote: boolean;
  isOwner: boolean;
  colors: Colors;
  refreshing: boolean;
  onRefresh: () => void;
  onNewProposal: () => void;
  onVote: (proposalId: string, choice: Choice) => Promise<void>;
  onDecide: (
    proposalId: string,
    decision: 'approve' | 'cancel',
  ) => Promise<void>;
}) {
  const assemblyMode = portfolio?.governance_mode === 'assembly';

  return (
    <ScrollView
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.text}
        />
      }
      contentContainerStyle={styles.pageContent}
    >
      <View style={styles.pageHeading}>
        <View style={styles.headingCopy}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>
            {assemblyMode ? 'Assemblée' : 'Propositions'}
          </Text>
          <Text style={[styles.pageSubtitle, { color: colors.textMuted }]}>
            {assemblyMode
              ? `${Number(summary?.human_members ?? 0)} humain${
                  Number(summary?.human_members ?? 0) !== 1 ? 's' : ''
                } · ${Number(summary?.ai_members ?? 0)} IA`
              : 'Décisions du propriétaire'}
          </Text>
        </View>

        {canPropose ? (
          <Pressable
            onPress={onNewProposal}
            style={[styles.primaryButton, { backgroundColor: colors.brandFill }]}
          >
            <Ionicons name="add" size={18} color={colors.brandText} />
            <Text style={[styles.primaryButtonText, { color: colors.brandText }]}>
              Proposition
            </Text>
          </Pressable>
        ) : null}
      </View>

      {proposals.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Aucune proposition"
          subtitle="Les décisions et votes du portefeuille apparaîtront ici."
          colors={colors}
        />
      ) : (
        <View style={styles.cardsGap}>
          {proposals.map((proposal) => {
            const voteSummary = voteSummaries.get(proposal.id);
            const votesFor = Number(voteSummary?.votes_for ?? 0);
            const votesAgainst = Number(voteSummary?.votes_against ?? 0);
            const myVote = voteSummary?.viewer_choice;
            const open =
              proposal.status === 'open' &&
              new Date(proposal.closes_at).getTime() > Date.now();
            const eligible = assemblyMode && canVote && open;

            return (
              <View
                key={proposal.id}
                style={[
                  styles.card,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              >
                <View style={styles.cardTop}>
                  <StatusPill status={proposal.status} colors={colors} />
                  <Text style={[styles.proposer, { color: colors.textMuted }]}>
                    {proposal.proposer_type === 'ai' ? 'IA' : 'Humain'}
                  </Text>
                </View>

                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {proposal.rule_title}
                </Text>

                {proposal.rule_description ? (
                  <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
                    {proposal.rule_description}
                  </Text>
                ) : null}

                <Text style={[styles.cardDate, { color: colors.textMuted }]}>
                  {formatDate(proposal.opens_at)} → {formatDate(proposal.closes_at)}
                </Text>

                {assemblyMode ? (
                  <View style={styles.voteCountRow}>
                    <View
                      style={[
                        styles.voteCount,
                        { backgroundColor: colors.accentSoft },
                      ]}
                    >
                      <Ionicons
                        name="thumbs-up-outline"
                        size={15}
                        color={colors.positive}
                      />
                      <Text
                        style={[
                          styles.voteCountText,
                          { color: colors.positive },
                        ]}
                      >
                        {votesFor}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.voteCount,
                        { backgroundColor: colors.surfaceStrong },
                      ]}
                    >
                      <Ionicons
                        name="thumbs-down-outline"
                        size={15}
                        color={colors.negative}
                      />
                      <Text
                        style={[
                          styles.voteCountText,
                          { color: colors.negative },
                        ]}
                      >
                        {votesAgainst}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {assemblyMode ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      disabled={!eligible}
                      onPress={() => void onVote(proposal.id, 'for')}
                      style={[
                        styles.voteButton,
                        {
                          borderColor:
                            myVote === 'for' ? colors.positive : colors.border,
                          backgroundColor:
                            myVote === 'for' ? colors.accentSoft : colors.surface,
                          opacity: eligible ? 1 : 0.45,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.voteButtonText,
                          { color: colors.positive },
                        ]}
                      >
                        Pour
                      </Text>
                    </Pressable>

                    <Pressable
                      disabled={!eligible}
                      onPress={() => void onVote(proposal.id, 'against')}
                      style={[
                        styles.voteButton,
                        {
                          borderColor:
                            myVote === 'against' ? colors.negative : colors.border,
                          backgroundColor: colors.surface,
                          opacity: eligible ? 1 : 0.45,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.voteButtonText,
                          { color: colors.negative },
                        ]}
                      >
                        Contre
                      </Text>
                    </Pressable>
                  </View>
                ) : isOwner && proposal.status === 'open' ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      onPress={() => void onDecide(proposal.id, 'approve')}
                      style={[
                        styles.voteButton,
                        {
                          borderColor: colors.brandFill,
                          backgroundColor: colors.brandFill,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.voteButtonText,
                          { color: colors.brandText },
                        ]}
                      >
                        Appliquer
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => void onDecide(proposal.id, 'cancel')}
                      style={[styles.voteButton, { borderColor: colors.border }]}
                    >
                      <Text
                        style={[
                          styles.voteButtonText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Annuler
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function RulesPage({
  groups,
  total,
  colors,
  refreshing,
  onRefresh,
  onAssembly,
}: {
  groups: { priority: Priority; label: string; rules: Rule[] }[];
  total: number;
  colors: Colors;
  refreshing: boolean;
  onRefresh: () => void;
  onAssembly: () => void;
}) {
  return (
    <ScrollView
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.text}
        />
      }
      contentContainerStyle={styles.pageContent}
    >
      <View style={styles.pageHeading}>
        <View style={styles.headingCopy}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>
            Règles du portefeuille
          </Text>
          <Text style={[styles.pageSubtitle, { color: colors.textMuted }]}>
            {total} règle{total !== 1 ? 's' : ''} active{total !== 1 ? 's' : ''}
          </Text>
        </View>

        <Pressable
          onPress={onAssembly}
          style={[styles.secondaryButton, { borderColor: colors.borderStrong }]}
        >
          <Ionicons name="people-outline" size={17} color={colors.text} />
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            Assemblée
          </Text>
        </Pressable>
      </View>

      {groups.length === 0 ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title="Aucune règle active"
          subtitle="Les règles adoptées du portefeuille apparaîtront ici."
          colors={colors}
        />
      ) : (
        <View style={styles.cardsGap}>
          {groups.map((group) => (
            <View
              key={group.priority}
              style={[styles.rulesGroup, { borderColor: colors.border }]}
            >
              <View
                style={[
                  styles.rulesGroupHeader,
                  {
                    backgroundColor: colors.surfaceStrong,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.priorityBadge,
                    { backgroundColor: colors.brandFill },
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityBadgeText,
                      { color: colors.brandText },
                    ]}
                  >
                    {group.priority}
                  </Text>
                </View>
                <Text style={[styles.rulesGroupTitle, { color: colors.text }]}>
                  {group.label}
                </Text>
              </View>

              {group.rules.map((rule, index) => (
                <View
                  key={rule.id}
                  style={[
                    styles.ruleRow,
                    index < group.rules.length - 1 && {
                      borderBottomColor: colors.border,
                      borderBottomWidth: 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.ruleCheck,
                      { backgroundColor: colors.accentSoft },
                    ]}
                  >
                    <Ionicons name="checkmark" size={15} color={colors.positive} />
                  </View>

                  <View style={styles.ruleCopy}>
                    <Text style={[styles.ruleIndex, { color: colors.textMuted }]}>
                      {group.priority}.{index + 1}
                    </Text>
                    <Text style={[styles.ruleTitle, { color: colors.text }]}>
                      {rule.title}
                    </Text>
                    {rule.description ? (
                      <Text
                        style={[
                          styles.ruleDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {rule.description}
                      </Text>
                    ) : null}
                    <View
                      style={[styles.categoryPill, { borderColor: colors.border }]}
                    >
                      <Text
                        style={[
                          styles.categoryPillText,
                          { color: colors.textMuted },
                        ]}
                      >
                        {rule.category || 'Général'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function StatusPill({ status, colors }: { status: string; colors: Colors }) {
  const positive =
    status === 'approved' || status === 'executed' || status === 'passed';
  const negative =
    status === 'rejected' || status === 'cancelled' || status === 'expired';

  return (
    <View
      style={[
        styles.statusPill,
        {
          borderColor: positive
            ? colors.positive
            : negative
              ? colors.negative
              : colors.border,
          backgroundColor: positive ? colors.accentSoft : colors.surfaceStrong,
        },
      ]}
    >
      <Text
        style={[
          styles.statusPillText,
          {
            color: positive
              ? colors.positive
              : negative
                ? colors.negative
                : colors.textSecondary,
          },
        ]}
      >
        {STATUS_LABELS[status] ?? status}
      </Text>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  colors,
}: {
  icon: 'receipt-outline' | 'people-outline' | 'shield-checkmark-outline';
  title: string;
  subtitle: string;
  colors: Colors;
}) {
  return (
    <View style={[styles.empty, { borderColor: colors.border }]}>
      <Ionicons name={icon} size={29} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        {subtitle}
      </Text>
    </View>
  );
}

function ProposalModal({
  visible,
  colors,
  title,
  description,
  ruleKey,
  proposedValue,
  actionType,
  saving,
  onTitle,
  onDescription,
  onRuleKey,
  onProposedValue,
  onActionType,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  colors: Colors;
  title: string;
  description: string;
  ruleKey: string;
  proposedValue: string;
  actionType: (typeof ACTION_TYPES)[number]['value'];
  saving: boolean;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  onRuleKey: (value: string) => void;
  onProposedValue: (value: string) => void;
  onActionType: (value: (typeof ACTION_TYPES)[number]['value']) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: colors.page }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} style={styles.modalHeaderButton}>
            <Text
              style={[styles.modalHeaderButtonText, { color: colors.textSecondary }]}
            >
              Annuler
            </Text>
          </Pressable>

          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Nouvelle proposition
          </Text>

          <Pressable
            disabled={saving}
            onPress={onSubmit}
            style={styles.modalHeaderButton}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text
                style={[styles.modalHeaderButtonText, { color: colors.text }]}
              >
                Créer
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.modalContent}
        >
          <FieldLabel label="Titre" colors={colors} />
          <TextInput
            value={title}
            onChangeText={onTitle}
            maxLength={140}
            placeholder="Titre de la proposition"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border },
            ]}
          />

          <FieldLabel label="Description" colors={colors} />
          <TextInput
            value={description}
            onChangeText={onDescription}
            multiline
            maxLength={4000}
            placeholder="Explique la modification proposée"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              styles.textArea,
              { color: colors.text, borderColor: colors.border },
            ]}
          />

          <FieldLabel label="Type d’action" colors={colors} />
          <View style={styles.actionTypeWrap}>
            {ACTION_TYPES.map((option) => {
              const active = option.value === actionType;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => onActionType(option.value)}
                  style={[
                    styles.actionTypeChip,
                    {
                      borderColor: active ? colors.borderStrong : colors.border,
                      backgroundColor: active
                        ? colors.surfaceStrong
                        : colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.actionTypeText,
                      { color: active ? colors.text : colors.textMuted },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <FieldLabel label="Règle concernée" colors={colors} optional />
          <TextInput
            value={ruleKey}
            onChangeText={onRuleKey}
            maxLength={100}
            placeholder="Ex. allocation_max"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border },
            ]}
          />

          <FieldLabel label="Nouvelle valeur" colors={colors} optional />
          <TextInput
            value={proposedValue}
            onChangeText={onProposedValue}
            maxLength={500}
            placeholder="Ex. 25 %"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border },
            ]}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function FieldLabel({
  label,
  colors,
  optional = false,
}: {
  label: string;
  colors: Colors;
  optional?: boolean;
}) {
  return (
    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
      {label}
      {optional ? ' · facultatif' : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
    textTransform: 'uppercase',
  },
  sectionTabs: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 52,
  },
  sectionTab: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sectionTabText: { fontSize: 12, fontWeight: '800' },
  errorBanner: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600' },
  pager: { flex: 1 },
  page: { flex: 1 },
  pageContent: {
    paddingBottom: 56,
    paddingHorizontal: 18,
    paddingTop: 22,
  },
  pageHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headingCopy: { flex: 1, minWidth: 0 },
  pageTitle: { fontSize: 25, fontWeight: '900', letterSpacing: -0.8 },
  pageSubtitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 5,
    minHeight: 42,
    paddingHorizontal: 13,
  },
  primaryButtonText: { fontSize: 12, fontWeight: '900' },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 5,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  secondaryButtonText: { fontSize: 12, fontWeight: '800' },
  segment: {
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 3,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 10,
  },
  segmentText: { fontSize: 12, fontWeight: '800' },
  searchBox: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    minHeight: 46,
    paddingHorizontal: 13,
  },
  searchInput: { flex: 1, fontSize: 14, minHeight: 44, paddingVertical: 0 },
  listRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 11,
    minHeight: 80,
    paddingVertical: 11,
  },
  rowIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 13, fontWeight: '800' },
  rowSubtitle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  rowDate: { fontSize: 10, fontWeight: '500', marginTop: 3 },
  rowRight: { alignItems: 'flex-end', maxWidth: 125 },
  rowAmount: { fontSize: 12, fontWeight: '900', textAlign: 'right' },
  rowMeta: { fontSize: 10, fontWeight: '600', marginTop: 3, textAlign: 'right' },
  deleteButton: { alignItems: 'center', height: 34, justifyContent: 'center', width: 28 },
  cardsGap: { gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  statusPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5 },
  statusPillText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  proposer: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  cardTitle: { fontSize: 16, fontWeight: '900', lineHeight: 22, marginTop: 13 },
  cardBody: { fontSize: 13, fontWeight: '500', lineHeight: 20, marginTop: 6 },
  cardDate: { fontSize: 10, fontWeight: '600', marginTop: 10 },
  voteCountRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  voteCount: {
    alignItems: 'center',
    borderRadius: 9,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  voteCountText: { fontSize: 12, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  voteButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 8,
  },
  voteButtonText: { fontSize: 12, fontWeight: '900' },
  rulesGroup: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  rulesGroupHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  priorityBadge: {
    alignItems: 'center',
    borderRadius: 7,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  priorityBadgeText: { fontSize: 12, fontWeight: '900' },
  rulesGroupTitle: { fontSize: 13, fontWeight: '900' },
  ruleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, padding: 14 },
  ruleCheck: {
    alignItems: 'center',
    borderRadius: 999,
    height: 27,
    justifyContent: 'center',
    marginTop: 1,
    width: 27,
  },
  ruleCopy: { flex: 1, minWidth: 0 },
  ruleIndex: { fontSize: 10, fontWeight: '800', marginBottom: 2 },
  ruleTitle: { fontSize: 14, fontWeight: '900', lineHeight: 20 },
  ruleDescription: { fontSize: 12, fontWeight: '500', lineHeight: 18, marginTop: 4 },
  categoryPill: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  categoryPillText: { fontSize: 10, fontWeight: '800' },
  empty: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 44,
  },
  emptyTitle: { fontSize: 15, fontWeight: '900', marginTop: 12 },
  emptyText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 5,
    maxWidth: 270,
    textAlign: 'center',
  },
  modalSafeArea: { flex: 1 },
  modalHeader: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 8,
  },
  modalHeaderButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 70,
  },
  modalHeaderButtonText: { fontSize: 13, fontWeight: '800' },
  modalTitle: { flex: 1, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  modalContent: { paddingBottom: 50, paddingHorizontal: 18, paddingTop: 20 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 7,
    marginTop: 16,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  actionTypeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionTypeChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  actionTypeText: { fontSize: 11, fontWeight: '800' },
});
