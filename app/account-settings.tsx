import { useEffect, useState } from 'react';
import { Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Action, Copy, Field, SettingsPage } from '@/components/teryso/settings-ui';
import { LegalLinks } from '@/components/teryso/legal-links';
import { openExternal, SUPPORT_EMAIL } from '@/lib/legal';

export default function AccountSettings() {
  const { session } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [isPublic, setPublic] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [blocks, setBlocks] = useState<{ blocked_id: string }[]>([]);
  const userId = session?.user.id;

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    void (async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('display_name,bio,is_public').eq('id', userId).single();
        if (error) throw error;
        if (!cancelled) { setName(data.display_name ?? ''); setBio(data.bio ?? ''); setPublic(data.is_public === true); setLoaded(true); }
        const blocked = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId);
        if (blocked.error) throw blocked.error;
        if (!cancelled) setBlocks(blocked.data ?? []);
      } catch { if (!cancelled) setMessage('Chargement incomplet. Revenez sur cette page pour réessayer.'); }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  async function save() {
    if (!userId || !loaded || busy) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.from('profiles').update({ display_name: name.trim(), bio: bio.trim(), is_public: isPublic }).eq('id', userId).select('id').single();
      if (error) throw error;
      setMessage('Profil enregistré.');
    } catch { setMessage('Enregistrement impossible. Vérifiez votre connexion et l’acceptation des règles communautaires.'); }
    finally { setBusy(false); }
  }

  async function unblock(id: string) {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', id);
      if (error) throw error;
      setBlocks(current => current.filter(item => item.blocked_id !== id));
      setMessage('Utilisateur débloqué.');
    } catch { setMessage('Déblocage impossible. Réessayez.'); }
    finally { setBusy(false); }
  }

  return <SettingsPage title="Compte et confidentialité">
    <Field label="Nom d’affichage" value={name} onChangeText={setName} maxLength={80} editable={loaded && !busy} />
    <Field label="Biographie" value={bio} onChangeText={setBio} maxLength={500} multiline editable={loaded && !busy} />
    <Copy>Profil public</Copy>
    <Switch accessibilityLabel="Profil public" value={isPublic} onValueChange={setPublic} disabled={!loaded || busy} />
    <Copy>Ce réglage concerne votre profil. La visibilité de chaque portefeuille reste indépendante.</Copy>
    <Action label={busy ? 'Enregistrement…' : 'Enregistrer'} disabled={!loaded || busy} onPress={() => void save()} />
    {message ? <Copy>{message}</Copy> : null}
    <Copy>Utilisateurs bloqués : {blocks.length}</Copy>
    {blocks.map(block => <Action key={block.blocked_id} label={`Débloquer ${block.blocked_id}`} disabled={busy} onPress={() => void unblock(block.blocked_id)} />)}
    <Action label="Changer mon mot de passe" onPress={() => router.push('/reset-password')} />
    <LegalLinks />
    <Action label="Contacter le support" onPress={() => void openExternal(`mailto:${SUPPORT_EMAIL}`)} />
    <Copy>Vous pouvez aussi écrire directement à {SUPPORT_EMAIL}.</Copy>
    <Action label="Supprimer mon compte" danger onPress={() => router.push('/delete-account')} />
  </SettingsPage>;
}
