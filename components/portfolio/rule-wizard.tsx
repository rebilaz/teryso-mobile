import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTerysoTheme } from '@/contexts/theme-context';

export type RuleWizardAsset = {
  asset_id: string;
  asset_type: string;
  symbol: string;
  name: string;
};

export type RuleWizardPayload = {
  title: string;
  description: string;
  category: string;
  config: Record<string, unknown>;
};

type RuleType =
  | 'max_allocation'
  | 'min_allocation'
  | 'forbidden_assets'
  | 'allowed_assets'
  | 'min_cash'
  | 'min_assets';

type ScopeMode = 'all_assets' | 'selected_assets' | 'portfolio';

type RuleTypeDefinition = {
  id: RuleType;
  title: string;
  description: string;
  category: string;
  icon:
    | 'pie-chart-outline'
    | 'resize-outline'
    | 'ban-outline'
    | 'checkmark-circle-outline'
    | 'cash-outline'
    | 'layers-outline';
  needsAssets: boolean;
  allowAllAssets: boolean;
  needsValue: boolean;
  unit: string;
  defaultValue: string;
};

const RULE_TYPES: RuleTypeDefinition[] = [
  {
    id: 'max_allocation',
    title: 'Allocation maximale',
    description: 'Limiter le poids maximal de chaque actif concerné.',
    category: 'Allocation',
    icon: 'pie-chart-outline',
    needsAssets: true,
    allowAllAssets: true,
    needsValue: true,
    unit: '%',
    defaultValue: '25',
  },
  {
    id: 'min_allocation',
    title: 'Allocation minimale',
    description: 'Imposer un poids minimum aux actifs concernés.',
    category: 'Allocation',
    icon: 'resize-outline',
    needsAssets: true,
    allowAllAssets: true,
    needsValue: true,
    unit: '%',
    defaultValue: '5',
  },
  {
    id: 'forbidden_assets',
    title: 'Actifs interdits',
    description: 'Interdire la détention de certains actifs.',
    category: 'Actifs',
    icon: 'ban-outline',
    needsAssets: true,
    allowAllAssets: false,
    needsValue: false,
    unit: '',
    defaultValue: '',
  },
  {
    id: 'allowed_assets',
    title: 'Actifs autorisés',
    description: 'Limiter le portefeuille à une liste précise d’actifs.',
    category: 'Actifs',
    icon: 'checkmark-circle-outline',
    needsAssets: true,
    allowAllAssets: false,
    needsValue: false,
    unit: '',
    defaultValue: '',
  },
  {
    id: 'min_cash',
    title: 'Liquidités minimales',
    description: 'Conserver une réserve minimale de liquidités.',
    category: 'Liquidité',
    icon: 'cash-outline',
    needsAssets: false,
    allowAllAssets: false,
    needsValue: true,
    unit: '%',
    defaultValue: '10',
  },
  {
    id: 'min_assets',
    title: 'Diversification minimale',
    description: 'Maintenir un nombre minimum d’actifs dans le portefeuille.',
    category: 'Risque',
    icon: 'layers-outline',
    needsAssets: false,
    allowAllAssets: false,
    needsValue: true,
    unit: 'actifs',
    defaultValue: '5',
  },
];

