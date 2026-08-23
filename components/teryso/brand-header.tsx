import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTerysoTheme } from '@/contexts/theme-context';

type BrandHeaderProps = {
  eyebrow?: string;
  title?: string;
};

export function BrandHeader({ eyebrow, title }: BrandHeaderProps) {
  const { colors, isDark, toggleTheme } = useTerysoTheme();

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <View style={[styles.brand, { backgroundColor: colors.brandFill }]}>
          <Text style={[styles.brandText, { color: colors.brandText }]}>Teryso</Text>
        </View>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{eyebrow}</Text> : null}
        {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
      </View>

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
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: 16, justifyContent: 'space-between' },
  copy: { flex: 1 },
  brand: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 },
  brandText: { fontSize: 22, fontWeight: '900', letterSpacing: -1.2 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginTop: 24, textTransform: 'uppercase' },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -1.6, lineHeight: 38, marginTop: 7 },
  themeButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
});
