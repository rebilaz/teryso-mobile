import { useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Action, Copy, Field, SettingsPage } from '@/components/teryso/settings-ui';

export default function ResetPassword() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit() {
    if (busy) return;
    if (session && (password.length < 8 || password !== confirmation)) {
      setMessage('Utilisez au moins 8 caractères et deux mots de passe identiques.'); return;
    }
    if (!session && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setMessage('Saisissez une adresse email valide.'); return; }
    setBusy(true); setMessage('');
    try {
      const result = session
        ? await supabase.auth.updateUser({ password })
        : await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: Platform.OS === 'web' ? `${window.location.origin}/auth/callback?next=reset-password` : 'teryso://auth/callback?next=reset-password',
        });
      if (result.error) throw result.error;
      setPassword(''); setConfirmation('');
      setMessage(session ? 'Mot de passe mis à jour.' : 'Si un compte correspond à cette adresse, un lien vous sera envoyé. Ouvrez-le sur ce même appareil et navigateur.');
    } catch { setMessage('Opération impossible. Réessayez ou demandez un nouveau lien.'); }
    finally { setBusy(false); }
  }
  return <SettingsPage title={session ? 'Nouveau mot de passe' : 'Mot de passe oublié'}>
    {session ? <><Field label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" editable={!busy} />
      <Field label="Confirmer le mot de passe" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" editable={!busy} /></>
      : <Field label="Adresse email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} />}
    <Action label={busy ? 'Veuillez patienter…' : session ? 'Enregistrer le mot de passe' : 'Envoyer le lien'} disabled={busy} onPress={() => void submit()} />
    {message ? <Copy>{message}</Copy> : null}
  </SettingsPage>;
}
