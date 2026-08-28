import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { useTerysoTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';

type BrandHeaderProps = {
  eyebrow?: string;
  title?: string;
};

export function BrandHeader({ eyebrow, title }: BrandHeaderProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ portfolioId?: string }>();
  const { session } = useAuth();
  const { colors, isDark, toggleTheme } = useTerysoTheme();

  const showPortfolioManagement =
    eyebrow === 'Gestion' && title === 'Portefeuille';

  async function openPortfolioManagement() {
    const requestedPortfolioId = Array.isArray(params.portfolioId)
      ? params.portfolioId[0]
      : params.portfolioId;

    if (requestedPortfolioId) {
      router.push({
        pathname: '/portfolio/manage',
        params: {
          portfolioId: requestedPortfolioId,
          section: 'transactions',
        },
      });
      return;
    }

    const userId = session?.user.id;

    if (!userId) {
      Alert.alert('Portefeuille', 'Utilisateur non connecté.');
      return;
    }

    const { data, error } = await supabase
      .from('portfolios')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data?.id) {
      Alert.alert(
        'Portefeuille',
        error?.message ?? 'Aucun portefeuille disponible.',
      );
      return;
    }

    router.push({
      pathname: '/portfolio/manage',
      params: {
        portfolioId: data.id,
        section: 'transactions',
      },
    });
  }

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <View style={[styles.brand, { backgroundColor: colors.brandFill }]}>
          <Text style={[styles.brandText, { color: colors.brandText }]}>Teryso</Text>
        </View>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{eyebrow}</Text> : null}
        {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
      </View>

      <View style={styles.actions}>
        {showPortfolioManagement ? (
          <Pressable
            accessibilityLabel="Ouvrir Transactions, Assemblée et Règles"
            accessibilityRole="button"
            onPress={() => void openPortfolioManagement()}
            style={({ pressed }) => [
              styles.themeButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.65 : 1,
              },
            ]}
          >
            <Ionicons name="options-outline" size={20} color={colors.text} />
          </Pressable>
        ) : null}

        <Pressable
          accessibilityLabel={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}
          accessibilityRole="button"
          onPress={toggleTheme}
          style={({ pressed }) => [
            styles.themeButton,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: 16, justifyContent: 'space-between' },
  copy: { flex: 1 },
  brand: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 },
  brandText: { fontSize: 22, fontWeight: '900', letterSpacing: -1.2 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginTop: 24, textTransform: 'uppercase' },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -1.6, lineHeight: 38, marginTop: 7 },
  actions: { flexDirection: 'row', gap: 8 },
  themeButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
});
