import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Action } from './settings-ui';
import { openExternal, PRIVACY_URL } from '@/lib/legal';

export function LegalLinks() {
  const router = useRouter();
  return <View style={{ gap: 8, marginVertical: 12 }}>
    <Action label="CGU et règles communautaires" onPress={() => router.push('/legal')} />
    <Action label="Politique de confidentialité" onPress={() => void openExternal(PRIVACY_URL)} />
  </View>;
}
