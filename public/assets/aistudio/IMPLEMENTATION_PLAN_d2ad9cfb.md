# Implementation Plan and Phased Delivery

## Build philosophy

Build the smallest complete learning loop, one vertical slice at a time. Each milestone includes UI, data model, backend logic, authorization, security tests and documentation. Do not generate the entire platform in one large AI coding pass.

## Phase 0 — Product and engineering foundation

**Goal:** A reproducible, secure, maintainable repository.

- Inspect and preserve the existing AI Studio project if one exists.
- Establish Next.js + TypeScript web app and a light structure for `functions/` and shared domain/validation packages. Avoid heavy monorepo tooling unless needed.
- Add strict lint/typecheck/format/test scripts, lockfile and supported runtime versions.
- Add design tokens and responsive application shell.
- Create separate Firebase development project and configure Auth, Firestore and Emulator Suite.
- Add environment schema, `.env.example`, secret handling and safe error reporting.
- Add deny-by-default Firestore/Storage Rules before feature data.
- Add Firebase App Check in monitoring mode; prepare enforcement once legitimate client traffic is verified.
- Configure CI secret/dependency scans and rule test command.

**Acceptance:** App runs locally; emulator starts; typecheck/lint/tests/build pass; no secrets are committed or bundled; rules deny unconfigured access.

## Phase 1 — Authentication and profiles

**Goal:** A user can create an account and manage private profile information safely.

- Firebase Authentication flows and protected routes.
- Verified server identity for trusted operations.
- `users`, `publicProfiles` and `userPreferences` data paths.
- Owner read/update rules or validated server write operations.
- Onboarding: display name, experience band, goals and interests.
- Privacy defaults and opt-in community profile visibility.
- Tests for unauthenticated, wrong-user and field-mass-assignment attempts.

**Acceptance:** User can sign up, sign in, complete onboarding, sign out and update permitted fields; other users cannot read private profile data or elevate roles.

## Phase 2 — Curated learning catalogue

**Goal:** Users can explore high-quality topics and scenarios.

- Domains, topics, competencies, scenarios and versioned rubrics.
- Admin/content-manager server authorization.
- Published-content read rules and draft-content restrictions.
- Search/filter with bounded query limits and required indexes.
- Seed 6–10 representative scenarios across CS/software domains.

**Acceptance:** Published content is readable; drafts are restricted; seed is repeatable; topic pages show objectives, difficulty and prerequisites.

## Phase 3 — Sessions and membership

**Goal:** Users can discover and join eligible text sessions.

- Session and participant collections/subcollections.
- Trusted create/join/leave functions and idempotency.
- Capacity limit 2–6 enforced in a Firestore transaction.
- Host controls and allowed lifecycle transition service.
- Membership-aware read rules and backend negative tests.

**Acceptance:** Capacity cannot be exceeded by concurrent joins; a user cannot self-assign host/moderator; unauthorized users cannot inspect private membership/session data.

## Phase 4 — Structured discussion protocol

**Goal:** Participants can complete a small written engineering discussion.

- Phase engine and transition rules.
- Server-created messages, safe Markdown/code rendering, pagination.
- Structured contribution, cross-questioning, open discussion and conclusion.
- Pass option, turn guidance, moderation/report/block controls.
- Firestore listener updates with reconnect/re-fetch fallback.
- Append-only session interaction events.
- Per-user/per-room message rate limits and body size ceilings.

**Acceptance:** Two or more test users can complete a room; refresh/reconnect does not lose persisted messages; non-members cannot read/post; duplicate sends are idempotent; moderator actions are audited.

## Phase 5 — AI evaluation

**Goal:** A completed session generates a private, evidence-linked report.

- Provider-neutral AI adapter; Gemini secret server-side only.
- Versioned rubric/prompt and strict response schema.
- Durable evaluation job, bounded retries and usage limits.
- Evidence ID and excerpt verification.
- Private report UI, user feedback and review flag.
- Prompt injection, malformed output, invented evidence, provider outage and insufficient-evidence tests.

**Acceptance:** Session completion survives AI failure; only evaluated user can read report; evidence maps to real messages; invalid model output is rejected; spend limits are enforced.

## Phase 6 — Competency profile and next practice

**Goal:** Feedback supports a careful evidence-based learning path.

- Competency observations as dated evidence, not permanent labels.
- Confidence, number of observations and recency-aware aggregation.
- Transparent rules-based next-practice suggestions with rationale.
- Progress dashboard and dismissal/feedback controls.

**Acceptance:** One session cannot imply mastery; recommendations show source evidence; users can inspect and correct feedback context.

## Phase 7 — Pilot readiness and production hardening

**Goal:** Run a controlled cohort safely.

- Moderation queue, staff roles and audit trail.
- App Check enforcement after monitoring; rate limits and abuse alerts.
- Dependency scans, security headers, CSP, CORS/CSRF controls and secret scans.
- Data retention/export/deletion workflow and privacy review.
- Load testing, quotas, budget alerts and backup/restore exercise.
- Production monitoring, incident runbooks and feature kill switches.
- Accessibility, responsive, security and end-to-end tests.

**Acceptance:** P0 flows work; security gates pass; moderation is staffed; AI can be disabled independently; recovery/incident procedures are tested.

## Post-MVP phases (not build authorization)

### Phase 8 — Better discovery and scheduled sessions
- Scheduled sessions, reminders, host-created rooms and safer discovery.
- Waitlists and matching rules after enough usage data exists.

### Phase 9 — AI practice arena
- One-to-one AI practice and teach-back mode, with disclosure and safety controls.
- AI group rooms only after the evaluator and discussion quality are validated.

### Phase 10 — Native Android app
- Expo + React Native + TypeScript app.
- Reuse shared domain types, validation schemas and backend contracts.
- Add Android Firebase app registration, App Check attestation, secure storage and FCM notifications.
- Test auth, offline/reconnect behaviour and rules independently on Android.

### Phase 11 — Voice/video and engineering labs
- Managed SFU (evaluate LiveKit Cloud), secure room-token issuer, media permissions, bandwidth/quality controls and explicit recording consent.
- Shared diagrams, code review workspace and engineering incident simulations.

### Phase 12 — Monetization and integrations
- Payments/subscriptions only after product-market validation and security/legal review.
- Webhook signature verification, idempotency and server-authoritative entitlements.
- GitHub/IDE integrations, mentors, enterprise/community features only with clear demand.

## Delivery rules

- One milestone at a time; do not skip security tasks to make a demo look complete.
- Prefer complete vertical slices over disconnected pages.
- Every feature begins with acceptance criteria and threat/access review.
- Keep the app buildable after each milestone.
- Do not add microservices or infrastructure without measured need.
- Keep all future phases clearly disabled/out of MVP.

## Prioritization

1. Security/privacy/correctness blockers.
2. Broken core learning journey.
3. Learning value and feedback quality.
4. Abuse prevention and operational reliability.
5. Performance and cost.
6. Visual polish and convenience.
