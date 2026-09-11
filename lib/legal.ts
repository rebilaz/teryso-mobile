import { Alert, Linking } from 'react-native';

export const LEGAL_VERSION = '2026-09-10';
export const PRIVACY_URL = 'https://www.teryso.com/politique-de-confidentialite';
export const COMMUNITY_RULES_URL = 'https://www.teryso.com/regles-communautaires';
export const CHILD_SAFETY_URL = 'https://www.teryso.com/securite-enfants';
export const ACCOUNT_DELETION_URL = 'https://www.teryso.com/suppression-compte';
export const SUPPORT_EMAIL = 'contact@teryso.com';

export async function openExternal(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      'Lien indisponible',
      `Vous pouvez ouvrir cette adresse dans votre navigateur : ${url}`,
    );
  }
}

export const COMMUNITY_TERMS = [
  [
    'Objet du service',
    'Teryso permet de suivre et partager des portefeuilles et de participer à leur gouvernance. Teryso ne fournit aucun conseil financier, ne passe pas d’ordres et ne détient pas vos fonds. Investir comporte un risque de perte en capital. Les performances passées ne garantissent pas les performances futures.',
  ],
  [
    'Votre compte et vos publications',
    'Protégez vos identifiants et ne publiez que des contenus que vous avez le droit de partager. Vérifiez les informations financières avant toute décision. Ne publiez pas de données personnelles ou financières appartenant à autrui. Les contenus publics peuvent être consultés et copiés par des tiers.',
  ],
  [
    'Règles communautaires',
    'Sont interdits : harcèlement, menaces, haine, discrimination, violence, contenus sexuels explicites, exploitation ou abus sexuels sur mineurs (CSAE), contenus d’abus sexuels sur mineurs (CSAM), y compris synthétiques ou générés par IA, activités illégales, usurpation d’identité, violation de droits d’auteur, divulgation de données privées et spam.',
  ],
  [
    'Intégrité financière',
    'Sont interdits : escroqueries, phishing, manipulation de marché, performances falsifiées, promesses trompeuses de rendement garanti et sollicitations frauduleuses. Présentez honnêtement les risques et vos éventuels conflits d’intérêts.',
  ],
  [
    'Signalement et modération',
    'Utilisez « Signaler » sur un contenu ou un utilisateur et « Bloquer » pour masquer ses contenus. Les signalements relatifs à la sécurité des enfants sont traités en priorité. L’équipe peut retirer un contenu ou suspendre un compte après examen. Pour contester une décision ou signaler un danger urgent, écrivez à contact@teryso.com en indiquant le contenu concerné, sans transmettre de copie d’un contenu illégal.',
  ],
  [
    'Confidentialité et suppression',
    'La politique de confidentialité décrit les traitements de données et vos droits. Vous pouvez demander la suppression de votre compte depuis Compte → Supprimer mon compte, depuis la page publique de suppression Teryso, ou écrire à contact@teryso.com depuis l’adresse associée au compte, avec l’objet « Suppression de compte Teryso ». Une vérification d’identité peut être nécessaire.',
  ],
  [
    'Contact',
    'Teryso est édité par Gabriel Collot, entrepreneur individuel, SIREN 949 183 123, Impasse de la Marinié, 81450 Le Garric, France. Contact : contact@teryso.com.',
  ],
] as const;
