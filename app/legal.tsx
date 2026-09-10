import { Fragment } from 'react';
import { Action, Copy, SettingsPage } from '@/components/teryso/settings-ui';
import { COMMUNITY_TERMS, LEGAL_VERSION, openExternal, PRIVACY_URL } from '@/lib/legal';

export default function LegalScreen() {
  return <SettingsPage title="Conditions et règles communautaires">
    <Copy>Version du {LEGAL_VERSION}</Copy>
    {COMMUNITY_TERMS.map(([title, body]) => <Fragment key={title}><Copy>{title}</Copy><Copy>{body}</Copy></Fragment>)}
    <Action label="Politique de confidentialité" onPress={() => void openExternal(PRIVACY_URL)} />
  </SettingsPage>;
}
