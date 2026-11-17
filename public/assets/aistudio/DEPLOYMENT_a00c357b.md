# Deployment and Operations

## 1. Environments

Maintain separate Firebase/Google Cloud projects for development, staging and production. Use separate Auth configuration, Firestore databases, Storage buckets, secrets, App Check app registrations and service accounts. Never use production user data in staging tests.

## 2. Deployment path

- Web: deploy Next.js through Firebase App Hosting once the project's framework/runtime version is supported.
- Backend: deploy TypeScript Cloud Functions (2nd gen) using Firebase CLI/CI with reviewed IAM and Secret Manager bindings.
- Data policy: deploy Firestore and Storage rules and Firestore indexes from version control.
- Android (future): build and distribute with Expo EAS or an approved Android CI pipeline; use separate Firebase Android app registration and App Check Play Integrity configuration where supported.

## 3. Pre-deployment checklist

- [ ] Confirm region, data location and vendor/privacy requirements.
- [ ] Confirm Node.js and Next.js versions are supported by App Hosting.
- [ ] Configure production secrets in Secret Manager; never copy local `.env` values into source.
- [ ] Confirm no Admin/service-account, AI, payment or SFU secrets are in frontend bundles, source maps, URLs or logs.
- [ ] Configure Firebase Authentication providers, allowed domains and redirect URLs.
- [ ] Deploy Firestore/Storage rules in locked, deny-by-default form.
- [ ] Deploy reviewed indexes and test all production query shapes.
- [ ] Run Firestore/Storage Rules tests in Emulator Suite.
- [ ] Run server authorization tests for every Admin SDK operation.
- [ ] Confirm App Check monitoring/enforcement plan for supported services and custom endpoints.
- [ ] Confirm least-privilege IAM for App Hosting, Functions and background workers.
- [ ] Set Functions/Cloud Run timeouts, max instances, concurrency and memory limits.
- [ ] Set budget alerts and quotas for AI, Firestore, Storage, egress, functions and notifications.
- [ ] Confirm rate limits, account abuse controls and idempotency are active.
- [ ] Confirm audit logging and alerts for privileged operations.
- [ ] Confirm backup/restore procedure and test a restore in a non-production environment.
- [ ] Confirm error monitoring, health checks and incident contacts.
- [ ] Confirm AI model, rubric/prompt versions, usage limits and disable switch.
- [ ] Confirm privacy notice, AI disclosure, community rules, data retention and deletion process.
- [ ] Run security regression tests and critical end-to-end smoke tests.

## 4. Security Rules and indexes

- Keep `firestore.rules`, `storage.rules` and `firestore.indexes.json` in version control.
- Review changes alongside the feature that requires them.
- Test allowed and denied cases before deployment.
- Stage rules/index changes before production. Avoid ad hoc console changes; if emergency console edits are unavoidable, export and commit the resulting policy immediately.
- Remember: Admin SDK bypasses Firestore Rules. Backend authorization tests are separate release gates.

## 5. Scaling and cost controls

- Set max instances, concurrency, timeouts and memory based on load testing; autoscaling without limits can create unexpected cost.
- Monitor Firestore reads/writes, document contention, index fan-out, listener count and egress.
- Use pagination and bounded queries. Do not attach unbounded listeners to all messages or reports.
- Keep functions stateless and use durable queueing for slow AI work.
- Add Cloud Run/Cloud Tasks or a dedicated worker only when required.
- Add a budget alert before enabling external AI, file uploads, high-volume notifications or media.
- Scale the cohort gradually; observe actual room usage before opening public registration.

## 6. AI operations

Monitor evaluation success/failure, latency, token cost, retry count, invalid schema rate, evidence-validation rejection, queue age and user feedback. Disable new AI runs through a server-side feature flag if provider quality or safety degrades. Completed sessions remain accessible.

## 7. Realtime and future media

For text realtime, monitor listener health and persisted message errors. Reconnect by fetching authoritative state. Voice/video remains out of MVP. Before media launch, review `SECURITY_PROTOCOL.md`, SFU room/token grants, participant revocation, bitrate and bandwidth limits, recording consent, incident response and provider cost.

## 8. Backups and recovery

- Confirm backup coverage and retention for Firestore and Storage.
- Test restore procedures, including indexes/rules and dependent files.
- Document recovery owner, RPO/RTO targets and data reconciliation steps.
- Keep audit export retention separate from ordinary app content retention where legally justified.

## 9. Monitoring and logs

Track API latency/errors, function health, Firestore errors/usage, session creation/join/message rates, evaluation failures, moderation reports, App Check rejects, rate limits, unusual role changes, upload scan outcomes, payment events and future SFU bandwidth. Avoid logging full private transcripts, credentials, ID tokens, signed URLs, webhook bodies with sensitive values or private profile data.

## 10. Release strategy

Start invite-only. Use feature flags. Deploy changes to staging, run emulator/security tests, deploy to a small cohort and monitor before full rollout. Maintain a rollback or forward-fix plan. Do not open voice, payments or uploads before their feature-specific security gates pass.

## 11. Incident response

Maintain an owner and tested procedure to disable affected features, revoke sessions, rotate keys, suspend accounts, stop session creation, disable AI/media/payment integrations, preserve restricted audit evidence, restore backups and notify affected users when required. See `SECURITY_PROTOCOL.md`.
