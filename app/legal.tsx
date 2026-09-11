import { Fragment } from 'react';
import { Action, Copy, SettingsPage } from '@/components/teryso/settings-ui';
import {
  ACCOUNT_DELETION_URL,
  CHILD_SAFETY_URL,
  COMMUNITY_RULES_URL,
  COMMUNITY_TERMS,
  LEGAL_VERSION,
  PRIVACY_URL,
  openExternal,
} from '@/lib/legal';

export default function LegalScreen() {
  return (
    <SettingsPage title="Conditions et règles communautaires">
      <Copy>Version du {LEGAL_VERSION}</Copy>
      {COMMUNITY_TERMS.map(([title, body]) => (
        <Fragment key={title}>
          <Copy>{title}</Copy>
          <Copy>{body}</Copy>
        </Fragment>
      ))}
      <Action
        label="Règles communautaires en ligne"
        onPress={() => void openExternal(COMMUNITY_RULES_URL)}
      />
      <Action
        label="Politique de confidentialité"
        onPress={() => void openExternal(PRIVACY_URL)}
      />
      <Action
        label="Normes de sécurité des enfants"
        onPress={() => void openExternal(CHILD_SAFETY_URL)}
      />
      <Action
        label="Suppression du compte en ligne"
        onPress={() => void openExternal(ACCOUNT_DELETION_URL)}
      />
    </SettingsPage>
  );
}
