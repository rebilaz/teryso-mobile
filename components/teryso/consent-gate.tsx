import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { LEGAL_VERSION } from '@/lib/legal';
import { Action, Copy } from './settings-ui';
import { LegalLinks } from './legal-links';
import { useTerysoTheme } from '@/contexts/theme-context';

export function ConsentGate({ children }: PropsWithChildren) {
  const { session, signOut } = useAuth();
  const { colors } = useTerysoTheme();
  const path = usePathname();
  const router = useRouter();
  const [acceptedUser, setAcceptedUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const userId = session?.user.id;
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    void (async () => {
      try {
        const { data, error: failure } = await supabase.from('community_acceptances').select('version').eq('user_id', userId).eq('version', LEGAL_VERSION).maybeSingle();
        if (failure) throw failure;
        if (!cancelled && data) setAcceptedUser(userId);
      } catch { if (!cancelled) setError('Impossible de vérifier votre acceptation. Réessayez.'); }
      finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  async function accept() {
    if (!userId || busy) return;
    setBusy(true); setError('');
    try {
      const { error: failure } = await supabase.rpc('accept_community_terms', { p_version: LEGAL_VERSION });
      if (failure) throw failure;
      setAcceptedUser(userId);
    } catch { setError('Enregistrement impossible. Veuillez réessayer.'); }
    finally { setBusy(false); }
  }

  if (!userId || acceptedUser === userId || ['/legal', '/account-settings', '/delete-account', '/auth/callback', '/reset-password'].includes(path)) return children;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
    <Copy>Avant de participer à Teryso, consultez et acceptez nos conditions et règles communautaires.</Copy>
    <LegalLinks />
    {error ? <Copy>{error}</Copy> : null}
    {busy ? <ActivityIndicator /> : null}
    <Action label="J’accepte les CGU et les règles communautaires" disabled={busy} onPress={() => void accept()} />
    <Action label="Supprimer mon compte" onPress={() => router.push('/delete-account')} />
    <Action label="Se déconnecter" disabled={busy} onPress={() => void signOut().catch(() => setError('Déconnexion impossible. Réessayez.'))} />
  </ScrollView></SafeAreaView>;
}
