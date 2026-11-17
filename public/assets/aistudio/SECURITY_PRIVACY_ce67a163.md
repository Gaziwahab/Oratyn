# Security and Privacy Summary

This document is the concise security/privacy overview. `SECURITY_PROTOCOL.md` is the detailed mandatory engineering standard and takes precedence for implementation details.

## 1. Security objectives

Protect account identity, private discussions, private learning evaluations, moderation records, future payment entitlements and future voice/video sessions. Every feature must use least privilege and enforce authorization on the server and at the data boundary.

## 2. Platform security model

- Authentication: Firebase Authentication.
- Primary database: Cloud Firestore.
- Client data protection: Firestore Security Rules and Cloud Storage Security Rules.
- Trusted operations: Cloud Functions for Firebase (2nd gen) / Cloud Run where justified.
- Server identity: verified Firebase ID token, with revocation checks for high-risk operations as appropriate.
- Abuse protection: Firebase App Check plus per-user/IP limits, quotas and anomaly monitoring.
- Secrets: Google Secret Manager and protected deployment environment.

Firestore does not provide SQL row-level security. Firestore Security Rules are the document/path authorization layer. Rules are not filters, and Admin SDK/server libraries bypass these rules. Backend code must enforce authorization independently and use least-privilege IAM.

## 3. Data classification

| Data | Classification | Default access |
|---|---|---|
| Firebase auth identity/email | Sensitive account data | User and auth provider; limited support access only where justified |
| Private user profile/preferences | Personal data | Owner only |
| Public profile | Personal data | Community only after explicit opt-in |
| Room messages | User-generated private content | Current authorized session members |
| AI evaluation/report/evidence | Sensitive learning feedback | Evaluated user only by default |
| Moderation reports/actions | Sensitive safety records | Authorized moderators/admins; reporter sees limited status |
| Provider/Admin/payment/SFU keys | Secret | Trusted backend only |
| Analytics/diagnostics | Potentially personal | Minimized, pseudonymized and role-restricted |
| Audit events | Security-sensitive operational records | Restricted operations/security staff |

## 4. Required controls

- Never hardcode secrets in frontend or mobile code. Firebase web config is public configuration; Admin service-account private keys and provider secrets are not.
- Do not allow credentials, tokens, cookies, signed URLs or private transcript data into URLs or logs.
- Verify identity and authorization server-side on every sensitive operation; do not trust client-supplied UID, role or ownership.
- Apply deny-by-default Firestore/Storage Rules and test both allowed and denied paths with the Firebase Emulator Suite.
- Validate request schemas and allowlisted fields server-side. Prevent XSS, NoSQL/SQL injection, SSRF, path traversal, mass assignment and open redirects.
- Treat AI prompts and outputs as untrusted. Validate schemas and all evidence references against stored records.
- Apply rate limiting, App Check, quotas, abuse monitoring and safe retry/idempotency.
- Use private uploads, server-generated paths, size/type allowlists, byte-level checks and quarantine/scanning if file uploads are introduced.
- Verify webhook signatures and replay/idempotency before changing payment status if payments are introduced.
- Mint short-lived least-privilege SFU room tokens server-side if WebRTC is introduced.
- Maintain append-only application audit events; use separately restricted/retention-locked log storage when a stronger tamper-resistance guarantee is required.
- Apply TLS, secure headers, CSP, CSRF protection where applicable, dependency scanning, backups, recovery drills and incident response.

## 5. Privacy commitments

- Private profiles, session reports and learning evidence are private by default.
- Public profile sharing is opt-in and limited to selected fields.
- Use only the minimum transcript/profile context needed for AI evaluation.
- Clearly disclose AI processing; do not use private reports for hiring or public rankings.
- Do not log full transcripts by default.
- Define retention, export and deletion procedures for profiles, messages, reports, moderation records, uploads, logs and backups.
- Obtain clear consent and legal review before adding voice/video recording or transcription.
- Review India and other launch-market privacy requirements with qualified counsel before public launch. This document is not legal advice.

## 6. Release gate

No feature is launch-ready until it has a documented data classification, authorization model, rules/backend checks, negative-access tests, safe failure behaviour, logging/retention decision and user-facing privacy disclosure where required. See `SECURITY_PROTOCOL.md` for the full checklist.
