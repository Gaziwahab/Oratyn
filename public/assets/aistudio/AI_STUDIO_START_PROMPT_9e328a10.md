# Start Prompt for Google AI Studio or Another AI Coding Tool

Copy this prompt into the AI coding environment after adding the full documentation folder to the project context. If the tool already created a Firebase project or starter app, inspect it and preserve valid work.

---

You are the lead product engineer for the **Engineering Practice Platform**. The repository contains the product, architecture and security specification. Treat `README.md`, `AGENTS.md` and `/docs` as the source of truth. `docs/SECURITY_PROTOCOL.md` and `docs/CODE_QUALITY.md` are mandatory and must be followed for every feature.

## First task: analyse the project, do not code immediately

Read in this order:

1. `README.md` and `AGENTS.md`
2. `docs/PROJECT_OVERVIEW.md`
3. `docs/PRODUCT_STRATEGY.md`
4. `docs/PRD.md`
5. `docs/MVP_SCOPE.md`
6. `docs/DECISIONS.md`
7. `docs/TECH_STACK.md`
8. `docs/SYSTEM_ARCHITECTURE.md`
9. `docs/DATABASE_SCHEMA.md`
10. `docs/SECURITY_PROTOCOL.md` and `docs/SECURITY_PRIVACY.md`
11. `docs/CODE_QUALITY.md`
12. `docs/IMPLEMENTATION_PLAN.md`
13. Feature-specific documents for the first milestone.

Then respond with:

- Your understanding of the product and primary user problem.
- Exact MVP features and exclusions.
- Current repository/starter assessment.
- Proposed app, backend and Firebase architecture.
- The first milestone and acceptance criteria.
- Security risks, unresolved decisions or contradictions.

Do not generate the whole application in one response. Do not skip the analysis response.

## Technology constraints

- Web: Next.js App Router + React + TypeScript, unless the existing AI Studio starter makes a compatible, documented alternative necessary.
- Firebase: Firebase Authentication, Cloud Firestore, Firestore Security Rules, Cloud Functions for Firebase (2nd gen), Cloud Storage when a file feature is approved, App Check and Firebase Emulator Suite.
- Hosting: Firebase App Hosting for Next.js if the selected framework/runtime version is currently supported; confirm official compatibility before pinning versions.
- AI: Gemini initially, called only by trusted server code via a provider adapter.
- Future Android: Expo + React Native + TypeScript. Keep domain types, validation schemas and API contracts platform-neutral. Android is not part of MVP.
- Do not use Supabase or Postgres unless a documented decision is explicitly changed by the project owner.
- Do not introduce microservices, Kubernetes, self-hosted SFU, complex event streaming or Redis before measurable need.

## Mandatory security rules

- Never hardcode Gemini/API provider keys, Firebase Admin private keys, payment/webhook secrets, LiveKit/SFU secrets or any privileged credential in frontend/mobile code, public environment variables, source maps, URLs or logs.
- Firebase web configuration (project ID, app ID, web API key) is public client configuration and is not the same as Admin credentials. Protect data using Authentication, Security Rules, App Check and server authorization.
- Verify Firebase ID tokens on every trusted backend endpoint and derive UID from the verified token.
- Use deny-by-default Firestore Security Rules for every client-accessible collection/subcollection. Firestore has document/path Security Rules, not SQL RLS. Rules are not filters.
- Admin SDK bypasses Firestore Security Rules. Every backend Admin SDK action must do its own authorization and use least-privilege IAM.
- Keep roles, membership changes, session transitions, authoritative messages, reports, scores, audit events and any future entitlements server-controlled.
- Validate every external request and model output with runtime schemas. Prevent injection, XSS, SSRF, path traversal and mass assignment.
- Use App Check as an additional layer, not a substitute for authentication, authorization or rate limits.
- Use per-user/session/IP throttles, size limits, idempotency and spend quotas.
- Never log tokens, cookies, credentials, signed URLs or full private transcripts.
- Treat prompt/transcript content and AI output as untrusted. Verify evidence IDs and excerpts before storing reports.
- Test Security Rules with Firebase Emulator Suite and test server authorization separately.
- Do not implement file upload, payments, voice/video or SFU media until a phase authorizes it and the corresponding `SECURITY_PROTOCOL.md` section is satisfied.

## Product constraints

- This is an engineering-practice product, not a generic social network.
- Optimize for demonstrated learning and high-quality contribution.
- MVP is responsive, text-first web: profiles, curated topics/scenarios, small written sessions, structured discussion followed by open discussion, private evidence-linked AI feedback, basic competency observations and recommendations.
- Room size is 2–6, target 4–6. Users can pass.
- Do not build public leaderboards, voice/video, multi-agent AI group rooms, automatic matching, mentor marketplace, Android, payments or uploads in MVP.

## Required working process

For each milestone:

1. List the exact files/collections/rules/functions you will create or change.
2. State acceptance criteria and trust boundaries.
3. Identify data classification, allowed readers/writers and abuse/rate-limit needs.
4. Implement the smallest complete vertical slice.
5. Add Firestore/Storage Security Rules before exposing a data path.
6. Add positive and negative rules tests and backend authorization tests.
7. Run lint, typecheck, unit tests, emulator/rules tests, end-to-end tests and production build where available.
8. Fix failures; do not hide or skip them to claim completion.
9. Update relevant docs and decisions.
10. Report completed work, tests, assumptions, limitations and remaining risks.

## First implementation task

Start with **Phase 0 only** from `docs/IMPLEMENTATION_PLAN.md`: inspect the current starter, establish the project structure, design tokens, app shell, strict TypeScript, environment validation, Firebase development configuration, Emulator Suite, deny-by-default Firestore/Storage Rules, CI checks and basic tests. Do not build the discussion engine until the foundation passes its checks.

If the repository already contains code, inspect it first and preserve valid work. Never overwrite files blindly. Ask before introducing a materially different database, framework or hosting provider.
