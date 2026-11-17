# Changelog

All notable product and technical changes should be recorded here. This documentation pack starts at `0.1.0`; update the version when the specification changes materially.

## [0.1.0] — 2026-11-13

- Established the product concept and the engineering-practice learning loop.
- Defined a text-first MVP for CS students and early-career developers.
- Separated MVP requirements from post-MVP capabilities.
- Added product, UX, architecture, data, API, AI, security, testing, and delivery documentation.
- Recorded provisional stack recommendations and decisions that require validation during implementation.


## 2026-11-13 — Firebase and security protocol revision

- Replaced Supabase/PostgreSQL assumptions with Firebase Authentication, Cloud Firestore, Security Rules, Cloud Functions (2nd gen), Storage and App Check.
- Added a mandatory security protocol covering secret management, DevTools/network exposure, server authorization, Firestore Rules, injection, package hygiene, abuse/rate limits, uploads, payments/webhooks, WebRTC/SFU tokens, audit trails, privacy, fail-safe behaviour, scaling and production hardening.
- Updated the database model, API contracts, architecture, implementation phases, deployment, setup, AI Studio prompt and coding-agent instructions.
- Selected Next.js/TypeScript for web and Expo/React Native/TypeScript as the future Android path, with shared domain/validation/contracts.

- Added `CODE_QUALITY.md` with modular architecture, TypeScript, Firestore efficiency, testing and upgrade-friendly coding standards.
