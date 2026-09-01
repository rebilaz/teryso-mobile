import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { usePortfolioSwipe } from '@/components/portfolio/portfolio-swipe-context';
import {
  RuleWizard,
  type RuleWizardAsset,
  type RuleWizardPayload,
} from '@/components/portfolio/rule-wizard';
import { useAuth } from '@/contexts/auth-context';
import { useTerysoTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';

type RuleStatus = 'active' | 'archived';
type RuleConfig = Record<string, unknown>;

type PortfolioRule = {
  id: string;
  portfolio_id: string;
  source_proposal_id: string | null;
  title: string;
  description: string;
  category: string;
  config: RuleConfig;
  status: RuleStatus;
  adopted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getScope(config: RuleConfig) {
  const scope = config.scope;
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return null;
  return scope as { type?: unknown; asset_ids?: unknown };
}

function valueLabel(rule: PortfolioRule) {
  const value = rule.config.value;
  const unit = typeof rule.config.unit === 'string' ? rule.config.unit : '';
  if (value === undefined || value === null) return null;
  return `${String(value)}${unit ? ` ${unit}` : ''}`;
}

function scopeLabel(rule: PortfolioRule, assetById: Map<string, RuleWizardAsset>) {
  const scope = getScope(rule.config);
  if (!scope) return null;
  if (scope.type === 'portfolio') return 'Portefeuille entier';
  if (scope.type === 'all_assets') return 'Tous les actifs';
  if (scope.type !== 'assets' || !Array.isArray(scope.asset_ids)) return null;

  const symbols = scope.asset_ids
    .filter((id): id is string => typeof id === 'string')
    .map((id) => assetById.get(id)?.symbol)
    .filter((symbol): symbol is string => Boolean(symbol));

  if (!symbols.length) return 'Actifs sélectionnés';
  if (symbols.length <= 3) return symbols.join(' · ');
  return `${symbols.slice(0, 3).join(' · ')} +${symbols.length - 3}`;
}

export function RulesSlide() {
  const { colors } = useTerysoTheme();
  const { session } = useAuth();
  const { selectedPortfolio, selectedPortfolioId, refreshKey } = usePortfolioSwipe();

  const [rules, setRules] = useState<PortfolioRule[]>([]);
  const [assets, setAssets] = useState<RuleWizardAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<RuleStatus>('active');
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);

  const governanceMode = selectedPortfolio?.governance_mode ?? 'owner';
  const isOwner = Boolean(
    session?.user.id && selectedPortfolio?.user_id === session.user.id,
  );

  // Une proposition = modification d'une règle existante.
  // La création d'une nouvelle règle reste donc réservée au mode owner.
  const canCreateRule = governanceMode === 'owner' && isOwner;
  const canManageDirectly = governanceMode === 'owner' && isOwner;

  const load = useCallback(
    async (refresh = false) => {
      if (!selectedPortfolioId) {
        setRules([]);
        setAssets([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      refresh ? setRefreshing(true) : setLoading(true);
      setPageError(null);

      try {
        const [rulesResult, positionsResult] = await Promise.all([
          supabase
            .from('portfolio_rules')
            .select(
              'id,portfolio_id,source_proposal_id,title,description,category,config,status,adopted_at,created_by,created_at,updated_at',
            )
            .eq('portfolio_id', selectedPortfolioId)
            .order('created_at', { ascending: false }),

          supabase.rpc('get_private_portfolio_positions', {
            p_portfolio_id: selectedPortfolioId,
          }),
        ]);

        if (rulesResult.error) throw rulesResult.error;
        if (positionsResult.error) throw positionsResult.error;

        setRules((rulesResult.data ?? []) as unknown as PortfolioRule[]);

        const unique = new Map<string, RuleWizardAsset>();
        const rows = Array.isArray(positionsResult.data) ? positionsResult.data : [];

        for (const raw of rows as Record<string, unknown>[]) {
          const assetId = typeof raw.asset_id === 'string' ? raw.asset_id : '';
          const symbol = typeof raw.symbol === 'string' ? raw.symbol : '';
          if (!assetId || !symbol) continue;

          unique.set(assetId, {
            asset_id: assetId,
            asset_type: typeof raw.asset_type === 'string' ? raw.asset_type : '',
            symbol,
            name:
              typeof raw.name === 'string' && raw.name.trim()
                ? raw.name
                : symbol,
          });
        }

        setAssets(
          [...unique.values()].sort((a, b) => a.symbol.localeCompare(b.symbol)),
        );
      } catch (error) {
        console.error('[RulesSlide]', error);
        setPageError(
          error instanceof Error ? error.message : 'Impossible de charger les règles.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedPortfolioId],
  );

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const activeCount = useMemo(
    () => rules.filter((rule) => rule.status === 'active').length,
    [rules],
  );
  const archivedCount = rules.length - activeCount;
  const filteredRules = useMemo(
    () => rules.filter((rule) => rule.status === statusFilter),
    [rules, statusFilter],
  );
  const assetById = useMemo(
    () => new Map(assets.map((asset) => [asset.asset_id, asset])),
    [assets],
  );

  async function createRule(payload: RuleWizardPayload) {
    if (!selectedPortfolioId || saving) return;

    setSaving(true);
    setPageError(null);
    setNotice(null);

    try {
      const { error } = await supabase.rpc('submit_portfolio_rule', {
        p_portfolio_id: selectedPortfolioId,
        p_title: payload.title,
        p_description: payload.description,
        p_category: payload.category,
        p_config: payload.config,
      });

      if (error) throw error;

      setWizardOpen(false);
      setNotice('La règle a été créée.');
      await load(true);
    } catch (error) {
      console.error('[RulesSlide create]', error);
      setPageError(
        error instanceof Error ? error.message : 'Impossible de créer la règle.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(rule: PortfolioRule) {
    if (!canManageDirectly || changingStatusId) return;

    const nextStatus: RuleStatus = rule.status === 'active' ? 'archived' : 'active';
    setChangingStatusId(rule.id);
    setPageError(null);
    setNotice(null);

    try {
      const { error } = await supabase.rpc('set_portfolio_rule_status', {
        p_rule_id: rule.id,
        p_status: nextStatus,
      });
      if (error) throw error;

      setNotice(
        nextStatus === 'active'
          ? 'La règle est de nouveau active.'
          : 'La règle a été archivée.',
      );
      await load(true);
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : 'Impossible de modifier la règle.',
      );
    } finally {
      setChangingStatusId(null);
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
            <Text style={[styles.title, { color: colors.text }]}>Règles</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {activeCount} active{activeCount > 1 ? 's' : ''}
            </Text>
          </View>

          {canCreateRule ? (
            <Pressable
              onPress={() => {
                setNotice(null);
                setWizardOpen(true);
              }}
              style={({ pressed }) => [
                styles.addButton,
                {
                  backgroundColor: colors.brandFill,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <Ionicons name="add" size={18} color={colors.brandText} />
              <Text style={[styles.addButtonText, { color: colors.brandText }]}>Ajouter</Text>
            </Pressable>
          ) : null}
        </View>

        {governanceMode === 'assembly' ? (
          <View
            style={[
              styles.infoBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="people-outline" size={17} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Les changements de règles se font dans l’onglet Assemblée.
            </Text>
          </View>
        ) : null}

        {notice ? (
          <Message
            icon="checkmark-circle-outline"
            text={notice}
            color={colors.positive}
            background={colors.accentSoft}
            border={colors.accent}
          />
        ) : null}

        {pageError ? (
          <Message
            icon="alert-circle-outline"
            text={pageError}
            color={colors.negative}
            background={colors.surface}
            border={colors.border}
          />
        ) : null}

        <View style={[styles.filters, { backgroundColor: colors.surfaceStrong }]}>
          <FilterButton
            label={`Actives · ${activeCount}`}
            active={statusFilter === 'active'}
            onPress={() => setStatusFilter('active')}
          />
          <FilterButton
            label={`Archivées · ${archivedCount}`}
            active={statusFilter === 'archived'}
            onPress={() => setStatusFilter('archived')}
          />
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : null}

        {!loading && filteredRules.length === 0 ? (
          <View
            style={[
              styles.empty,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="document-text-outline" size={24} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {statusFilter === 'active' ? 'Aucune règle active' : 'Aucune règle archivée'}
            </Text>
            <Text style={[styles.emptyDescription, { color: colors.textMuted }]}>
              {canCreateRule && statusFilter === 'active'
                ? 'Crée une première règle pour ce portefeuille.'
                : 'Les règles correspondantes apparaîtront ici.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.rules}>
          {filteredRules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              scope={scopeLabel(rule, assetById)}
              value={valueLabel(rule)}
              canManage={canManageDirectly}
              loading={changingStatusId === rule.id}
              onStatusChange={() => void changeStatus(rule)}
            />
          ))}
        </View>
      </ScrollView>

      <RuleWizard
        visible={wizardOpen}
        assets={assets}
        saving={saving}
        onClose={() => setWizardOpen(false)}
        onSubmit={(payload) => void createRule(payload)}
      />
    </>
  );
}

function Message({
  icon,
  text,
  color,
  background,
  border,
}: {
  icon: 'checkmark-circle-outline' | 'alert-circle-outline';
  text: string;
  color: string;
  background: string;
  border: string;
}) {
  return (
    <View style={[styles.message, { backgroundColor: background, borderColor: border }]}>
      <Ionicons name={icon} size={17} color={color} />
      <Text style={[styles.messageText, { color }]}>{text}</Text>
    </View>
  );
}

function FilterButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTerysoTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterButton,
        active && { backgroundColor: colors.surface },
        { opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <Text style={[styles.filterText, { color: active ? colors.text : colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function RuleCard({
  rule,
  scope,
  value,
  canManage,
  loading,
  onStatusChange,
}: {
  rule: PortfolioRule;
  scope: string | null;
  value: string | null;
  canManage: boolean;
  loading: boolean;
  onStatusChange: () => void;
}) {
  const { colors } = useTerysoTheme();
  const archived = rule.status === 'archived';

  return (
    <View
      style={[
        styles.ruleCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: archived ? 0.72 : 1,
        },
      ]}
    >
      <View style={styles.ruleCardTop}>
        <View style={[styles.categoryPill, { backgroundColor: colors.surfaceStrong }]}>
          <Text style={[styles.categoryPillText, { color: colors.textSecondary }]}>
            {rule.category}
          </Text>
        </View>
        <Text style={[styles.statusText, { color: archived ? colors.textMuted : colors.positive }]}>
          {archived ? 'Archivée' : 'Active'}
        </Text>
      </View>

      <Text style={[styles.ruleTitle, { color: colors.text }]}>{rule.title}</Text>

      <View style={styles.metaRow}>
        {scope ? (
          <View style={[styles.metaPill, { backgroundColor: colors.surfaceStrong }]}>
            <Ionicons name="locate-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{scope}</Text>
          </View>
        ) : null}
        {value ? (
          <View style={[styles.metaPill, { backgroundColor: colors.surfaceStrong }]}>
            <Text style={[styles.metaValue, { color: colors.text }]}>{value}</Text>
          </View>
        ) : null}
      </View>

      {rule.description ? (
        <Text numberOfLines={2} style={[styles.ruleDescription, { color: colors.textSecondary }]}>
          {rule.description}
        </Text>
      ) : null}

      <View style={[styles.ruleFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.ruleDate, { color: colors.textMuted }]}>
          {formatDate(rule.adopted_at ?? rule.created_at)}
        </Text>

        {canManage ? (
          <Pressable
            disabled={loading}
            onPress={onStatusChange}
            style={[styles.statusAction, { backgroundColor: colors.surfaceStrong }]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <>
                <Ionicons
                  name={archived ? 'refresh-outline' : 'archive-outline'}
                  size={14}
                  color={colors.textMuted}
                />
                <Text style={[styles.statusActionText, { color: colors.textMuted }]}>
                  {archived ? 'Réactiver' : 'Archiver'}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 50, paddingHorizontal: 20, paddingTop: 20 },
  heading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  headingCopy: { flex: 1 },
  title: { fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 10, marginTop: 3 },
  addButton: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 4, minHeight: 40, paddingHorizontal: 12 },
  addButtonText: { fontSize: 10, fontWeight: '900' },
  infoBox: { alignItems: 'flex-start', borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 9, marginBottom: 12, padding: 11 },
  infoText: { flex: 1, fontSize: 9.5, lineHeight: 14 },
  message: { alignItems: 'flex-start', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, marginBottom: 12, padding: 11 },
  messageText: { flex: 1, fontSize: 9.5, lineHeight: 14 },
  filters: { borderRadius: 12, flexDirection: 'row', gap: 3, marginBottom: 15, padding: 4 },
  filterButton: { alignItems: 'center', borderRadius: 9, flex: 1, justifyContent: 'center', minHeight: 38 },
  filterText: { fontSize: 9, fontWeight: '900' },
  loading: { alignItems: 'center', paddingVertical: 60 },
  empty: { alignItems: 'center', borderRadius: 17, borderWidth: 1, paddingHorizontal: 24, paddingVertical: 38 },
  emptyTitle: { fontSize: 14, fontWeight: '900', marginTop: 10 },
  emptyDescription: { fontSize: 9.5, lineHeight: 15, marginTop: 5, textAlign: 'center' },
  rules: { gap: 10 },
  ruleCard: { borderRadius: 17, borderWidth: 1, padding: 14 },
  ruleCardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  categoryPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  categoryPillText: { fontSize: 7.5, fontWeight: '900', textTransform: 'uppercase' },
  statusText: { fontSize: 8, fontWeight: '900' },
  ruleTitle: { fontSize: 15, fontWeight: '900', lineHeight: 20, marginTop: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  metaPill: { alignItems: 'center', borderRadius: 9, flexDirection: 'row', gap: 5, paddingHorizontal: 8, paddingVertical: 6 },
  metaText: { fontSize: 8, fontWeight: '700' },
  metaValue: { fontSize: 9, fontWeight: '900' },
  ruleDescription: { fontSize: 10, lineHeight: 15, marginTop: 9 },
  ruleFooter: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10 },
  ruleDate: { fontSize: 8 },
  statusAction: { alignItems: 'center', borderRadius: 9, flexDirection: 'row', gap: 4, minHeight: 32, paddingHorizontal: 8 },
  statusActionText: { fontSize: 8, fontWeight: '900' },
});
