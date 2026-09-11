# Google Play release checklist — Teryso Mobile

Last reviewed: 2026-09-11.

## Public URLs already deployed

- Privacy policy: https://www.teryso.com/politique-de-confidentialite
- Account deletion: https://www.teryso.com/suppression-compte
- Community rules: https://www.teryso.com/regles-communautaires
- Child safety standards: https://www.teryso.com/securite-enfants

Verify every URL without authentication immediately before submitting a release.

## Play Console declarations

### App access

Teryso requires authentication for the main product. Supply a permanent email/password reviewer account with confirmed email and no MFA/OTP requirement.

Suggested English instructions:

> Open Teryso and choose email sign-in. Enter the reviewer credentials supplied in this form. Accept the community terms on first use. Open Portfolio to inspect sample holdings, transactions, rules and assembly proposals. Open Account for profile, privacy, legal information and account deletion. Open Discover, select a public portfolio, then use Report / Block to test the safety controls.

Keep a second disposable reviewer account available for destructive account-deletion testing.

### Financial features

Teryso tracks investment portfolios, positions, transactions and performance. It does not execute brokerage orders, provide custody or hold user funds. Complete the Financial features declaration consistently with those product capabilities; do not declare that the app has no financial features merely because it does not execute trades.

### Data Safety

Inventory the production build and backend before answering the form. Review at least:

- email address and account/user identifiers;
- profile name, username, biography and avatar when provided;
- portfolios, holdings, positions, transactions and performance data;
- user-generated rules, proposals, comments or other publications exposed by the product;
- follows and other social interactions;
- community-term acceptance records;
- blocks and abuse reports, including optional report details;
- diagnostic/security data collected by production SDKs or backend services.

For every category, confirm whether it is collected, shared, optional, encrypted in transit, deletable, and the actual purpose. The public privacy policy and Data Safety form must stay consistent.

### Content and audience

Teryso includes public user-generated content and social interaction. Complete Content Rating and Target Audience according to the audience actually intended for the service. Do not reduce or alter the declared audience merely to avoid a policy requirement.

If the Play Console classifies the app within the social-app child-safety scope, use the deployed child-safety standards URL above and keep the in-app `child_safety` reporting path operational.

### Ads

Declare ads only according to the production build and service actually shipped. The current mobile source does not integrate an advertising SDK, but this must be rechecked at release time.

## Backend release gate

Do not release this mobile build before the shared Supabase community-safety migration and the `delete-account` Edge Function are deployed to the same production project used by the app.

Required production smoke tests:

1. New account accepts the current community terms.
2. A public portfolio owned by an account with a private profile can be reported, including the author report.
3. A comment can be reported from the web client and is handled by the same moderation queue.
4. Blocking another user removes their visible content and prevents re-following until unblocked.
5. A moderator can remove reported content and suspend a user without granting moderation privileges to clients.
6. A disposable user with portfolio data and Storage files can delete the account; verify Auth, relational rows and Storage afterwards.
7. Google OAuth, email/password sign-in and password recovery work on a physical Android device with production redirect URLs.

## Android release gate

Build with:

```bash
eas build --platform android --profile production
```

Before Play submission, test the signed production artifact through an internal track and review:

- target/compile SDK reported by the final artifact;
- final Android permissions;
- launch, navigation and predictive-back behavior;
- crashes and ANRs;
- authentication redirects after cold start;
- 16 KB page-size compatibility where applicable;
- Google Play Pre-launch Report.

The repository CI is a source-level gate only; it does not replace a signed AAB or Play pre-launch testing.
