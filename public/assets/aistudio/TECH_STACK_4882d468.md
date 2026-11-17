# Technology Stack and Platform Strategy

**Status:** Recommended baseline for implementation. Re-check framework and Firebase compatibility before pinning exact package versions. Do not upgrade to preview releases merely because they are newest.

## 1. Decision summary

The product should use a TypeScript-first architecture that supports a responsive web app now and a native Android app later without duplicating business rules.

| Layer | Recommended choice | Why |
|---|---|---|
| Web application | Next.js App Router + React + TypeScript | Production web UX, server rendering, routes and mature ecosystem. |
| Web hosting | Firebase App Hosting | Managed hosting path for Next.js with Google Cloud infrastructure. Confirm supported framework/runtime versions before upgrades. |
| Android application (later) | Expo + React Native + TypeScript, using development builds and native Firebase integration where required | Native Android delivery while reusing TypeScript domain models, validation schemas and API contracts. Do not promise one UI codebase for web and mobile. |
| Authentication | Firebase Authentication | Common identity provider for web and future Android. |
| Primary database | Cloud Firestore | Managed document database aligned with the Firebase-first project and AI Studio workflow. |
| Authorization | Firestore Security Rules + server-side authorization + Google Cloud IAM | Firestore Security Rules are the Firebase equivalent of a database access-control layer; they are not SQL row-level security. |
| Backend operations | Cloud Functions for Firebase, 2nd gen, TypeScript | Trusted operations, validation, transactions, AI orchestration, scheduled and background work. |
| Longer-running services | Cloud Run only when measured need exists | Worker processes, custom APIs or later media/token services. Do not add it pre-emptively. |
| File storage | Cloud Storage for Firebase | Private user uploads with Storage Security Rules. Uploads are out of MVP unless a feature requires them. |
| Realtime | Firestore listeners for permitted state/message reads; server writes first | Simple initial collaboration. Reconcile from Firestore after reconnect. |
| AI | Gemini initially, behind a provider-neutral server adapter | Fits the likely Google/Firebase workflow while preserving provider portability. |
| Queued work | Cloud Tasks / task queue or event-driven Functions when durable retries are needed | Bounded, retryable evaluation and notification work. Select the smallest service that meets reliability needs. |
| Validation | Zod or an equivalent runtime schema library | Validate every external request and model response. |
| UI | Tailwind CSS + accessible component primitives | Consistent responsive design and maintainable components. |
| Testing | Vitest/Jest, Firebase Emulator Suite, Playwright | Unit, security-rule, integration and end-to-end tests. |
| Package management | pnpm workspaces when the repository is split into apps/functions/shared packages | Lockfile consistency and reusable TypeScript packages. npm is acceptable if the AI Studio starter requires it; do not mix package managers. |

## 2. Web and Android strategy

### Web first

Build the MVP as a responsive Next.js web app. Host it on Firebase App Hosting if its currently supported Next.js and Node.js versions match the selected app. The web application should use Firebase Authentication, Firestore and Storage client SDKs only for operations explicitly allowed by Security Rules. Sensitive mutations must go through trusted server functions.

### Android later

Use Expo + React Native + TypeScript for the Android application. The mobile app will share selected packages with the web app:

- `packages/domain`: domain types, enums and pure business rules.
- `packages/validation`: shared Zod schemas for client feedback and server validation. Server validation remains authoritative.
- `packages/contracts`: API request/response types and error codes.
- `packages/design-tokens`: colors, spacing and typography tokens where useful.

Do not share browser components with React Native. Build platform-appropriate interfaces while sharing domain logic and contracts. For a simple first Android client, the Firebase JS SDK can cover core Auth/Firestore/Storage workflows; however, the recommended production path is to evaluate React Native Firebase native modules when native capabilities such as Crashlytics, Analytics, FCM or native App Check integration are required. React Native Firebase requires custom native code and an Expo development build; it does not run in Expo Go. Verify the current Expo/Firebase integration guide when starting the Android milestone.

Do not build the Android app during the MVP just to claim cross-platform support. Keep the core contracts portable now and build the app after the web product loop is validated.

## 3. Firebase service responsibilities

