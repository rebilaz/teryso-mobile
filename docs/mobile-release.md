# Mise en service des corrections mobile

État révisé le 11 septembre 2026. Le code mobile, les pages publiques web et les contrôles communautaires sont maintenant alignés sur la même version de règles `2026-09-10`. Ce document ne remplace ni les tests d’un AAB signé ni les déclarations Play Console.

## Inclus dans le mobile

- profil réellement modifiable et visibilité enregistrée ;
- CGU/règles accessibles avant et après connexion ;
- acceptation versionnée avant participation ;
- signalement et blocage, avec motif dédié `child_safety` ;
- suppression de compte in-app et accès direct à la page publique de suppression ;
- OAuth PKCE, récupération et changement de mot de passe ;
- liens publics vers confidentialité, règles communautaires et normes de sécurité des enfants ;
- CI source : installation, TypeScript, lint, Expo Doctor et export Android.

## Pages publiques déployées

Les URL suivantes sont actuellement prévues comme références Play Console et sont également exposées depuis le mobile :

- `https://www.teryso.com/politique-de-confidentialite`
- `https://www.teryso.com/suppression-compte`
- `https://www.teryso.com/regles-communautaires`
- `https://www.teryso.com/securite-enfants`

Toujours les revérifier sans authentification immédiatement avant une soumission Play.

## Backend partagé web/mobile

Le backend de sécurité est décrit par `supabase/mobile-safety.sql` et le complément web `supabase/web-safety.sql` du dépôt principal Teryso. Ensemble ils couvrent : consentement, blocages, signalements de profils et contenus, auteurs au profil privé, commentaires/thèses, file de modération, retrait/suspension et filtrage des contenus bloqués.

La migration doit être appliquée avant le binaire mobile. Déployer également `supabase/functions/delete-account` sur le même projet de production. Après application, exécuter les conseillers de sécurité Supabase et vérifier que le schéma `private` n’est pas exposé via PostgREST.

## Tests de production obligatoires

1. accepter les règles avec un nouveau compte ;
2. signaler un portefeuille public dont l’auteur a un profil privé ;
3. signaler l’auteur correspondant ;
4. bloquer/débloquer et vérifier le filtrage ;
5. vérifier le traitement d’un signalement depuis une session serveur autorisée ;
6. supprimer un compte jetable avec portefeuille, transactions et fichiers Storage, puis vérifier Auth/DB/Storage ;
7. tester email/mot de passe, Google OAuth et récupération de mot de passe sur Android physique.

Le portefeuille communautaire protégé `teryso` doit être transféré par le support avant suppression de son propriétaire.

## Modération

La file `content_reports` ne doit pas être exposée aux clients. Traiter les signalements `pending` avec `public.review_content_report(report_id, action, decision, moderator)` depuis un environnement serveur autorisé. Actions : `dismissed`, `removed`, `suspended`.

Les signalements `child_safety` sont prioritaires. Ne pas télécharger ni recopier de contenu illégal dans les outils de modération. Désigner avant publication une personne responsable, une fréquence de consultation et une procédure d’escalade pour fraude financière, harcèlement et sécurité des enfants.

## Play Console

Voir `docs/google-play-release.md` pour les URL et réponses à préparer.

- fournir un compte reviewer email/mot de passe permanent, confirmé, sans MFA/OTP ;
- conserver un second compte jetable pour le test de suppression ;
- déclarer les fonctionnalités financières selon le produit réel (suivi/gestion de portefeuille, sans exécution d’ordres ni conservation des fonds) ;
- remplir Data Safety à partir du build et du backend réels ;
- compléter App access, Content rating, Target audience et Ads ;
- utiliser les URL publiques réellement déployées ci-dessus.

## Build final

Construire :

```bash
eas build --platform android --profile production
```

Tester le binaire signé via un track interne, puis vérifier permissions, API cible, compatibilité 16 KB lorsque pertinente, OAuth/redirects, crashes/ANR et le Play Pre-launch Report.

La CI du dépôt ne remplace pas ce test de l’AAB signé.
