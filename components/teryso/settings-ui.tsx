import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, Text, TextInput, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTerysoTheme } from '@/contexts/theme-context';

export function SettingsPage({ title, children }: PropsWithChildren<{ title: string }>) {
  const { colors } = useTerysoTheme();
  const router = useRouter();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 16 }}>
      <Action label="Retour" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
      <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>{title}</Text>
      {children}
    </ScrollView>
  </SafeAreaView>;
}

export function Copy({ children }: PropsWithChildren) {
  const { colors } = useTerysoTheme();
  return <Text style={{ color: colors.text, fontSize: 15, lineHeight: 23 }}>{children}</Text>;
}

export function Action({ label, onPress, disabled = false, danger = false }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const { colors } = useTerysoTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={{ padding: 14, minHeight: 48, borderRadius: 12, backgroundColor: colors.surfaceStrong, opacity: disabled ? 0.5 : 1 }}>
    <Text style={{ fontWeight: '700', color: danger ? colors.negative : colors.text }}>{label}</Text>
  </Pressable>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTerysoTheme();
  return <><Copy>{label}</Copy><TextInput accessibilityLabel={label} placeholderTextColor={colors.textMuted}
    style={{ color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 14 }} {...props} /></>;
}
