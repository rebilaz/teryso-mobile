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
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePortfolioSwipe } from '@/components/portfolio/portfolio-swipe-context';
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

type AssemblySummary = {
  viewer_can_propose: boolean;
  viewer_can_vote: boolean;
  human_members: number | string | null;
  ai_members: number | string | null;
};

type RuleSubmissionResult = {
  mode: 'created' | 'proposal';
  rule_id: string | null;
  proposal_id: string | null;
};

type RuleTemplate = {
  id: string;
  shortTitle: string;
  title: string;
  category: string;
  key: string;
  value: string;
  unit: string;
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

const TEMPLATES: RuleTemplate[] = [
  {
    id: 'max-allocation',
    shortTitle: 'Allocation max',
    title: 'Allocation maximale par actif',
    category: 'Allocation',
    key: 'max_allocation',
    value: '25',
    unit: '%',
    icon: 'pie-chart-outline',
  },
  {
    id: 'minimum-cash',
    shortTitle: 'Liquidités min',
    title: 'Réserve minimale de liquidités',
    category: 'Liquidité',
    key: 'min_cash_percent',
    value: '10',
    unit: '%',
    icon: 'cash-outline',
  },
  {
    id: 'minimum-assets',
    shortTitle: 'Diversification',
    title: 'Diversification minimale',
    category: 'Risque',
    key: 'min_assets',
    value: '5',
    unit: 'actifs',
    icon: 'layers-outline',
  },
  {
    id: 'risk-limit',
    shortTitle: 'Exposition max',
    title: 'Exposition maximale',
    category: 'Risque',
    key: 'max_exposure',
    value: '30',
    unit: '%',
    icon: 'shield-checkmark-outline',
  },
];

function formatDate(value: string | null) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function normalizeValue(value: string) {
  const clean = value.trim();

  if (!clean) {
    return null;
  }

  const parsed = Number(clean.replace(',', '.'));

  return Number.isFinite(parsed) ? parsed : clean;
}

function createRuleKey(title: string) {
  const key = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

  return key || 'rule';
}

function configEntries(config: RuleConfig) {
  const entries: { label: string; value: string }[] = [];

  const key = typeof config.key === 'string' ? config.key : null;
  const value = config.value;
  const unit = typeof config.unit === 'string' ? config.unit : '';

  if (
    value !== undefined &&
    value !== null &&
    String(value).trim()
  ) {
    entries.push({
      label: key ? key.replace(/_/g, ' ') : 'Valeur',
      value: `${String(value)}${unit ? ` ${unit}` : ''}`,
    });
  }

  for (const [entryKey, entryValue] of Object.entries(config)) {
    if (['key', 'value', 'unit'].includes(entryKey)) {
      continue;
    }

    if (
      entryValue === null ||
      entryValue === undefined ||
      typeof entryValue === 'object'
    ) {
      continue;
    }

    entries.push({
      label: entryKey.replace(/_/g, ' '),
      value: String(entryValue),
    });
  }

  return entries.slice(0, 3);
}

export function RulesSlide() {
  const { colors } = useTerysoTheme();
  const { session } = useAuth();
  const {
    selectedPortfolio,
    selectedPortfolioId,
    refreshKey,
  } = usePortfolioSwipe();

  const [rules, setRules] = useState<PortfolioRule[]>([]);
  const [assemblySummary, setAssemblySummary] =
    useState<AssemblySummary | null>(null);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<RuleStatus>('active');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingStatusId, setChangingStatusId] =
    useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] =
    useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [category, setCategory] = useState('Général');
  const [parameterKey, setParameterKey] = useState('');
  const [parameterValue, setParameterValue] = useState('');
  const [unit, setUnit] = useState('');

  const governanceMode =
    selectedPortfolio?.governance_mode ?? 'owner';

  const isOwner = Boolean(
    session?.user.id &&
      selectedPortfolio?.user_id === session.user.id,
  );

  const canCreate =
    governanceMode === 'owner'
      ? isOwner
      : Boolean(assemblySummary?.viewer_can_propose);

  const canManageDirectly =
    governanceMode === 'owner' && isOwner;

  const load = useCallback(
    async (refresh = false) => {
      if (!selectedPortfolioId) {
        setRules([]);
        setAssemblySummary(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setPageError(null);

      try {
        const rulesPromise = supabase
          .from('portfolio_rules')
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
          .eq('portfolio_id', selectedPortfolioId)
          .order('created_at', { ascending: false });

        const assemblyPromise =
          governanceMode === 'assembly'
            ? supabase.rpc('get_portfolio_assembly_summary', {
                p_portfolio_id: selectedPortfolioId,
              })
            : Promise.resolve({
                data: null,
                error: null,
              });

        const [rulesResult, assemblyResult] = await Promise.all([
          rulesPromise,
          assemblyPromise,
        ]);

        if (rulesResult.error) {
          throw rulesResult.error;
        }

        if (assemblyResult.error) {
          throw assemblyResult.error;
        }

        setRules(
          (rulesResult.data ?? []) as unknown as PortfolioRule[],
        );

        if (governanceMode === 'assembly') {
          const rows = Array.isArray(assemblyResult.data)
            ? assemblyResult.data
            : [];

          setAssemblySummary(
            (rows[0] ?? null) as AssemblySummary | null,
          );
        } else {
          setAssemblySummary(null);
        }
      } catch (loadError) {
        console.error('[RulesSlide]', loadError);

        setPageError(
          loadError instanceof Error
            ? loadError.message
            : 'Impossible de charger les règles.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [governanceMode, selectedPortfolioId],
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

  function resetForm() {
    setSelectedTemplateId(null);
    setTitle('');
    setDescription('');
    setShowDescription(false);
    setCategory('Général');
    setParameterKey('');
    setParameterValue('');
    setUnit('');
    setFormError(null);
  }

  function openCreateModal() {
    resetForm();
    setNotice(null);
    setModalOpen(true);
  }

  function closeCreateModal() {
    if (saving) {
      return;
    }

    setModalOpen(false);
    resetForm();
  }

  function applyTemplate(template: RuleTemplate) {
    setSelectedTemplateId(template.id);
    setTitle(template.title);
    setCategory(template.category);
    setParameterKey(template.key);
    setParameterValue(template.value);
    setUnit(template.unit);
    setFormError(null);
  }

  function handleTitleChange(value: string) {
    setTitle(value);

    if (selectedTemplateId) {
      setSelectedTemplateId(null);
      setParameterKey('');
    }
  }

  async function submitRule() {
    if (!selectedPortfolioId || saving) {
      return;
    }

    const cleanTitle = title.trim();

    if (cleanTitle.length < 3) {
      setFormError(
        'Donne un nom à la règle avec au moins 3 caractères.',
      );
      return;
    }

    setSaving(true);
    setFormError(null);
    setNotice(null);

    try {
      const config: RuleConfig = {};
      const value = normalizeValue(parameterValue);
      const cleanUnit = unit.trim();

      if (value !== null || cleanUnit) {
        config.key =
          parameterKey.trim() || createRuleKey(cleanTitle);

        if (value !== null) {
          config.value = value;
        }

        if (cleanUnit) {
          config.unit = cleanUnit;
        }
      }

      const { data, error: submitError } = await supabase.rpc(
        'submit_portfolio_rule',
        {
          p_portfolio_id: selectedPortfolioId,
          p_title: cleanTitle,
          p_description: description.trim(),
          p_category: category,
          p_config: config,
        },
      );

      if (submitError) {
        throw submitError;
      }

      const result = data as RuleSubmissionResult | null;

      setModalOpen(false);
      resetForm();

      setNotice(
        result?.mode === 'proposal'
          ? 'La règle a été envoyée à l’assemblée.'
          : 'La règle a été ajoutée.',
      );

      await load(true);
    } catch (submitError) {
      console.error('[RulesSlide submit]', submitError);

      setFormError(
        submitError instanceof Error
          ? submitError.message
          : 'Impossible d’ajouter cette règle.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(rule: PortfolioRule) {
    if (!canManageDirectly || changingStatusId) {
      return;
    }

    const nextStatus: RuleStatus =
      rule.status === 'active' ? 'archived' : 'active';

    setChangingStatusId(rule.id);
    setPageError(null);
    setNotice(null);

    try {
      const { error: statusError } = await supabase.rpc(
        'set_portfolio_rule_status',
        {
          p_rule_id: rule.id,
          p_status: nextStatus,
        },
      );

      if (statusError) {
        throw statusError;
      }

      setNotice(
        nextStatus === 'active'
          ? 'La règle est de nouveau active.'
          : 'La règle a été archivée.',
      );

      await load(true);
    } catch (statusError) {
      console.error('[RulesSlide status]', statusError);

      setPageError(
        statusError instanceof Error
          ? statusError.message
          : 'Impossible de modifier la règle.',
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
            <Text style={[styles.title, { color: colors.text }]}>
              Règles
            </Text>

            <Text
              style={[
                styles.subtitle,
                { color: colors.textMuted },
              ]}
            >
              {activeCount} active{activeCount > 1 ? 's' : ''}
            </Text>
          </View>

          {canCreate ? (
            <Pressable
              onPress={openCreateModal}
              style={({ pressed }) => [
                styles.addButton,
                {
                  backgroundColor: colors.brandFill,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <Ionicons
                name="add"
                size={18}
                color={colors.brandText}
              />

              <Text
                style={[
                  styles.addButtonText,
                  { color: colors.brandText },
                ]}
              >
                Ajouter
              </Text>
            </Pressable>
          ) : null}
        </View>

        {governanceMode === 'assembly' ? (
          <View
            style={[
              styles.governanceNotice,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="people-outline"
              size={17}
              color={colors.textMuted}
            />

            <Text
              style={[
                styles.governanceText,
                { color: colors.textSecondary },
              ]}
            >
              Les nouvelles règles sont soumises au vote avant
              activation.
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

        <View
          style={[
            styles.filters,
            { backgroundColor: colors.surfaceStrong },
          ]}
        >
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
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="document-text-outline"
              size={24}
              color={colors.textMuted}
            />

            <Text
              style={[
                styles.emptyTitle,
                { color: colors.text },
              ]}
            >
              {statusFilter === 'active'
                ? 'Aucune règle active'
                : 'Aucune règle archivée'}
            </Text>

            <Text
              style={[
                styles.emptyDescription,
                { color: colors.textMuted },
              ]}
            >
              {statusFilter === 'active' && canCreate
                ? 'Ajoute une première règle au portefeuille.'
                : 'Les règles correspondantes apparaîtront ici.'}
            </Text>

            {statusFilter === 'active' && canCreate ? (
              <Pressable
                onPress={openCreateModal}
                style={[
                  styles.emptyButton,
                  { backgroundColor: colors.brandFill },
                ]}
              >
                <Text
                  style={[
                    styles.emptyButtonText,
                    { color: colors.brandText },
                  ]}
                >
                  Créer une règle
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.rules}>
          {filteredRules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              canManage={canManageDirectly}
              loading={changingStatusId === rule.id}
              onStatusChange={() => void changeStatus(rule)}
            />
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={modalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeCreateModal}
      >
        <SafeAreaView
          style={[
            styles.modalSafeArea,
            { backgroundColor: colors.page },
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: colors.border },
              ]}
            >
              <Pressable
                onPress={closeCreateModal}
                disabled={saving}
                style={styles.modalHeaderAction}
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
                Nouvelle règle
              </Text>

              <View style={styles.modalHeaderAction} />
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalContent}
            >
              {governanceMode === 'assembly' ? (
                <View
                  style={[
                    styles.formNotice,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="people-outline"
                    size={17}
                    color={colors.textMuted}
                  />

                  <Text
                    style={[
                      styles.formNoticeText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Cette règle sera proposée à l’assemblée.
                  </Text>
                </View>
              ) : null}

              <Text
                style={[
                  styles.sectionLabel,
                  { color: colors.textMuted },
                ]}
              >
                MODÈLE
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.templateRow}
              >
                {TEMPLATES.map((template) => {
                  const selected =
                    selectedTemplateId === template.id;

                  return (
                    <Pressable
                      key={template.id}
                      onPress={() => applyTemplate(template)}
                      style={[
                        styles.templateChip,
                        {
                          backgroundColor: selected
                            ? colors.brandFill
                            : colors.surface,
                          borderColor: selected
                            ? colors.brandFill
                            : colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={template.icon}
                        size={15}
                        color={
                          selected
                            ? colors.brandText
                            : colors.text
                        }
                      />

                      <Text
                        numberOfLines={1}
                        style={[
                          styles.templateChipText,
                          {
                            color: selected
                              ? colors.brandText
                              : colors.text,
                          },
                        ]}
                      >
                        {template.shortTitle}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Field
                label="Nom de la règle"
                value={title}
                onChangeText={handleTitleChange}
                placeholder="Ex. Allocation maximale par actif"
                colors={colors}
              />

              <Text
                style={[
                  styles.sectionLabel,
                  styles.categoryLabel,
                  { color: colors.textMuted },
                ]}
              >
                CATÉGORIE
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {CATEGORIES.map((option) => {
                  const selected = category === option;

                  return (
                    <Pressable
                      key={option}
                      onPress={() => setCategory(option)}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: selected
                            ? colors.brandFill
                            : colors.surface,
                          borderColor: selected
                            ? colors.brandFill
                            : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          {
                            color: selected
                              ? colors.brandText
                              : colors.text,
                          },
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text
                style={[
                  styles.sectionLabel,
                  styles.parameterLabel,
                  { color: colors.textMuted },
                ]}
              >
                PARAMÈTRE
              </Text>

              <View style={styles.parameterRow}>
                <View style={styles.parameterValue}>
                  <Field
                    label="Valeur"
                    value={parameterValue}
                    onChangeText={setParameterValue}
                    placeholder="25"
                    colors={colors}
                    keyboardType="decimal-pad"
                    compact
                  />
                </View>

                <View style={styles.parameterUnit}>
                  <Field
                    label="Unité"
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="%"
                    colors={colors}
                    compact
                  />
                </View>
              </View>

              <Pressable
                onPress={() => setShowDescription((current) => !current)}
                style={styles.descriptionToggle}
              >
                <Ionicons
                  name={
                    showDescription
                      ? 'remove-circle-outline'
                      : 'add-circle-outline'
                  }
                  size={18}
                  color={colors.textMuted}
                />

                <Text
                  style={[
                    styles.descriptionToggleText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {showDescription
                    ? 'Masquer la description'
                    : 'Ajouter une description'}
                </Text>
              </Pressable>

              {showDescription ? (
                <Field
                  label="Description facultative"
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Précise le rôle de cette règle…"
                  colors={colors}
                  multiline
                />
              ) : null}

              {formError ? (
                <Message
                  icon="alert-circle-outline"
                  text={formError}
                  color={colors.negative}
                  background={colors.surface}
                  border={colors.border}
                />
              ) : null}

              <Pressable
                disabled={saving}
                onPress={() => void submitRule()}
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
                        styles.submitButtonText,
                        { color: colors.brandText },
                      ]}
                    >
                      {governanceMode === 'assembly'
                        ? 'Proposer la règle'
                        : 'Créer la règle'}
                    </Text>

                    <Ionicons
                      name="arrow-forward"
                      size={17}
                      color={colors.brandText}
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
    <View
      style={[
        styles.message,
        {
          backgroundColor: background,
          borderColor: border,
        },
      ]}
    >
      <Ionicons name={icon} size={17} color={color} />

      <Text style={[styles.messageText, { color }]}>
        {text}
      </Text>
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
      <Text
        style={[
          styles.filterText,
          {
            color: active ? colors.text : colors.textMuted,
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
  rule: PortfolioRule;
  canManage: boolean;
  loading: boolean;
  onStatusChange: () => void;
}) {
  const { colors } = useTerysoTheme();
  const archived = rule.status === 'archived';
  const entries = configEntries(rule.config ?? {});

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
        <View
          style={[
            styles.categoryPill,
            { backgroundColor: colors.surfaceStrong },
          ]}
        >
          <Text
            style={[
              styles.categoryPillText,
              { color: colors.textSecondary },
            ]}
          >
            {rule.category}
          </Text>
        </View>

        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: archived
                ? colors.surfaceStrong
                : colors.accentSoft,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: archived
                  ? colors.textMuted
                  : colors.positive,
              },
            ]}
          />

          <Text
            style={[
              styles.statusText,
              {
                color: archived
                  ? colors.textMuted
                  : colors.positive,
              },
            ]}
          >
            {archived ? 'Archivée' : 'Active'}
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.ruleTitle,
          { color: colors.text },
        ]}
      >
        {rule.title}
      </Text>

      {rule.description ? (
        <Text
          numberOfLines={2}
          style={[
            styles.ruleDescription,
            { color: colors.textSecondary },
          ]}
        >
          {rule.description}
        </Text>
      ) : null}

      {entries.length > 0 ? (
        <View style={styles.configEntries}>
          {entries.map((entry, index) => (
            <View
              key={`${entry.label}-${index}`}
              style={[
                styles.configEntry,
                { backgroundColor: colors.surfaceStrong },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.configLabel,
                  { color: colors.textMuted },
                ]}
              >
                {entry.label}
              </Text>

              <Text
                numberOfLines={1}
                style={[
                  styles.configValue,
                  { color: colors.text },
                ]}
              >
                {entry.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View
        style={[
          styles.ruleFooter,
          { borderTopColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.ruleMetaText,
            { color: colors.textMuted },
          ]}
        >
          {rule.source_proposal_id
            ? `Assemblée · ${formatDate(rule.adopted_at)}`
            : formatDate(rule.adopted_at ?? rule.created_at)}
        </Text>

        {canManage ? (
          <Pressable
            disabled={loading}
            onPress={onStatusChange}
            style={({ pressed }) => [
              styles.statusAction,
              {
                backgroundColor: colors.surfaceStrong,
                opacity: pressed || loading ? 0.6 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color={colors.textMuted}
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
                  color={colors.textMuted}
                />

                <Text
                  style={[
                    styles.statusActionText,
                    { color: colors.textMuted },
                  ]}
                >
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

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  multiline = false,
  compact = false,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useTerysoTheme>['colors'];
  multiline?: boolean;
  compact?: boolean;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <Text
        style={[
          styles.fieldLabel,
          { color: colors.textMuted },
        ]}
      >
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[
          styles.input,
          multiline && styles.textArea,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
      />
    </View>
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
    marginTop: 3,
  },

  addButton: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 12,
  },

  addButtonText: {
    fontSize: 10,
    fontWeight: '900',
  },

  governanceNotice: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  governanceText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 14,
  },

  message: {
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    padding: 11,
  },

  messageText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 14,
  },

  filters: {
    borderRadius: 12,
    flexDirection: 'row',
    gap: 3,
    marginBottom: 15,
    padding: 4,
  },

  filterButton: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
  },

  filterText: {
    fontSize: 9,
    fontWeight: '900',
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

  emptyDescription: {
    fontSize: 9.5,
    lineHeight: 15,
    marginTop: 5,
    maxWidth: 250,
    textAlign: 'center',
  },

  emptyButton: {
    alignItems: 'center',
    borderRadius: 11,
    justifyContent: 'center',
    marginTop: 15,
    minHeight: 40,
    paddingHorizontal: 14,
  },

  emptyButtonText: {
    fontSize: 9.5,
    fontWeight: '900',
  },

  rules: {
    gap: 10,
  },

  ruleCard: {
    borderRadius: 17,
    borderWidth: 1,
    padding: 14,
  },

  ruleCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  categoryPillText: {
    fontSize: 7.5,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  statusPill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  statusDot: {
    borderRadius: 999,
    height: 5,
    width: 5,
  },

  statusText: {
    fontSize: 7.5,
    fontWeight: '900',
  },

  ruleTitle: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
    marginTop: 12,
  },

  ruleDescription: {
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },

  configEntries: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },

  configEntry: {
    borderRadius: 10,
    minWidth: 90,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  configLabel: {
    fontSize: 7,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  configValue: {
    fontSize: 10,
    fontWeight: '900',
    marginTop: 2,
  },

  ruleFooter: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 13,
    paddingTop: 10,
  },

  ruleMetaText: {
    flex: 1,
    fontSize: 8,
  },

  statusAction: {
    alignItems: 'center',
    borderRadius: 9,
    flexDirection: 'row',
    gap: 4,
    marginLeft: 8,
    minHeight: 32,
    paddingHorizontal: 8,
  },

  statusActionText: {
    fontSize: 8,
    fontWeight: '900',
  },

  modalSafeArea: {
    flex: 1,
  },

  modalKeyboard: {
    flex: 1,
  },

  modalHeader: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 5,
  },

  modalHeaderAction: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 76,
  },

  modalTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },

  cancelText: {
    fontSize: 11,
    fontWeight: '800',
  },

  modalContent: {
    paddingBottom: 42,
    paddingHorizontal: 18,
    paddingTop: 18,
  },

  formNotice: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },

  formNoticeText: {
    flex: 1,
    fontSize: 9.5,
  },

  sectionLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  templateRow: {
    gap: 7,
    paddingRight: 8,
    paddingTop: 9,
  },

  templateChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 11,
  },

  templateChipText: {
    fontSize: 9,
    fontWeight: '800',
  },

  field: {
    marginTop: 18,
  },

  fieldCompact: {
    marginTop: 0,
  },

  fieldLabel: {
    fontSize: 8.5,
    fontWeight: '900',
    marginBottom: 7,
    textTransform: 'uppercase',
  },

  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 12,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  textArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },

  categoryLabel: {
    marginTop: 20,
  },

  categoryRow: {
    gap: 7,
    paddingRight: 8,
    paddingTop: 9,
  },

  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },

  categoryChipText: {
    fontSize: 9,
    fontWeight: '900',
  },

  parameterLabel: {
    marginTop: 20,
  },

  parameterRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 9,
  },

  parameterValue: {
    flex: 1.4,
  },

  parameterUnit: {
    flex: 1,
  },

  descriptionToggle: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 7,
    marginTop: 19,
    minHeight: 34,
  },

  descriptionToggleText: {
    fontSize: 10,
    fontWeight: '800',
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

  submitButtonText: {
    fontSize: 11,
    fontWeight: '900',
  },
});
