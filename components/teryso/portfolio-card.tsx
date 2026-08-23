import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTerysoTheme } from '@/contexts/theme-context';
import type { PublicPortfolio } from '@/lib/teryso';

type PortfolioCardProps = {
  onPress: () => void;
  portfolio: PublicPortfolio;
};

export function PortfolioCard({ onPress, portfolio }: PortfolioCardProps) {
  const { colors } = useTerysoTheme();
  const ownerName = portfolio.owner?.displayName || portfolio.owner?.username || 'Teryso';

  return (
    <Pressable
      accessibilityHint="Ouvre le détail du portefeuille"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: pressed ? colors.borderStrong : colors.border,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceStrong }]}>
          <Text style={[styles.avatarText, { color: colors.text }]}>{ownerName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.ownerCopy}>
          <Text style={[styles.owner, { color: colors.text }]}>{ownerName}</Text>
          <Text style={[styles.username, { color: colors.textMuted }]}>@{portfolio.owner?.username ?? 'teryso'}</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={colors.text} />
      </View>

      <Text style={[styles.name, { color: colors.text }]}>{portfolio.name}</Text>
      <Text numberOfLines={3} style={[styles.description, { color: colors.textSecondary }]}>
        {portfolio.description || 'Un portefeuille public à suivre sur Teryso.'}
      </Text>

      <View style={styles.metaRow}>
        <View style={[styles.pill, { backgroundColor: colors.surfaceStrong }]}>
          <Text style={[styles.pillText, { color: colors.textSecondary }]}>{portfolio.baseCurrency}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: colors.surfaceStrong }]}>
          <Text style={[styles.pillText, { color: colors.textSecondary }]}>Compte unique</Text>
        </View>
        <Text style={[styles.followers, { color: colors.textMuted }]}>
          {portfolio.followers} abonné{portfolio.followers > 1 ? 's' : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 20 },
  topRow: { alignItems: 'center', flexDirection: 'row' },
  avatar: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  avatarText: { fontSize: 13, fontWeight: '900' },
  ownerCopy: { flex: 1, marginLeft: 11 },
  owner: { fontSize: 13, fontWeight: '800' },
  username: { fontSize: 11, marginTop: 2 },
  name: { fontSize: 22, fontWeight: '900', letterSpacing: -0.8, lineHeight: 27, marginTop: 20 },
  description: { fontSize: 14, lineHeight: 21, marginTop: 9 },
  metaRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  followers: { fontSize: 11, marginLeft: 'auto' },
});
