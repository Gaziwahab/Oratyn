# Environment Setup

## 1. Prerequisites

- A supported Node.js LTS release compatible with the selected Next.js and Firebase App Hosting runtime.
- pnpm or npm (choose exactly one and commit its lockfile).
- Git.
- Firebase project(s): separate development, staging and production projects.
- Firebase CLI and the Firebase Local Emulator Suite.
- Google Cloud project/billing setup for services that require it.
- Gemini API key only when server-side AI evaluation is enabled.
- Google Secret Manager for deployed backend secrets.

Check current official framework and Firebase compatibility before pinning versions. Do not assume the newest framework major is already supported by App Hosting.

## 2. Create the application

1. Create a Next.js App Router + TypeScript web app (or preserve the AI Studio starter if it already provides a working React/Firebase scaffold).
2. Enable strict TypeScript, linting, formatting and tests.
3. Create the Firebase development project.
4. Enable Firebase Authentication providers required by the MVP.
5. Create Cloud Firestore in a reviewed region and choose production/locked security mode.
6. Add deny-by-default Firestore Security Rules and Storage Rules before adding application data.
7. Configure Firebase App Check in monitoring mode, validate legitimate traffic, then enforce it for supported services/endpoints.
8. Add Cloud Functions (2nd gen) with TypeScript for trusted operations.
9. Configure Emulator Suite for Auth, Firestore, Functions and Storage where used.
10. Add the server-side AI provider adapter only after core session data and access policies exist.

Do not place real user data in local emulators or test fixtures.

## 3. Environment variables

Create `.env.local` from `.env.example`. Never commit populated `.env.local` or `.env.production` files.

Illustrative variables (use only those the actual implementation requires):

```bash
# Public Firebase Web SDK configuration (not Admin credentials)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=

# Server-only values — never prefix with NEXT_PUBLIC_
GEMINI_API_KEY=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
PAYMENT_PROVIDER_SECRET=
PAYMENT_WEBHOOK_SECRET=

# App configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_ENV=development
```

Important:

- Firebase web configuration is designed to be included in client apps; it is not a service-account credential. Protect data with Rules, App Check and backend authorization.
- Do not put service-account private key JSON in these client variables. Use Application Default Credentials locally where appropriate and Secret Manager/IAM in deployed functions.
- `GEMINI_API_KEY`, LiveKit secrets and payment/webhook secrets are server-only. Do not expose them through public variables or browser bundles.
- Prefer Secret Manager for production and bind each secret only to the function that uses it.
- Do not log environment-variable values. Validate required variables on backend startup.

## 4. Firebase setup

1. Create separate Firebase projects for development, staging and production.
2. Configure Authentication providers, authorized domains and exact redirect URLs.
3. Create Firestore with reviewed region and production-mode security.
4. Add `firebase/firestore.rules` with default deny and explicit document access rules.
5. Add `firebase/firestore.indexes.json` for reviewed queries.
6. Add `firebase/storage.rules` as deny-by-default, even if uploads are not enabled yet.
7. Configure App Check providers for web and Android as the corresponding app clients are introduced.
8. Add Functions and runtime service accounts with least-privilege IAM.
9. Configure secrets with Google Secret Manager; do not paste them into source files.
10. Add emulator tests for rules and backend authorization.
11. Use synthetic seed data only; seed scripts must be repeatable and safe.

## 5. Local development commands

Provide scripts or equivalents:

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:rules
pnpm test:e2e
pnpm build
pnpm emulators
```

If using npm, adapt commands consistently and commit `package-lock.json`. Do not commit multiple lockfiles.

## 6. AI provider setup

- Create a provider key in the official provider console.
- Store the key only in the server environment/Secret Manager.
- Use a provider adapter with strict structured output validation.
- Apply timeout, token/context ceiling, retry limit, concurrency limit and per-user quota.
- Test malformed/refused/unsafe output and provider failure using a mock adapter.
- Use synthetic transcripts until provider data-handling and privacy terms are reviewed.

## 7. Emulator and test data

- Run Auth, Firestore and Functions emulators for local integration.
- Run Security Rules tests with both positive and negative cases.
- Test backend Admin SDK authorization separately because Admin SDK bypasses Security Rules.
- Seed a small catalogue of domains, topics, competencies, scenarios and rubrics.
- Do not use real users, emails, private transcripts or production exports in fixtures.

## 8. Troubleshooting

- **Auth token rejected:** confirm project ID/audience, token freshness, emulator vs production project, and server verification setup.
- **Firestore permission denied:** inspect Rules and query constraints; do not disable Rules to make the UI work.
- **Backend allows a forbidden write:** check server authorization; Admin SDK bypasses Security Rules.
- **App Check rejected:** verify the registered app/provider and token configuration; never turn enforcement off permanently as a workaround.
- **Function secret missing:** confirm Secret Manager binding is declared for the specific deployed function.
- **Realtime event missing:** re-fetch canonical Firestore state; do not assume the data was lost.
- **AI key error:** verify server secret binding, provider project, quota and model availability. Never move the key to the browser.
- **Build/runtime mismatch:** confirm App Hosting's supported Next.js/Node versions before upgrading.
