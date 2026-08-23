# Teryso Mobile

Application mobile Teryso en React Native, conçue pour fonctionner directement dans Expo Go.

## Fonctionnalités

- découverte et recherche des portefeuilles publics Teryso ;
- fiche portefeuille avec métriques autorisées par Supabase ;
- authentification email/mot de passe ;
- profil et déconnexion ;
- thèmes clair blanc pur et sombre ;
- modèle simplifié : un portefeuille correspond à un seul compte ;
- navigation native avec Expo Router.

## Lancer dans Expo Go

Prérequis : Node.js 20.19 ou supérieur et l’application Expo Go sur iOS ou Android.

```bash
npm install
npm start
```

Scannez ensuite le QR code avec Expo Go. Le projet cible Expo SDK 54, compatible avec la version Expo Go distribuée sur les stores.

## Configuration Supabase

L’application utilise une clé Supabase `publishable`, conçue pour être intégrée dans un client public. Les autorisations réelles restent imposées côté base par les politiques RLS.

Pour utiliser un autre projet Supabase, remplacez les valeurs dans `.env` :

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

N’ajoutez jamais de clé `service_role` ou `secret` dans une application Expo.

## Vérifications

```bash
npm run typecheck
npm run lint
npm run doctor
```
