# Engineering Practice Platform — Project Documentation

> Working title only. The final product name has not been chosen.

This repository contains the product, technical and security specification for a platform that helps computer science students and software developers become better engineers by practising how to **think, explain, question, review, and collaborate** on real engineering problems.

It is deliberately not specified as a generic developer social network or a conventional video-course platform. The core product loop is:

**Choose a skill or scenario → reason through it → explain and defend an approach → receive useful challenge and feedback → revise → practise the next skill.**

## Start here

1. Read [`AGENTS.md`](AGENTS.md) and [`docs/SECURITY_PROTOCOL.md`](docs/SECURITY_PROTOCOL.md) before making code changes. They contain the mandatory product and secure engineering rules.
2. Read [`AI_STUDIO_START_PROMPT.md`](AI_STUDIO_START_PROMPT.md) and paste it into your coding environment if you are using Google AI Studio or another AI builder.
3. Read [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md), [`docs/PRD.md`](docs/PRD.md), and [`docs/MVP_SCOPE.md`](docs/MVP_SCOPE.md).
4. Read [`docs/DECISIONS.md`](docs/DECISIONS.md) to understand the deliberate trade-offs and avoid reopening settled scope decisions without a reason.
5. Follow [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) milestone by milestone. Do not attempt to build every future feature in one pass.

## Documentation map

| Document | What it defines |
|---|---|
| `PROJECT_OVERVIEW.md` | Product concept, problem, audience, core loop |
| `PRODUCT_STRATEGY.md` | Positioning, wedge, differentiation, product principles |
| `PRD.md` | Product requirements and acceptance criteria |
| `MVP_SCOPE.md` | What is and is not in the first release |
| `USER_FLOWS.md` | Main user journeys and states |
| `INFORMATION_ARCHITECTURE.md` | Navigation, pages, and content hierarchy |
| `UI_UX_GUIDELINES.md` | Visual and interaction direction |
| `TECH_STACK.md` | Recommended implementation stack and rationale |
| `SYSTEM_ARCHITECTURE.md` | Application boundaries, services, and data flows |
| `DATABASE_SCHEMA.md` | Firestore document/collection model and access boundaries |
| `API_CONTRACTS.md` | API conventions and endpoint contracts |
| `DISCUSSION_ENGINE.md` | Room types, phases, turn-taking, lifecycle |
| `AI_ENGINE.md` | AI roles, prompts, evaluation output, safeguards |
| `COMPETENCY_ROADMAP.md` | Skill model, evidence, progression, recommendations |
| `SECURITY_PRIVACY.md` | Security and privacy overview |
| `TRUST_SAFETY_MODERATION.md` | Community rules, reporting, moderation |
| `TESTING.md` | Test strategy and release gates |
| `ENVIRONMENT_SETUP.md` | Local development setup and environment variables |
| `DEPLOYMENT.md` | Deployment and operations checklist |
| `IMPLEMENTATION_PLAN.md` | Ordered build milestones |
| `ANALYTICS_SUCCESS_METRICS.md` | Product outcomes and analytics events |
| `DECISIONS.md` | Current product and architecture decisions |
| `CONTENT_AUTHORING_GUIDE.md` | Starter subject taxonomy, scenario template, sample scenario, and rubric guidance |
| `GLOSSARY.md` | Shared domain vocabulary |
| `CODE_QUALITY.md` | Simple, modular, testable and upgrade-friendly coding standards |
| `SECURITY_PROTOCOL.md` | Mandatory secure engineering protocol covering secrets, authorization, Firebase Rules, injection, abuse, AI prompt injection, uploads, payments/webhooks, WebRTC/SFU, audit trails, privacy, scaling and production hardening |

## Project structure after implementation begins

The exact source layout can be adapted to the chosen host, but keep clear boundaries. A recommended starting structure is:

```text
project/
├── AGENTS.md
├── README.md
├── docs/                       # This specification pack
├── public/
├── apps/
│   └── web/                    # Next.js routes and layouts
├── functions/                  # Trusted Firebase Cloud Functions (2nd gen)
├── packages/
│   ├── domain/                 # Shared pure domain logic
│   ├── validation/             # Shared runtime schemas
│   └── contracts/              # Shared API contracts
├── firebase/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   ├── storage.rules
│   └── tests/                  # Emulator-based rules tests
├── apps/mobile/                # Future Expo/React Native Android app (not MVP)
├── tests/
├── .env.example
├── firebase.json
└── package.json / pnpm-workspace.yaml
```

## Current scope in one paragraph

The first release is an English, responsive, text-first web application for CS students and early-career developers. It includes accounts and profiles, a curated topic/scenario library, small written engineering discussion sessions, a structured discussion flow followed by open discussion, post-session AI feedback grounded in the actual contributions, a basic competency profile, and next-practice recommendations. It does **not** attempt to launch with voice/video, AI multi-agent rooms, automated matching, a mentor marketplace, public score leaderboards, or a complex microservice architecture.

## How to treat decisions

- A requirement marked **MVP / P0** is required for the first usable release.
- **P1** is a logical next release after the core loop has been validated.
- **P2 / Later** is explicitly not part of the initial build.
- Where a document describes a future feature, it is not permission to implement it in the MVP.
- If two documents appear inconsistent, follow `DECISIONS.md`, then `MVP_SCOPE.md`, then `PRD.md`, and report the inconsistency rather than silently inventing a rule.

## Technology and platform direction

The current recommendation is Next.js + TypeScript for web, Firebase Authentication and Cloud Firestore for identity/data, Cloud Functions (2nd gen) for trusted operations, and Firebase App Hosting where the selected framework/runtime is supported. A future Android app should use Expo + React Native + TypeScript and share domain logic, validation schemas and API contracts—not web UI components. See `docs/TECH_STACK.md` and `docs/DECISIONS.md`.

Firestore uses document/path Security Rules rather than SQL Row Level Security. Admin SDK calls bypass those Rules and must enforce authorization in server code. The full mandatory security standard is `docs/SECURITY_PROTOCOL.md`.

## Product success principle

The main success measure is not time spent, messages sent, or points earned. It is whether users demonstrate improvement in engineering competencies across repeated, comparable practice opportunities.
