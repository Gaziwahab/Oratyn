# Instructions for AI Coding Agents

You are working on the Engineering Practice Platform. Treat `/docs` as the product and engineering specification, not as optional background reading. `docs/SECURITY_PROTOCOL.md` and `docs/CODE_QUALITY.md` are mandatory.

## Before writing code

1. Read `README.md`, this file, `docs/PROJECT_OVERVIEW.md`, `docs/PRD.md`, `docs/MVP_SCOPE.md`, `docs/DECISIONS.md`, `docs/TECH_STACK.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/DATABASE_SCHEMA.md`, and `docs/SECURITY_PROTOCOL.md`.
2. Inspect the current repository and preserve valid existing work. Never overwrite a working AI Studio starter blindly.
3. Read `docs/CODE_QUALITY.md` and `docs/SECURITY_PROTOCOL.md`. Summarize the requirement, modules, data paths, trust boundaries, authorization implications, security tests and acceptance criteria before implementation.
4. Identify genuine contradictions. Do not silently make consequential product, security, privacy, billing or data-retention decisions.

## Product rules

- This is an engineering-practice product, not a generic social feed.
- Optimize for demonstrated learning and contribution quality, not engagement volume.
- MVP is text-first. Do not add voice, video, AI multi-agent rooms, automatic matching, native Android, payments or arbitrary file uploads unless a phase explicitly authorizes them.
- A normal room supports 2–6 participants; target 4–6.
- Discussion begins with structured contributions and then allows open discussion. It must not feel like a rigid examination.
- Participants may pass. Do not force personal disclosures.
- AI feedback is formative, fallible, evidence-based and private by default.
- Do not invent user activity, AI evidence, citations or evaluation quotes.

## Mandatory technical and security rules

- Use TypeScript strict mode and small, focused modules.
- Use Next.js for web and Firebase Authentication/Firestore/Cloud Functions (2nd gen)/Storage according to `docs/TECH_STACK.md`.
- Plan for a future Expo + React Native Android app by keeping pure domain rules, validation schemas and API contracts platform-neutral. Do not prematurely build the Android app.
- Never hardcode provider, Admin, payment, webhook or SFU secrets in frontend/mobile code. Never expose them through public environment variables, browser bundles, source maps, URLs or logs.
- Firebase web config is public client configuration; Admin service-account credentials and provider keys are secrets. Do not confuse them.
- Verify Firebase ID tokens server-side for trusted backend endpoints. Derive UID from verified identity, never from request JSON.
- Firestore Security Rules are required for every client-accessible path. Firestore does not have SQL RLS; Rules are the document/path access layer. Rules are not filters.
- Admin SDK bypasses Firestore Security Rules. Every Admin SDK operation must perform server-side authentication/authorization and use least-privilege IAM.
- Default deny for Firestore and Storage. Add rule tests for allowed AND denied access using Firebase Emulator Suite.
- Validate all external inputs at runtime with strict schemas. Use allowlists and prevent mass assignment, injection, XSS, SSRF and path traversal.
- App Check complements Authentication and authorization; it never replaces them. Add per-user/IP limits, quotas and abuse controls.
- Never log credentials, tokens, cookies, signed URLs or full private transcripts by default.
- Keep all AI calls and secrets server-side. Treat prompts/transcripts and model outputs as untrusted. Validate structure and evidence before persistence.
- Persist messages and session events before realtime notification. Firestore is the source of truth.
- Do not create audit events from the client. Keep privileged audit/interaction records append-only in trusted backend code.
- Do not add file upload, payment or WebRTC/SFU functionality without following the corresponding sections of `SECURITY_PROTOCOL.md`.
- Do not execute user-submitted code or render arbitrary HTML.
- Do not commit `.env` files, API keys, service-account files, production data or test secrets.

## Implementation discipline

- Build according to `docs/IMPLEMENTATION_PLAN.md`, one phase at a time.
- Complete a vertical slice: schema/data paths + rules + backend logic + UI + tests + docs.
- No decorative buttons or fake interactions. Every MVP control must work or be clearly unavailable.
- Keep UI policy-free; authorization belongs in trusted backend and Security Rules.
- Avoid `any` except narrow documented cases.
- Add loading, empty, error, offline/reconnect and permission-denied states.
- Use pagination and query limits. Never listen to unbounded collections.
- Keep business logic out of large page components and do not introduce premature microservices.
- Add migration/index/rules changes to version control. Do not make undocumented manual production changes.
- Run lint, typecheck, unit/integration tests, rules tests and a production build as applicable.

## AI evaluation requirements

- Evaluate only observable session evidence. Insufficient evidence means `insufficient_evidence`; do not guess.
- Evidence must reference real message IDs and verified excerpts from the same session.
- Separate technical accuracy from communication, reasoning and collaboration.
- Do not infer intelligence, personality, confidence, employability or professional suitability.
- Do not publicly rank users from one session.
- Record AI-generated label, provider/model and prompt/rubric version as appropriate.
- Allow users to flag inaccurate feedback.

## Definition of done

A change is incomplete until:

1. Acceptance criteria are satisfied.
2. Firestore/Storage rules and backend authorization are reviewed.
3. Positive and negative authorization tests pass.
4. Validation, rate limits and error states are implemented.
5. Relevant unit, integration, rules and end-to-end tests pass.
6. No secrets or unrelated refactors were introduced.
7. Docs are updated if behavior, data model, API, setup, security or decisions changed.
8. Final report explains changes, tests, assumptions, known risks and next step.

## When uncertain

Prefer the smallest reversible implementation that preserves product and security principles. Ask only when a decision blocks safe implementation; otherwise document the assumption and add consequential choices to `docs/DECISIONS.md`.