- **Firebase Authentication:** sign-up, sign-in, account recovery and identity tokens. Do not store passwords yourself.
- **Cloud Firestore:** profiles, catalogue, sessions, participant membership, messages, session events, evaluations, competency observations, reports and operational state.
- **Firestore Security Rules:** deny-by-default access rules for every collection and subcollection. Rules are not filters; queries must be shaped so every possible returned document is authorized.
- **Cloud Functions (2nd gen):** trusted business operations, membership checks, state transitions, message creation, report generation, role administration, webhook endpoints and token minting.
- **Cloud Storage:** private file uploads only when needed, with restrictive Storage Rules and a quarantine/validation pipeline.
- **App Check:** an additional app/device attestation layer for supported Firebase services and custom endpoints. It complements—not replaces—Authentication, authorization or abuse controls.
- **Cloud Logging/Monitoring:** operational logs, metrics, alerts and restricted audit exports. Never log credentials or full private transcripts by default.

Important Firebase distinction: Admin SDK/server client libraries bypass Firestore Security Rules. Every server operation using Admin SDK must perform its own authentication and authorization checks, and its runtime service account must have least-privilege IAM permissions.

## 4. Repository shape

Start with a light workspace layout that can accept an Android app later:

```text
project/
├── AGENTS.md
├── README.md
├── AI_STUDIO_START_PROMPT.md
├── docs/
├── apps/
│   └── web/                  # Next.js web application
├── functions/                # Cloud Functions, TypeScript
├── packages/
│   ├── domain/               # Pure domain types and rules
│   ├── validation/           # Shared schemas
│   └── contracts/            # API contracts and error codes
├── firebase/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   ├── storage.rules
│   └── tests/                # Emulator-based Security Rules tests
├── tests/
├── .env.example
├── firebase.json
└── pnpm-workspace.yaml       # If pnpm workspaces are used
```

When generated in AI Studio as a single web app, do not restructure a working starter blindly. Keep feature boundaries and introduce the workspace only when it adds value. Android can later be added as `apps/mobile/`.

## 5. Code organization

Use feature-oriented modules with explicit boundaries. Example:

```text
apps/web/src/features/sessions/
  components/
  schemas/
  hooks/
  services/             # Client-safe service wrappers only
  types.ts
functions/src/features/sessions/
  handlers/
  services/
  repositories/
  schemas/
  tests/
```

- UI components render state and emit intent; they do not decide authorization.
- Backend handlers authenticate, validate, authorize, call domain services and return a minimal response.
- Domain services contain testable business rules and should not depend on React, Firebase SDK globals or a specific AI vendor.
- Repository modules contain Firestore reads/writes and transactions.
- Keep functions small, named by intent and easy to test.
- Prefer composition and simple interfaces over deep inheritance or a generic framework of frameworks.

## 6. What not to introduce yet

Do not start with microservices, Kubernetes, GraphQL, a separate Redis cluster, custom WebSocket servers, a self-hosted SFU, an elaborate event bus, or multiple AI agents. Revisit only when measured product or operational requirements justify them.

## 7. Future realtime media

Voice/video is post-MVP. When validated, evaluate a managed WebRTC SFU such as LiveKit Cloud rather than creating media infrastructure from scratch. Mint room tokens only on the trusted backend with short expiry and least-privilege grants. See `SECURITY_PROTOCOL.md` before implementing any media feature.

## 8. Version and dependency policy

- Use supported stable releases compatible with Firebase App Hosting, Cloud Functions and Expo.
- Record Node.js, framework and package-manager versions in the repository.
- Commit exactly one lockfile.
- Use automated dependency alerts and vulnerability scanning in CI.
- Review breaking changes and migration notes before upgrades.
- Never choose an abandoned dependency for a critical security boundary.

## 9. Official references

Confirm details against official documentation during implementation because supported versions and service capabilities change:

- Firebase App Hosting: https://firebase.google.com/docs/app-hosting
- Firebase App Hosting framework support: https://firebase.google.com/docs/app-hosting/frameworks-tooling
- Firebase Authentication: https://firebase.google.com/docs/auth
- Verify Firebase ID tokens: https://firebase.google.com/docs/auth/admin/verify-id-tokens
- Firestore Security Rules: https://firebase.google.com/docs/firestore/security/get-started
- Secure Firestore queries: https://firebase.google.com/docs/firestore/security/rules-query
- Firestore best practices: https://firebase.google.com/docs/firestore/best-practices
- Firebase App Check: https://firebase.google.com/docs/app-check
- Cloud Functions configuration and secrets: https://firebase.google.com/docs/functions/config-env
- Expo + Firebase: https://docs.expo.dev/guides/using-firebase/
- LiveKit token and grants guide (future media): https://docs.livekit.io/home/server/generating-tokens
