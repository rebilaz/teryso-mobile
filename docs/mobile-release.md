# Mise en service des corrections mobile

Cette branche prépare les corrections de l’audit. Elle ne constitue pas une validation Google Play et ne déploie pas le backend ni la fiche Play Console.

## Inclus

- Profil réellement modifiable, visibilité du profil enregistrée, liens CGU/confidentialité accessibles avant et après connexion, retrait des réglages factices Notifications/Langue.
- Acceptation versionnée des règles communautaires, enregistrée côté serveur avant l’accès aux fonctions de participation. Les comptes Google passent aussi par ce parcours.
- Signalement de portefeuille, profil, proposition et règle ; blocage persistant et déblocage ; filtrage serveur des contenus ; file de modération et décisions réservées au serveur.
- Suppression confirmée par saisie de SUPPRIMER, authentification serveur, nettoyage Storage via son API, suppression Auth et nettoyage relationnel dans la même transaction.
- OAuth PKCE sans tokens transmis dans les URL, échange dédupliqué entre Expo Router et WebBrowser, récupération et changement de mot de passe.
- Correction des positions publiques : la quantité masquée par le serveur n’est plus obligatoire dans le mobile.
- Réparation du lockfile, documentation SDK 57.

## Ordre de déploiement

1. Relire et valider les textes `lib/legal.ts` avec les conditions du service. Publier la même version sur le site. Les nouveaux triggers exigent une acceptation pour les publications **sur tous les clients**, y compris le site : le site doit appeler `accept_community_terms('2026-09-10')` après consentement avant d’activer ces triggers en production. Ne pas appliquer le SQL isolément sur le site actuel.
2. Générer une migration avec `supabase migration new mobile_safety`, puis y copier `supabase/mobile-safety.sql`. Le binaire CLI de cet environnement a échoué avec SIGTRAP ; aucun faux historique de migration n’a été créé.
3. Tester sur un environnement de préproduction. Le SQL a été testé dans une transaction entièrement annulée sur le schéma existant. Pour répéter les tests, concaténer le SQL sans son COMMIT final et `supabase/tests/mobile-safety.sql`. Les comptes de test utilisent `example.invalid`; aucune notification n’est envoyée.
4. Appliquer la migration, exécuter les conseillers de sécurité Supabase et déployer `supabase/functions/delete-account`. La fonction vérifie le bearer token via `auth.getUser()` même si `verify_jwt=false` au niveau de la passerelle. Ne jamais mettre la clé service dans Expo.
5. Autoriser les URL de retour `teryso://auth/callback` et `teryso://auth/callback?next=reset-password`, et les équivalents HTTPS exacts pour le web. Vérifier confirmation email, connexion Google, annulation, démarrage à froid, lien expiré et récupération sur Android réel. Le PKCE exige l’appareil/navigateur où le parcours a commencé. Un App Link HTTPS vérifié nécessite le domaine et les empreintes de signature Android ; il n’est pas inventé dans cette branche.
6. Déployer la route publique `/delete-account` depuis cette app web, ou porter son contenu sur `https://www.teryso.com/suppression-compte`. Elle doit être accessible sans compte et mentionner Teryso, la demande par email et les données concernées. **Aucune nouvelle URL publique n’a été déployée ici.** Renseigner uniquement l’URL réellement publiée dans Play Console.
7. Déployer le mobile après le backend. Avant ce déploiement, la nouvelle app bloque volontairement la participation si la table d’acceptation n’est pas disponible.

## Modération

La table `content_reports` est consultable par l’équipe autorisée dans Supabase Table Editor, pas par les clients. Traiter les lignes `pending`, vérifier le contenu ciblé, puis appeler depuis une session serveur autorisée :

```sql
select public.review_content_report(
  '<report-uuid>', 'removed', 'Motif précis de la décision', 'Identité du modérateur'
);
```

Actions : `dismissed`, `removed`, `suspended`. Elles enregistrent la décision, la date et le modérateur. Un rejet de signalement ne rétablit pas automatiquement un contenu précédemment retiré. Pour un recours accepté, une personne autorisée retire explicitement la ligne correspondante dans `private.hidden_content` ou `private.community_suspensions`, en conservant la justification dans le signalement.

