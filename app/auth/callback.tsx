import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { exchangeAuthCode } from '@/lib/auth-callback';
import { Action, Copy, SettingsPage } from '@/components/teryso/settings-ui';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; next?: string; error?: string }>();
  const router = useRouter();
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (params.error || typeof params.code !== 'string' || !params.code) throw new Error('Lien invalide ou expiré. Relancez la connexion ou demandez un nouveau lien.');
        await exchangeAuthCode(params.code);
        if (Platform.OS === 'web') window.history.replaceState({}, '', '/auth/callback');
        if (!cancelled) router.replace(params.next === 'reset-password' ? '/reset-password' : '/');
      } catch { if (!cancelled) setError('Ce lien ne peut pas être validé. Relancez la connexion ou demandez un nouveau lien sur cet appareil.'); }
    })();
    return () => { cancelled = true; };
  }, [params.code, params.next, params.error, router]);
  return <SettingsPage title="Connexion à Teryso">
    <Copy>{error || 'Validation de votre connexion…'}</Copy>
    {error ? <Action label="Retour à la connexion" onPress={() => router.replace('/login')} /> : null}
  </SettingsPage>;
}
