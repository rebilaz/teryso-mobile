import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Action } from './settings-ui';
import {
  ACCOUNT_DELETION_URL,
  CHILD_SAFETY_URL,
  COMMUNITY_RULES_URL,
  PRIVACY_URL,
  openExternal,
} from '@/lib/legal';

export function LegalLinks() {
  const router = useRouter();

  return (
    <View style={{ gap: 8, marginVertical: 12 }}>
      <Action
        label="CGU et règles communautaires"
        onPress={() => router.push('/legal')}
      />
      <Action
        label="Règles communautaires en ligne"
        onPress={() => void openExternal(COMMUNITY_RULES_URL)}
      />
      <Action
        label="Politique de confidentialité"
        onPress={() => void openExternal(PRIVACY_URL)}
      />
      <Action
        label="Sécurité des enfants"
        onPress={() => void openExternal(CHILD_SAFETY_URL)}
      />
      <Action
        label="Suppression du compte en ligne"
        onPress={() => void openExternal(ACCOUNT_DELETION_URL)}
      />
    </View>
  );
}