Désigner une personne responsable et une fréquence de consultation avant publication. Le code ne peut pas assurer à lui seul une modération continue. Les anciens RPC publics du site qui utilisent SECURITY DEFINER doivent être adaptés pour appeler le même contrôle de visibilité avant toute mise en service commune ; les nouveaux RPC mobiles le font déjà. Les caches du site doivent aussi être invalidés lors d’un retrait.

## Suppression et conservation

Le schéma existant ne relie pas `portfolios.user_id` à `auth.users` par une clé étrangère. Le trigger de suppression nettoie explicitement ces portefeuilles ainsi que les règles créées par l’utilisateur et les invitations par email ; les autres dépendances sont supprimées par les cascades existantes. Les signalements de l’utilisateur ou visant l’utilisateur sont supprimés dans ce parcours. La fonction Storage inclut les fichiers possédés par l’utilisateur et ses fichiers d’import enregistrés.

Le portefeuille communautaire `teryso` possède une protection serveur existante. Son propriétaire doit organiser un transfert par le support avant de supprimer son compte. La fonction refuse ce cas avant tout nettoyage. Elle ne contourne pas cette protection. Pour une suppression interrompue après révocation des sessions, reconnecter le compte avant de réessayer. Confirmer la durée réelle de conservation des sauvegardes et toute exception légale avant de compléter la politique publique.

## Play Console et accès reviewer

Ces opérations nécessitent Play Console et les paramètres de production, absents de cette session :

- Créer un compte de test email/mot de passe permanent, email déjà confirmé, sans MFA ni OTP requis pour se connecter. Ne pas ajouter de contournement d’authentification dans l’app. Ne jamais enregistrer ses identifiants dans Git.
- Préremplir un portefeuille, des transactions, une règle et une proposition en utilisant les parcours réels de l’app. Utiliser un compte exclusivement destiné aux tests ; la suppression doit rester testable. Prévoir de remplacer le compte après un test destructif.
- App access, exemple d’instructions en anglais : “Open Teryso, select email sign-in and enter the credentials supplied in this form. Accept the community terms on first use. Open Portfolio to inspect the sample holdings, transactions, rules and assembly proposal. Open Account for profile, privacy, account deletion and legal information. Open Discover, select a public portfolio, then Report / Block to test safety controls.”
- Data Safety : inventorier les champs et SDK réellement utilisés, notamment email, identifiant, profil, portefeuille/transactions, publications, signalements et blocages. Vérifier collecte, partage, finalités, chiffrement et suppression pour chaque catégorie ; ne pas déduire ces réponses uniquement de cette liste.
- Compléter Financial features, Content rating, Target audience et Ads selon le produit réel. Choisir l’âge cible selon l’audience voulue, sans le modifier arbitrairement pour contourner une politique.
- Renseigner la politique de confidentialité existante et la nouvelle URL de suppression après publication. Mettre des captures de la version mobile réelle.
- Construire `eas build --platform android --profile production`, tester l’AAB signé, permissions, API cible, appareils à pages mémoire 16 KB, crashes/ANR et Pre-launch Report.

## Vérifications effectuées

- TypeScript : réussi.
- Export Android Expo/Metro : réussi (1 797 modules, bundle Hermes généré avec des variables de configuration factices ; cela ne remplace pas un AAB signé).
- SQL : consentement requis, signalement, blocage, retrait, refus des privilèges de modération/Storage au client, suppression des portefeuilles/profils synthétiques : réussis, puis ROLLBACK.
- Lint comparé à la même révision initiale : 35 erreurs et 1 avertissement contre 37 erreurs et 1 avertissement avant changement. Les erreurs restantes sont préexistantes ; aucun nouveau diagnostic sur les fichiers ajoutés.
- Pas de test Android sur appareil, de déploiement de fonction, de test Storage destructif ou d’AAB signé dans cette session.

Références : [suppression de compte Google Play](https://support.google.com/googleplay/android-developer/answer/13327111), [contenu utilisateur](https://support.google.com/googleplay/android-developer/answer/9876937), [PKCE Supabase](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
