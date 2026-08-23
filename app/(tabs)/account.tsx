import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandHeader } from '@/components/teryso/brand-header';
import { useAuth } from '@/contexts/auth-context';
import { useTerysoTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';

type OwnProfile = {
  username: string;
  display_name: string;
  bio: string;
};

export default function AccountScreen() {
  const { isLoading: authLoading, session } = useAuth();
  const { colors } = useTerysoTheme();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<OwnProfile | null>(null);

  useEffect(() => {
    if (!session?.user.id) {
      setProfile(null);
      return;
    }

    let cancelled = false;

    supabase
      .from('profiles')
      .select('username,display_name,bio')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile((data as OwnProfile | null) ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert('Informations incomplètes', 'Saisissez un email valide et un mot de passe d’au moins 6 caractères.');
      return;
    }

    setSubmitting(true);
    const credentials = { email: email.trim(), password };
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp(credentials);
    setSubmitting(false);

    if (result.error) {
      Alert.alert('Connexion impossible', result.error.message);
      return;
    }

    if (mode === 'signup' && !result.data.session) {
      Alert.alert('Confirmez votre email', 'Un lien de confirmation vient de vous être envoyé.');
    }
  };

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.loadingScreen, { backgroundColor: colors.page }]}>
        <ActivityIndicator color={colors.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.page }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BrandHeader eyebrow="Votre espace" title={session ? 'Compte Teryso' : 'Se connecter'} />

          {session ? (
            <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.profileAvatar, { backgroundColor: colors.brandFill }]}>
                <Text style={[styles.profileAvatarText, { color: colors.brandText }]}>
                  {(profile?.display_name || session.user.email || 'T').slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.profileName, { color: colors.text }]}>
                {profile?.display_name || profile?.username || 'Investisseur Teryso'}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textMuted }]}>{session.user.email}</Text>
              {profile?.bio ? <Text style={[styles.bio, { color: colors.textSecondary }]}>{profile.bio}</Text> : null}

              <View style={[styles.infoRow, { backgroundColor: colors.surfaceStrong }]}>
                <Ionicons name="wallet-outline" size={20} color={colors.text} />
                <View style={styles.infoCopy}>
                  <Text style={[styles.infoTitle, { color: colors.text }]}>Un portefeuille, un compte</Text>
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>La structure mobile suit le modèle simplifié de Teryso.</Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => void supabase.auth.signOut()}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: colors.borderStrong, opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Se déconnecter</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.authCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.segment, { backgroundColor: colors.surfaceStrong }]}>
                {(['signin', 'signup'] as const).map((item) => {
                  const active = item === mode;
                  return (
                    <Pressable
                      key={item}
                      accessibilityRole="button"
                      onPress={() => setMode(item)}
                      style={[styles.segmentButton, active && { backgroundColor: colors.surface }]}
                    >
                      <Text style={[styles.segmentText, { color: active ? colors.text : colors.textMuted }]}>
                        {item === 'signin' ? 'Connexion' : 'Créer un compte'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="vous@exemple.com"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                value={email}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Mot de passe</Text>
              <TextInput
                autoCapitalize="none"
                onChangeText={setPassword}
                placeholder="6 caractères minimum"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                value={password}
              />

              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: colors.brandFill, opacity: pressed || submitting ? 0.65 : 1 },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.brandText} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: colors.brandText }]}>
                    {mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
                  </Text>
                )}
              </Pressable>

              <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
                En continuant, vous acceptez les conditions générales et la politique de confidentialité de Teryso.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  loadingScreen: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { paddingBottom: 36, paddingHorizontal: 18, paddingTop: 14 },
  authCard: { borderRadius: 24, borderWidth: 1, marginTop: 28, padding: 20 },
  segment: { borderRadius: 13, flexDirection: 'row', padding: 4 },
  segmentButton: { alignItems: 'center', borderRadius: 10, flex: 1, paddingHorizontal: 8, paddingVertical: 10 },
  segmentText: { fontSize: 12, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 8, marginTop: 20 },
  input: { borderRadius: 14, borderWidth: 1, fontSize: 15, height: 52, paddingHorizontal: 14 },
  primaryButton: { alignItems: 'center', borderRadius: 14, height: 52, justifyContent: 'center', marginTop: 22 },
  primaryButtonText: { fontSize: 14, fontWeight: '900' },
  disclaimer: { fontSize: 11, lineHeight: 17, marginTop: 16, textAlign: 'center' },
  profileCard: { alignItems: 'center', borderRadius: 24, borderWidth: 1, marginTop: 28, padding: 22 },
  profileAvatar: { alignItems: 'center', borderRadius: 30, height: 60, justifyContent: 'center', width: 60 },
  profileAvatarText: { fontSize: 23, fontWeight: '900' },
  profileName: { fontSize: 22, fontWeight: '900', letterSpacing: -0.7, marginTop: 14 },
  profileEmail: { fontSize: 12, marginTop: 5 },
  bio: { fontSize: 13, lineHeight: 20, marginTop: 14, textAlign: 'center' },
  infoRow: { alignItems: 'flex-start', borderRadius: 16, flexDirection: 'row', gap: 12, marginTop: 24, padding: 16, width: '100%' },
  infoCopy: { flex: 1 },
  infoTitle: { fontSize: 13, fontWeight: '900' },
  infoText: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  secondaryButton: { alignItems: 'center', borderRadius: 14, borderWidth: 1, height: 50, justifyContent: 'center', marginTop: 20, width: '100%' },
  secondaryButtonText: { fontSize: 13, fontWeight: '900' },
});
