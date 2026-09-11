import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Action, Copy, Field, SettingsPage } from '@/components/teryso/settings-ui';
import {
  ACCOUNT_DELETION_URL,
  openExternal,
  SUPPORT_EMAIL,
} from '@/lib/legal';

export default function DeleteAccount() {
  const { session } = useAuth();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function remove() {
    if (busy || confirmation !== 'SUPPRIMER' || !session) return;
    setBusy(true);
    setMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { confirmation: 'SUPPRIMER' },
      });
      if (error || data?.deleted !== true) {
        throw new Error('Suppression non confirmée');
      }
      await supabase.auth.signOut({ scope: 'local' });
      router.replace('/login');
    } catch {
      setMessage(
        'La suppression n’a pas pu être confirmée. Réessayez ou contactez le support. Aucun succès n’est enregistré sans confirmation du serveur.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPage title="Supprimer mon compte">
      <Copy>
        Cette opération est irréversible. Elle supprime votre compte Teryso,
        votre profil, vos portefeuilles et les données associées, vos
        publications et les fichiers liés au compte. Les autres membres
        perdront l’accès aux portefeuilles dont vous êtes propriétaire.
      </Copy>
      <Copy>
        Si vous êtes propriétaire du portefeuille communautaire Teryso,
        contactez le support pour organiser son transfert avant de supprimer
        votre compte.
      </Copy>
      <Copy>
        Les sauvegardes techniques expirent selon la politique de conservation
        du service. Pour toute question sur les données conservées pour une
        obligation légale, contactez {SUPPORT_EMAIL}.
      </Copy>
      {session ? (
        <>
          <Field
            label="Saisissez SUPPRIMER pour confirmer"
            autoCapitalize="characters"
            value={confirmation}
            onChangeText={setConfirmation}
            editable={!busy}
          />
          <Action
            label={
              busy
                ? 'Suppression en cours…'
                : 'Supprimer définitivement mon compte'
            }
            danger
            disabled={busy || confirmation !== 'SUPPRIMER'}
            onPress={() => void remove()}
          />
        </>
      ) : null}
      {message ? <Copy>{message}</Copy> : null}
      <Copy>
        Sans accès à l’application, utilisez la page publique de suppression ou
        envoyez votre demande depuis l’adresse email du compte à {SUPPORT_EMAIL},
        objet « Suppression de compte Teryso ». Nous pourrons vous demander de
        confirmer que le compte vous appartient.
      </Copy>
      <Action
        label="Ouvrir la page publique de suppression"
        onPress={() => void openExternal(ACCOUNT_DELETION_URL)}
      />
      <Action
        label="Demander la suppression par email"
        onPress={() =>
          void openExternal(
            `mailto:${SUPPORT_EMAIL}?subject=Suppression%20de%20compte%20Teryso`,
          )
        }
      />
    </SettingsPage>
  );
}
