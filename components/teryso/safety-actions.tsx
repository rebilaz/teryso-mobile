import { useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/auth-context';
import { useTerysoTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { Action, Copy, Field } from './settings-ui';

export type ReportKind = 'portfolio' | 'profile' | 'proposal' | 'rule';
const reasons = ['Escroquerie ou contenu financier trompeur', 'Harcèlement ou haine', 'Contenu illégal ou sexuel', 'Données privées', 'Spam ou usurpation', 'Autre'];

export function SafetyActions({ kind, targetId, userId, onBlocked }: { kind: ReportKind; targetId: string; userId?: string | null; onBlocked?: () => void }) {
  const { session } = useAuth();
  const { colors } = useTerysoTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState('');
  const [message, setMessage] = useState('');
  if (!session || userId === session.user.id) return null;

  async function report(reportKind: ReportKind, id: string) {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.rpc('submit_content_report', { p_kind: reportKind, p_target_id: id, p_reason: reason, p_details: details.trim() });
      if (error) throw error;
      setMessage('Signalement transmis à l’équipe de modération.'); setDetails('');
    } catch { setMessage('Envoi impossible. Votre signalement n’a pas été confirmé. Réessayez.'); }
    finally { setBusy(false); }
  }

  async function block() {
    if (!userId || busy) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.rpc('block_user', { p_user_id: userId });
      if (error) throw error;
      setOpen(false); onBlocked?.();
    } catch { setMessage('Blocage impossible. Réessayez.'); }
    finally { setBusy(false); }
  }

  return <View style={{ marginVertical: 8 }}>
    <Action label="Signaler / Bloquer" onPress={() => { setMessage(''); setOpen(true); }} />
    <Modal visible={open} animationType="slide" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}><ScrollView contentContainerStyle={{ padding: 24, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Copy>Signaler ce contenu</Copy>
        {reasons.map(item => <Action key={item} label={`${reason === item ? '✓ ' : ''}${item}`} disabled={busy} onPress={() => setReason(item)} />)}
        <Field label="Précisions facultatives" value={details} onChangeText={setDetails} multiline maxLength={2000} editable={!busy} />
        <Action label="Envoyer le signalement du contenu" disabled={busy} onPress={() => void report(kind, targetId)} />
        {userId ? <><Action label="Signaler cet utilisateur" disabled={busy} onPress={() => void report('profile', userId)} />
          <Copy>Bloquer masque les contenus de cet utilisateur dans votre compte. Vous pourrez le débloquer dans Compte et confidentialité.</Copy>
          <Action label="Confirmer le blocage de cet utilisateur" danger disabled={busy} onPress={() => void block()} /></> : null}
        {message ? <Copy>{message}</Copy> : null}
        <Action label="Fermer" disabled={busy} onPress={() => setOpen(false)} />
      </ScrollView></SafeAreaView>
    </Modal>
  </View>;
}
