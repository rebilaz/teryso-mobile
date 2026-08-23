import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTerysoTheme } from '@/contexts/theme-context';
import type { ThemeColors } from '@/constants/theme';
import {
  getPortfolioSnapshot,
  getPublicPortfolioBySlug,
  PortfolioSnapshot,
  PublicPortfolio,
} from '@/lib/teryso';

export default function PortfolioDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTerysoTheme();
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    try {
      const nextPortfolio = await getPublicPortfolioBySlug(slug);
      setPortfolio(nextPortfolio);
      setSnapshot(nextPortfolio ? await getPortfolioSnapshot(nextPortfolio.id) : null);
    } catch {
      setError('Ce portefeuille ne peut pas être chargé.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <Text style={[styles.headerBrand, { color: colors.text }]}>Teryso</Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : error || !portfolio ? (
        <View style={styles.center}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Portefeuille introuvable</Text>
          <Text style={[styles.centerText, { color: colors.textSecondary }]}>{error ?? 'Ce portefeuille n’est plus public.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.ownerRow}>
            <View style={[styles.avatar, { backgroundColor: colors.surfaceStrong }]}>
              <Text style={[styles.avatarText, { color: colors.text }]}>
                {(portfolio.owner?.displayName || 'T').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={[styles.ownerName, { color: colors.text }]}>{portfolio.owner?.displayName || 'Teryso'}</Text>
              <Text style={[styles.ownerUsername, { color: colors.textMuted }]}>@{portfolio.owner?.username ?? 'teryso'}</Text>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{portfolio.name}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {portfolio.description || 'Un portefeuille public Teryso.'}
          </Text>

          <View style={styles.pills}>
            {[portfolio.baseCurrency, portfolio.governanceMode === 'assembly' ? 'Assemblée' : 'Piloté', 'Compte unique'].map((label) => (
              <View key={label} style={[styles.pill, { backgroundColor: colors.surfaceStrong }]}>
                <Text style={[styles.pillText, { color: colors.textSecondary }]}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.statement}>
            <Text style={styles.statementEyebrow}>Principe Teryso</Text>
            <Text style={styles.statementText}>Une stratégie publique, un portefeuille, un seul compte.</Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Vue d’ensemble</Text>
          {snapshot ? (
            <>
              <View style={styles.metricsGrid}>
                <MetricCard colors={colors} label="Performance" value={formatPercent(snapshot.performance)} />
                <MetricCard colors={colors} label="Actifs" value={snapshot.assetsCount?.toString() ?? '—'} />
              </View>

              {snapshot.holdings.length > 0 ? (
                <View style={[styles.holdingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {snapshot.holdings.slice(0, 8).map((holding, index) => (
                    <View
                      key={`${holding.symbol}-${index}`}
                      style={[styles.holdingRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}
                    >
                      <View style={styles.holdingCopy}>
                        <Text style={[styles.holdingSymbol, { color: colors.text }]}>{holding.symbol}</Text>
                        <Text numberOfLines={1} style={[styles.holdingName, { color: colors.textMuted }]}>{holding.name}</Text>
                      </View>
                      <Text style={[styles.holdingPercent, { color: colors.text }]}>
                        {formatPercent(holding.allocationPercent)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <View style={[styles.lockedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="shield-checkmark-outline" size={24} color={colors.text} />
              <Text style={[styles.lockedTitle, { color: colors.text }]}>Données détaillées protégées</Text>
              <Text style={[styles.centerText, { color: colors.textSecondary }]}>
                Connectez-vous pour consulter les métriques que les règles Supabase vous autorisent à voir.
              </Text>
            </View>
          )}

          <Text style={[styles.risk, { color: colors.textMuted }]}>
            Teryso ne fournit aucun conseil financier. Investir comporte un risque de perte en capital.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );

}

function MetricCard({ colors, label, value }: { colors: ThemeColors; label: string; value: string }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function formatPercent(value: number | null) {
  if (value === null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 },
  iconButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  iconButtonPlaceholder: { width: 42 },
  headerBrand: { fontSize: 19, fontWeight: '900', letterSpacing: -0.8 },
  center: { alignItems: 'center', flex: 1, gap: 10, justifyContent: 'center', padding: 28 },
  centerText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  errorTitle: { fontSize: 20, fontWeight: '900' },
  content: { paddingBottom: 38, paddingHorizontal: 18, paddingTop: 24 },
  ownerRow: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  avatar: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  avatarText: { fontSize: 14, fontWeight: '900' },
  ownerName: { fontSize: 13, fontWeight: '900' },
  ownerUsername: { fontSize: 11, marginTop: 2 },
  title: { fontSize: 38, fontWeight: '900', letterSpacing: -1.8, lineHeight: 42, marginTop: 24 },
  description: { fontSize: 15, lineHeight: 23, marginTop: 14 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  pill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  pillText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statement: { backgroundColor: '#000000', borderRadius: 22, marginTop: 28, padding: 22 },
  statementEyebrow: { color: '#8D8D8D', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  statementText: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', letterSpacing: -0.7, lineHeight: 27, marginTop: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginBottom: 13, marginTop: 30 },
  metricsGrid: { flexDirection: 'row', gap: 10 },
  metricCard: { borderRadius: 18, borderWidth: 1, flex: 1, padding: 17 },
  metricLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  metricValue: { fontSize: 24, fontWeight: '900', letterSpacing: -0.8, marginTop: 8 },
  holdingsCard: { borderRadius: 20, borderWidth: 1, marginTop: 12, overflow: 'hidden' },
  holdingRow: { alignItems: 'center', flexDirection: 'row', paddingHorizontal: 17, paddingVertical: 14 },
  holdingCopy: { flex: 1 },
  holdingSymbol: { fontSize: 13, fontWeight: '900' },
  holdingName: { fontSize: 11, marginTop: 3 },
  holdingPercent: { fontSize: 13, fontWeight: '900' },
  lockedCard: { alignItems: 'center', borderRadius: 20, borderWidth: 1, gap: 9, padding: 22 },
  lockedTitle: { fontSize: 15, fontWeight: '900' },
  risk: { fontSize: 10, lineHeight: 16, marginTop: 28, textAlign: 'center' },
});