function normalizeValue(value: string) {
  const clean = value.trim();
  if (!clean) return null;
  const numeric = Number(clean.replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : clean;
}

function automaticTitle(
  definition: RuleTypeDefinition,
  scopeMode: ScopeMode,
  assets: RuleWizardAsset[],
) {
  if (!definition.needsAssets || scopeMode === 'portfolio') return definition.title;
  if (scopeMode === 'all_assets') return `${definition.title} · Tous les actifs`;
  if (!assets.length) return definition.title;

  const symbols = assets.map((asset) => asset.symbol);
  if (symbols.length <= 3) return `${definition.title} · ${symbols.join(', ')}`;
  return `${definition.title} · ${symbols.slice(0, 3).join(', ')} +${symbols.length - 3}`;
}

export function RuleWizard({
  visible,
  assets,
  saving,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  assets: RuleWizardAsset[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: RuleWizardPayload) => void;
}) {
  const { colors } = useTerysoTheme();
  const [step, setStep] = useState(1);
  const [ruleType, setRuleType] = useState<RuleType | null>(null);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('selected_assets');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [parameterValue, setParameterValue] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const definition = useMemo(
    () => RULE_TYPES.find((item) => item.id === ruleType) ?? null,
    [ruleType],
  );

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedAssetIds.includes(asset.asset_id)),
    [assets, selectedAssetIds],
  );

  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLocaleLowerCase('fr');
    if (!query) return assets;

    return assets.filter((asset) =>
      `${asset.symbol} ${asset.name} ${asset.asset_type}`
        .toLocaleLowerCase('fr')
        .includes(query),
    );
  }, [assetSearch, assets]);

  function reset() {
    setStep(1);
    setRuleType(null);
    setScopeMode('selected_assets');
    setSelectedAssetIds([]);
    setAssetSearch('');
    setParameterValue('');
    setDescription('');
    setError(null);
  }

  function close() {
    if (saving) return;
    reset();
    onClose();
  }

  function chooseType(item: RuleTypeDefinition) {
    setRuleType(item.id);
    setParameterValue(item.defaultValue);
    setSelectedAssetIds([]);
    setAssetSearch('');
    setError(null);
    setScopeMode(
      !item.needsAssets
        ? 'portfolio'
        : item.allowAllAssets
          ? 'all_assets'
          : 'selected_assets',
    );
  }

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId],
    );
  }

  function validate(currentStep: number) {
    if (currentStep === 1 && !definition) return 'Choisis un type de règle.';

    if (
      currentStep === 2 &&
      definition?.needsAssets &&
      scopeMode === 'selected_assets' &&
      selectedAssetIds.length === 0
    ) {
      return 'Sélectionne au moins un actif.';
    }

    if (currentStep === 3 && definition?.needsValue) {
      const value = normalizeValue(parameterValue);
      if (value === null || typeof value !== 'number') return 'Entre une valeur numérique.';
      if (value < 0) return 'La valeur doit être positive.';

      if (
        ['max_allocation', 'min_allocation', 'min_cash'].includes(definition.id) &&
        value > 100
      ) {
        return 'Le pourcentage ne peut pas dépasser 100 %.';
      }

      if (definition.id === 'min_assets' && value < 1) {
        return 'Le nombre minimum d’actifs doit être au moins 1.';
      }
    }

    return null;
  }

  function next() {
    const validationError = validate(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep((current) => Math.min(4, current + 1));
  }

  function back() {
    setError(null);
    setStep((current) => Math.max(1, current - 1));
  }

  function submit() {
    if (!definition) return;

    const validationError = validate(1) || validate(2) || validate(3);
    if (validationError) {
      setError(validationError);
      return;
    }

    const scope =
      scopeMode === 'portfolio'
        ? { type: 'portfolio' }
        : scopeMode === 'all_assets'
          ? { type: 'all_assets' }
          : { type: 'assets', asset_ids: selectedAssetIds };

    const config: Record<string, unknown> = {
      type: definition.id,
      scope,
    };

    if (definition.needsValue) {
      config.value = normalizeValue(parameterValue);
      config.unit = definition.unit;
    }

    onSubmit({
      title: automaticTitle(definition, scopeMode, selectedAssets),
      description: description.trim(),
      category: definition.category,
      config,
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.page }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={close} disabled={saving} style={styles.headerAction}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Annuler</Text>
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Nouvelle règle</Text>
            <Text style={[styles.stepText, { color: colors.textMuted }]}>Étape {step} sur 4</Text>
          </View>

          <View style={styles.headerAction} />
        </View>

        <View style={styles.progressTrack}>
          {[1, 2, 3, 4].map((item) => (
            <View
              key={item}
              style={[
                styles.progressSegment,
                { backgroundColor: item <= step ? colors.accent : colors.border },
              ]}
            />
          ))}
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {step === 1 ? (
            <StepType selected={ruleType} onSelect={chooseType} />
          ) : null}

          {step === 2 && definition ? (
            <StepScope
              definition={definition}
              assets={filteredAssets}
              allAssetsCount={assets.length}
              scopeMode={scopeMode}
              onScopeModeChange={setScopeMode}
              selectedAssetIds={selectedAssetIds}
              onToggleAsset={toggleAsset}
              search={assetSearch}
              onSearchChange={setAssetSearch}
            />
          ) : null}

          {step === 3 && definition ? (
            <StepParameter
              definition={definition}
              scopeMode={scopeMode}
              selectedAssets={selectedAssets}
              value={parameterValue}
              onValueChange={setParameterValue}
              description={description}
              onDescriptionChange={setDescription}
            />
          ) : null}

          {step === 4 && definition ? (
            <StepReview
              definition={definition}
              scopeMode={scopeMode}
              selectedAssets={selectedAssets}
              value={parameterValue}
              description={description}
            />
          ) : null}

          {error ? (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="alert-circle-outline" size={17} color={colors.negative} />
              <Text style={[styles.errorText, { color: colors.negative }]}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {step > 1 ? (
            <Pressable
              onPress={back}
              disabled={saving}
              style={[
                styles.secondaryButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="arrow-back" size={16} color={colors.text} />
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Retour</Text>
            </Pressable>
          ) : (
            <View />
          )}

          {step < 4 ? (
            <Pressable
              onPress={next}
              style={[styles.primaryButton, { backgroundColor: colors.brandFill }]}
            >
              <Text style={[styles.primaryButtonText, { color: colors.brandText }]}>Continuer</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.brandText} />
            </Pressable>
          ) : (
            <Pressable
              disabled={saving}
              onPress={submit}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.brandFill, opacity: saving ? 0.65 : 1 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.brandText} />
              ) : (
                <>
                  <Text style={[styles.primaryButtonText, { color: colors.brandText }]}>Créer la règle</Text>
                  <Ionicons name="checkmark" size={17} color={colors.brandText} />
                </>
              )}
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function StepType({
  selected,
  onSelect,
}: {
  selected: RuleType | null;
  onSelect: (item: RuleTypeDefinition) => void;
}) {
  const { colors } = useTerysoTheme();

  return (
    <>
      <Text style={[styles.title, { color: colors.text }]}>Quel type de règle ?</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Choisis le comportement à imposer au portefeuille.
      </Text>

      <View style={styles.typeList}>
        {RULE_TYPES.map((item) => {
          const active = selected === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item)}
              style={[
                styles.typeCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <View style={[styles.typeIcon, { backgroundColor: colors.surfaceStrong }]}>
                <Ionicons name={item.icon} size={19} color={colors.text} />
              </View>
              <View style={styles.typeCopy}>
                <Text style={[styles.typeTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.typeDescription, { color: colors.textMuted }]}>{item.description}</Text>
              </View>
              <SelectionDot selected={active} />
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

function StepScope({
  definition,
  assets,
  allAssetsCount,
  scopeMode,
  onScopeModeChange,
  selectedAssetIds,
  onToggleAsset,
  search,
  onSearchChange,
}: {
  definition: RuleTypeDefinition;
  assets: RuleWizardAsset[];
  allAssetsCount: number;
  scopeMode: ScopeMode;
  onScopeModeChange: (value: ScopeMode) => void;
  selectedAssetIds: string[];
  onToggleAsset: (assetId: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const { colors } = useTerysoTheme();

  if (!definition.needsAssets) {
    return (
      <>
        <Text style={[styles.title, { color: colors.text }]}>Portée de la règle</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Cette règle concerne tout le portefeuille.</Text>
        <View style={[styles.globalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="briefcase-outline" size={20} color={colors.text} />
          <View style={styles.flex}>
            <Text style={[styles.scopeTitle, { color: colors.text }]}>Portefeuille entier</Text>
            <Text style={[styles.scopeDescription, { color: colors.textMuted }]}>Aucun actif à sélectionner.</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Text style={[styles.title, { color: colors.text }]}>À quels actifs ?</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Choisis les actifs concernés par cette règle.</Text>

      {definition.allowAllAssets ? (
        <View style={styles.scopeOptions}>
          <ScopeOption
            title="Tous les actifs"
            description={`${allAssetsCount} actif${allAssetsCount > 1 ? 's' : ''} du portefeuille`}
            selected={scopeMode === 'all_assets'}
            onPress={() => onScopeModeChange('all_assets')}
          />
          <ScopeOption
            title="Certains actifs"
            description="Sélectionner une liste précise"
            selected={scopeMode === 'selected_assets'}
            onPress={() => onScopeModeChange('selected_assets')}
          />
        </View>
      ) : null}

      {scopeMode === 'selected_assets' ? (
        <>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={17} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={onSearchChange}
              placeholder="Rechercher un actif"
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>

          <View style={styles.assetList}>
            {assets.map((asset) => (
              <Pressable
                key={asset.asset_id}
                onPress={() => onToggleAsset(asset.asset_id)}
                style={[
                  styles.assetCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: selectedAssetIds.includes(asset.asset_id)
                      ? colors.accent
                      : colors.border,
                  },
                ]}
              >
                <View style={[styles.assetInitial, { backgroundColor: colors.surfaceStrong }]}>
                  <Text style={[styles.assetInitialText, { color: colors.text }]}>{asset.symbol.slice(0, 1)}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.assetSymbol, { color: colors.text }]}>{asset.symbol}</Text>
                  <Text numberOfLines={1} style={[styles.assetName, { color: colors.textMuted }]}>{asset.name}</Text>
                </View>
                <SelectionDot selected={selectedAssetIds.includes(asset.asset_id)} />
              </Pressable>
            ))}
          </View>

          {!assets.length ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Aucun actif trouvé.</Text>
          ) : null}

          <Text style={[styles.selectionCount, { color: colors.textMuted }]}>
            {selectedAssetIds.length} sélectionné{selectedAssetIds.length > 1 ? 's' : ''}
          </Text>
        </>
      ) : null}
    </>
  );
}

function StepParameter({
  definition,
  scopeMode,
  selectedAssets,
  value,
  onValueChange,
  description,
  onDescriptionChange,
}: {
  definition: RuleTypeDefinition;
  scopeMode: ScopeMode;
  selectedAssets: RuleWizardAsset[];
  value: string;
  onValueChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
}) {
  const { colors } = useTerysoTheme();

  return (
    <>
      <Text style={[styles.title, { color: colors.text }]}>Définir la règle</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{automaticTitle(definition, scopeMode, selectedAssets)}</Text>

      {selectedAssets.length ? (
        <View style={styles.assetPills}>
          {selectedAssets.map((asset) => (
            <View key={asset.asset_id} style={[styles.assetPill, { backgroundColor: colors.surfaceStrong }]}>
              <Text style={[styles.assetPillText, { color: colors.text }]}>{asset.symbol}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {definition.needsValue ? (
        <>
          <Text style={[styles.label, { color: colors.textMuted }]}>VALEUR</Text>
          <View style={[styles.valueRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              value={value}
              onChangeText={onValueChange}
              keyboardType="decimal-pad"
              placeholder={definition.defaultValue}
              placeholderTextColor={colors.textMuted}
              style={[styles.valueInput, { color: colors.text }]}
            />
            <View style={[styles.unitPill, { backgroundColor: colors.surfaceStrong }]}>
              <Text style={[styles.unitText, { color: colors.textSecondary }]}>{definition.unit}</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={[styles.noValueCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.positive} />
          <Text style={[styles.noValueText, { color: colors.textSecondary }]}>Aucune valeur numérique nécessaire.</Text>
        </View>
      )}

      <Text style={[styles.label, { color: colors.textMuted }]}>DESCRIPTION · FACULTATIF</Text>
      <TextInput
        value={description}
        onChangeText={onDescriptionChange}
        multiline
        placeholder="Ajouter une précision…"
        placeholderTextColor={colors.textMuted}
        style={[styles.descriptionInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
      />
    </>
  );
}

function StepReview({
  definition,
  scopeMode,
  selectedAssets,
  value,
  description,
}: {
  definition: RuleTypeDefinition;
  scopeMode: ScopeMode;
  selectedAssets: RuleWizardAsset[];
  value: string;
  description: string;
}) {
  const { colors } = useTerysoTheme();
  const scope =
    scopeMode === 'portfolio'
      ? 'Portefeuille entier'
      : scopeMode === 'all_assets'
        ? 'Tous les actifs'
        : selectedAssets.map((asset) => asset.symbol).join(' · ');

  return (
    <>
      <Text style={[styles.title, { color: colors.text }]}>Vérifier la règle</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Confirme les paramètres avant création.</Text>

      <View style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ReviewRow label="Type" value={definition.title} />
        <ReviewRow label="Portée" value={scope || '—'} />
        {definition.needsValue ? <ReviewRow label="Valeur" value={`${value} ${definition.unit}`} /> : null}
        <ReviewRow label="Catégorie" value={definition.category} />
      </View>

      <View style={[styles.summaryBox, { backgroundColor: colors.surfaceStrong }]}>
        <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
        <Text style={[styles.summaryText, { color: colors.textSecondary }]}>{reviewSentence(definition, scopeMode, selectedAssets, value)}</Text>
      </View>

      {description.trim() ? (
        <Text style={[styles.reviewDescription, { color: colors.textSecondary }]}>{description.trim()}</Text>
      ) : null}
    </>
  );
}

function reviewSentence(
  definition: RuleTypeDefinition,
  scopeMode: ScopeMode,
  selectedAssets: RuleWizardAsset[],
  value: string,
) {
  const target =
    scopeMode === 'portfolio'
      ? 'Le portefeuille'
      : scopeMode === 'all_assets'
        ? 'Chaque actif du portefeuille'
        : selectedAssets.length === 1
          ? selectedAssets[0].symbol
          : `${selectedAssets.length} actifs sélectionnés`;

  switch (definition.id) {
    case 'max_allocation':
      return `${target} ne pourra pas dépasser ${value} % d’allocation.`;
    case 'min_allocation':
      return `${target} devra conserver au moins ${value} % d’allocation.`;
    case 'forbidden_assets':
      return `${target} sera interdit dans le portefeuille.`;
    case 'allowed_assets':
      return `Le portefeuille sera limité aux actifs sélectionnés.`;
    case 'min_cash':
      return `Le portefeuille devra conserver au moins ${value} % de liquidités.`;
    case 'min_assets':
      return `Le portefeuille devra contenir au moins ${value} actifs.`;
  }
}

function ScopeOption({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTerysoTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.scopeCard, { backgroundColor: colors.surface, borderColor: selected ? colors.accent : colors.border }]}
    >
      <View style={styles.flex}>
        <Text style={[styles.scopeTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.scopeDescription, { color: colors.textMuted }]}>{description}</Text>
      </View>
      <SelectionDot selected={selected} />
    </Pressable>
  );
}

function SelectionDot({ selected }: { selected: boolean }) {
  const { colors } = useTerysoTheme();
  return (
    <View style={[styles.dot, { borderColor: selected ? colors.accent : colors.border }]}>
      {selected ? <View style={[styles.dotInner, { backgroundColor: colors.accent }]} /> : null}
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTerysoTheme();
  return (
    <View style={styles.reviewRow}>
      <Text style={[styles.reviewLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.reviewValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 60, paddingHorizontal: 5 },
  headerAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 76 },
  cancelText: { fontSize: 11, fontWeight: '800' },
  headerCopy: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 14, fontWeight: '900' },
  stepText: { fontSize: 8, marginTop: 2 },
  progressTrack: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingTop: 10 },
  progressSegment: { borderRadius: 999, flex: 1, height: 3 },
  content: { paddingBottom: 24, paddingHorizontal: 18, paddingTop: 22 },
  title: { fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 10.5, lineHeight: 16, marginTop: 5 },
  typeList: { gap: 8, marginTop: 19 },
  typeCard: { alignItems: 'center', borderRadius: 15, borderWidth: 1, flexDirection: 'row', minHeight: 75, padding: 12 },
  typeIcon: { alignItems: 'center', borderRadius: 11, height: 40, justifyContent: 'center', width: 40 },
  typeCopy: { flex: 1, marginHorizontal: 11 },
  typeTitle: { fontSize: 11, fontWeight: '900' },
  typeDescription: { fontSize: 8.5, lineHeight: 13, marginTop: 3 },
  dot: { alignItems: 'center', borderRadius: 999, borderWidth: 1.5, height: 20, justifyContent: 'center', width: 20 },
  dotInner: { borderRadius: 999, height: 10, width: 10 },
  scopeOptions: { gap: 8, marginTop: 19 },
  scopeCard: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', padding: 12 },
  globalCard: { alignItems: 'center', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 11, marginTop: 20, padding: 14 },
  scopeTitle: { fontSize: 10.5, fontWeight: '900' },
  scopeDescription: { fontSize: 8.5, marginTop: 3 },
  searchBox: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, marginTop: 17, minHeight: 46, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 11, minHeight: 44, paddingVertical: 0 },
  assetList: { gap: 7, marginTop: 10 },
  assetCard: { alignItems: 'center', borderRadius: 13, borderWidth: 1, flexDirection: 'row', minHeight: 59, padding: 10 },
  assetInitial: { alignItems: 'center', borderRadius: 999, height: 34, justifyContent: 'center', width: 34 },
  assetInitialText: { fontSize: 12, fontWeight: '900' },
  assetSymbol: { fontSize: 10.5, fontWeight: '900' },
  assetName: { fontSize: 8.5, marginTop: 2 },
  selectionCount: { fontSize: 8.5, marginTop: 11, textAlign: 'right' },
  emptyText: { fontSize: 9.5, marginTop: 18, textAlign: 'center' },
  assetPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16 },
  assetPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  assetPillText: { fontSize: 8.5, fontWeight: '900' },
  label: { fontSize: 8, fontWeight: '900', letterSpacing: 0.45, marginTop: 22 },
  valueRow: { alignItems: 'center', borderRadius: 13, borderWidth: 1, flexDirection: 'row', marginTop: 8, minHeight: 52, paddingHorizontal: 12 },
  valueInput: { flex: 1, fontSize: 14, minHeight: 50, paddingVertical: 0 },
  unitPill: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  unitText: { fontSize: 9, fontWeight: '900' },
  noValueCard: { alignItems: 'flex-start', borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 8, marginTop: 20, padding: 12 },
  noValueText: { flex: 1, fontSize: 9.5, lineHeight: 14 },
  descriptionInput: { borderRadius: 13, borderWidth: 1, fontSize: 11, marginTop: 8, minHeight: 88, padding: 12, textAlignVertical: 'top' },
  reviewCard: { borderRadius: 15, borderWidth: 1, marginTop: 20, padding: 14 },
  reviewRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 20, justifyContent: 'space-between', paddingVertical: 8 },
  reviewLabel: { fontSize: 8.5, fontWeight: '700' },
  reviewValue: { flex: 1, fontSize: 10, fontWeight: '900', textAlign: 'right' },
  summaryBox: { alignItems: 'flex-start', borderRadius: 13, flexDirection: 'row', gap: 8, marginTop: 12, padding: 12 },
  summaryText: { flex: 1, fontSize: 9.5, lineHeight: 15 },
  reviewDescription: { fontSize: 10, lineHeight: 15, marginTop: 16 },
  errorBox: { alignItems: 'flex-start', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, marginTop: 18, padding: 11 },
  errorText: { flex: 1, fontSize: 9.5, lineHeight: 14 },
  footer: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 9, justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  secondaryButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 46, paddingHorizontal: 14 },
  secondaryButtonText: { fontSize: 10, fontWeight: '900' },
  primaryButton: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 46, minWidth: 135, paddingHorizontal: 16 },
  primaryButtonText: { fontSize: 10, fontWeight: '900' },
  flex: { flex: 1 },
});
