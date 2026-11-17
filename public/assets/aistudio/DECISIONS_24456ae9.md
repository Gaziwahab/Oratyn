# Product and Architecture Decision Log

This file records current decisions so implementation agents do not invent contradictory behaviour. Add a dated entry whenever a material decision changes.

## Current decisions

| ID | Decision | Rationale | Status |
|---|---|---|---|
| D-001 | Working title is Engineering Practice Platform; final brand name is undecided. | Avoid premature branding work. | Accepted |
| D-002 | Core product is engineering practice, not a social feed. | Keeps product and metrics focused on learning. | Accepted |
| D-003 | Initial audience is CS students and early-career developers. | Clear first user and scenario level. | Accepted |
| D-004 | MVP is English-only and responsive web. | Validate the learning loop before native clients. | Accepted |
| D-005 | MVP is text-first; no voice or video. | Avoid media complexity until demand is proven. | Accepted |
| D-006 | Rooms support 2–6 participants; target 4–6. | Give each person a fair chance to contribute. | Accepted |
| D-007 | Room flow starts structured, then transitions to open discussion. | Balances fair participation with natural conversation. | Accepted |
| D-008 | MVP includes human written sessions and AI post-session evaluation; autonomous AI rooms are later. | Validate human discussion before expanding AI experiences. | Accepted |
| D-009 | AI evaluations are private by default, formative and evidence-linked. | Reduce reputational harm and make feedback inspectable. | Accepted |
| D-010 | One session cannot establish a permanent skill label or public rank. | Avoid overclaiming from noisy evidence. | Accepted |
| D-011 | Use a modular monolith for MVP. | Lower operational complexity and faster iteration. | Accepted |
| D-012 | Use Next.js + TypeScript for web, Firebase Auth/Firestore/Functions/Storage for backend services. | Aligns with the Firebase-based AI Studio workflow. | Accepted |
| D-013 | Plan for Android with Expo + React Native + TypeScript, sharing domain/validation/contracts but not web UI components. | Preserves a practical native mobile path without building it in MVP. | Accepted |
| D-014 | Firestore Security Rules are the client data access layer; server authorization and IAM protect Admin SDK operations. | Firestore does not use SQL RLS; Admin SDK bypasses Firestore Rules. | Accepted |
| D-015 | AI provider access is isolated behind a server-only adapter. | Keeps model/vendor replaceable and secrets private. | Accepted |
| D-016 | Firestore persistence is authoritative; realtime listeners are only a delivery mechanism. | Prevents lost or inconsistent messages. | Accepted |
| D-017 | No public leaderboard in MVP. | Avoids optimizing for volume or performative debate. | Accepted |
| D-018 | Pilot content is curated by admins. | Maintains quality and rubric consistency. | Accepted |
| D-019 | Async-friendly text sessions are supported with scheduled facilitated sessions. | Reduces cold-start and attendance constraints. | Accepted |
| D-020 | Voice/video, SFU, payments, file attachments and AI multi-agent rooms are out of MVP. | They add significant security, cost and operational complexity. | Accepted |
| D-021 | AI Studio is an implementation environment, not the product's security boundary. | Generated code must still meet these rules and be reviewed/tested. | Accepted |

## Decisions to validate

1. Launch geography, privacy requirements and data region.
2. Invite-only vs open registration for the first cohort.
3. Firebase Authentication providers and account recovery policy.
4. Whether direct client reads or server-mediated reads are best for each collection; default to rules-protected reads and trusted writes.
5. AI provider/model, pricing, retention terms and evaluation queue approach.
6. Which App Check providers are suitable for web and Android clients.
7. Whether user-created sessions belong in P1 or remain host/admin-created until moderation capacity exists.
8. Pricing and monetization; no paid plan is assumed in MVP.
9. Exact baseline-assessment design; onboarding must not be blocked by a lengthy test.
10. Whether/when to build Android after web pilot validation.

## Change procedure

When a decision changes, record date, old behaviour, new behaviour, rationale, affected docs, migration/compatibility implications and whether existing users/data are affected. Update the tech stack, architecture, security protocol and AI Studio prompt together when changing platform/security assumptions.
