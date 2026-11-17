# Security Protocol and Secure Engineering Standards

**Status:** Mandatory engineering policy for every developer and AI coding agent. This is the primary security reference. Read it before creating authentication, data access, API, file upload, AI, payments, realtime or media code.

The platform will handle user identities, private discussions, learning assessments, private reports and potentially payments and live media. Security is part of every feature's definition of done—not a final pre-launch task.

## 1. Non-negotiable principles

1. **Never trust the client.** Browser/mobile input, hidden UI state, local storage, URL parameters, app-provided user IDs, role fields and AI responses are untrusted.
2. **Least privilege.** Each user, function, service account, token, collection and storage path receives only the access it needs.
3. **Deny by default.** New Firestore collections, subcollections, Storage paths, API routes and callable functions start inaccessible until reviewed rules explicitly grant access.
4. **Server owns important decisions.** Membership, room capacity, phase changes, scores, account status, permissions, payments, audit records and SFU token generation are controlled by trusted backend code.
5. **Validate at every trust boundary.** Validate request shape, lengths, IDs, enumerations, state transitions and external provider responses on the server.
6. **Fail closed for security.** If identity, authorization, signature verification or required security checks cannot be established, deny the sensitive action.
7. **Minimize data.** Collect, transmit, log and retain only what is needed for the feature.
8. **Build for review.** Security rules, authorization decisions, migrations/indexes, tests and operational assumptions must be committed and reviewable.

## 2. Secrets, API keys and frontend exposure

### Never place these in frontend code

- Gemini/LLM provider keys.
- Firebase Admin service-account private keys, private key JSON or ADC credentials.
- Payment provider secret keys and webhook signing secrets.
- LiveKit/SFU API secrets or JWT signing keys.
- Private storage signing credentials.
- Database/admin credentials, OAuth client secrets or internal service tokens.
- Encryption keys, signing keys, private certificates and production-only secrets.

Never hardcode them in React components, `NEXT_PUBLIC_*` variables, mobile app source, build-time public config, Git commits, issue screenshots, analytics events or client-side error reports. Mobile binaries can be reverse engineered; obfuscation is not secret storage.

### Correct secret handling

- Store backend secrets in Google Secret Manager and bind each secret only to the Cloud Function/Cloud Run service that needs it.
- Use separate credentials and Firebase projects for development, staging and production.
- Grant service accounts least-privilege IAM roles. Do not use an Owner/Editor service account for runtime functions.
- Rotate any credential that was committed, pasted into chat, exposed in a screenshot or sent to a client. Removing it from the latest commit is not enough; assume compromise.
- Use `.env.local` only for local development and ensure `.env*` is ignored except `.env.example`. Never put real values in examples.
- Validate required environment variables at startup and fail with a safe error that does not print their values.
- Do not store secrets in Firestore or local seed files.

### Firebase configuration nuance

Firebase web configuration values such as project ID, app ID and the Firebase web API key are normally public client configuration, not Admin credentials. Their visibility is expected. A Firebase API key does not replace security: configure restrictions where supported, use Authentication, Firestore/Storage Security Rules, App Check and backend authorization. The Firebase Admin service-account private key is a secret and must never enter the client.

### Browser DevTools and network logs

Do not put secrets or credentials in URLs, query strings, page HTML, source maps, browser logs, analytics or ordinary network request payloads. Use HTTPS everywhere. Never transmit an AI key, Admin key, payment secret or SFU signing key to the client.

Be technically honest: a web/mobile client must possess or present its own authenticated session material to call Firebase or a backend. A user may be able to inspect their own Firebase ID token or session traffic in their device's developer tools. Do not promise that all user session tokens can be hidden from the device owner. Instead, use scoped short-lived tokens where applicable, strict server authorization, session revocation, App Check, HTTPS and least-privilege Security Rules. The critical rule is that inspection must never reveal a reusable privileged secret or another user's data.

Do not log `Authorization`, cookies, Firebase ID tokens, refresh tokens, App Check tokens, payment payloads containing sensitive data, signed URLs or SFU tokens. Redact them at the logging boundary.

## 3. Authentication and server-side authorization

### Authentication

- Use Firebase Authentication; never implement password storage yourself.
- For custom backend endpoints, verify the Firebase ID token using the Firebase Admin SDK before reading or mutating user data.
- Validate token signature, issuer, audience/project, expiry and expected auth context. For high-risk actions, check revocation and require recent reauthentication where appropriate.
- Do not accept `uid`, email, role or claims supplied separately in the JSON body as proof of identity. Derive the actor UID from the verified token.
- Configure authorized domains, redirect URIs and OAuth providers correctly. Use email verification or additional abuse checks where the risk warrants them.
- Use secure session cookies for server-rendered web sessions when the chosen architecture requires them: `HttpOnly`, `Secure`, appropriate `SameSite`, bounded lifetime and CSRF protection. For mobile, use platform-appropriate secure token persistence; do not log tokens.

### Authorization

Every sensitive operation must answer all of these questions on the server:

- Who is the verified actor?
- Is the account active and allowed to use this feature?
- Does the actor own the resource or have the required role?
- Is the actor a current member of this exact room/session?
- Is the session in a state that permits this action?
- Is the field/operation allowed for this role?
- Is the request within rate, size, quota and policy limits?

Use a deny-by-default authorization service/policy function with explicit permissions. Check every resource identifier from the request; never rely on a page-level check alone. Return a safe 403/404 without leaking private resource existence.

Roles such as `user`, `moderator`, `admin` and `content_manager` are assigned only by trusted staff/admin operations. A user must never be able to update their own role, custom claims, account status or privileges. Revalidate sensitive roles server-side; client custom claims may be stale until token refresh.

### Firebase Firestore access controls: Security Rules instead of SQL RLS

This platform uses Firestore, not Supabase/Postgres. Firestore therefore does not use SQL Row Level Security policies. Its equivalent client data boundary is **Firestore Security Rules**, which authorize access to documents and paths. Use Storage Security Rules for uploaded files.

- Begin with a global deny rule; grant access collection-by-collection and subcollection-by-subcollection.
- Rules must validate authentication, ownership, membership, allowed fields, field types, sizes and permitted state changes.
- Do not allow clients to write `role`, `status`, `hostUid`, participant counts, evaluation scores, payment entitlements, audit data or moderation outcomes.
- Avoid broad patterns such as `allow read, write: if request.auth != null` for user or room content.
- Security Rules are not filters: design queries so every possible returned document satisfies the rule. Test both allowed and denied query patterns.
- A Firestore Admin SDK/server client bypasses Firestore Security Rules. Backend authorization and Google Cloud IAM are mandatory on every server route/function using it.
- Protect every nested subcollection; a parent document rule does not automatically make the child data safe.
- Keep rules in version control and deploy them through the release process, not ad hoc console edits.
- Use the Firebase Local Emulator Suite and automated rule tests in CI.

## 4. API, validation and injection prevention

### Request validation

- Define typed request and response schemas (Zod or equivalent) for every endpoint/function.
- Parse input on the server; do not trust TypeScript types as runtime validation.
- Allowlist fields. Reject unknown fields for sensitive mutations to prevent mass assignment.
- Validate IDs and references; check that referenced resources exist and belong to the correct parent/session.
- Set strict maximums for message body, bio, search query, arrays, nested objects, page size, file metadata and request size.
- Use server timestamps and canonical state, not client clocks or client-submitted `createdAt` values.
- Use idempotency keys for retryable creates and external operations.
- Return stable error codes; never return stack traces, secrets or raw database errors.

### Injection prevention checklist

- **NoSQL/Firestore query injection:** never construct collection paths, filter fields, operators or raw query expressions from arbitrary user input. Map user filters through explicit allowlists.
- **SQL injection:** if a future service uses SQL, parameterize every query. Never concatenate untrusted values into SQL.
- **XSS/stored XSS:** render text as text; sanitize Markdown using a strict allowlist; do not enable raw HTML. Escape syntax-highlighted code and URLs. Use a restrictive Content Security Policy.
- **HTML/template injection:** do not compile user content as templates or evaluate it as code.
- **Command/code injection:** never execute user-submitted code, shell strings, scripts or arbitrary build commands on application servers.
- **Path traversal:** generate storage object paths server-side; normalize and validate file names; never trust `../`-containing user paths.
- **SSRF:** do not let users supply arbitrary URLs for backend fetching. If URL fetch is a future feature, allowlist hosts/schemes, block private/link-local/metadata IP ranges, re-resolve redirects and enforce egress controls.
- **Open redirects/CSRF/IDOR:** allowlist redirect destinations, apply CSRF protections to cookie-authenticated endpoints, and authorize every resource ID independently.
- **Prototype pollution/mass assignment:** validate into explicit DTOs and copy only allowed fields into domain updates.

### Markdown and code snippets

Discussion content may contain Markdown or code fences, but it is user content. Disable raw HTML, dangerous URL schemes and unsafe embedded media. Apply length limits and escape all output. Do not execute code snippets. Syntax highlighting must use a maintained library and safe rendering mode.

## 5. Prompt injection and AI safety guardrails

Treat user messages, uploaded documents, source code, scenario text, tool results and peer content as **untrusted data**, even when they contain instructions such as “ignore all previous rules”.

- Keep system/developer instructions separate from user-provided transcript content. Clearly delimit and label transcript data as untrusted evidence.
- Do not provide the model with Firebase credentials, provider secrets, internal staff prompts, private records unrelated to the evaluated user, or unrestricted tools.
- The MVP evaluator should have no tools capable of sending messages, changing roles, deleting records, granting access, charging payments or taking external actions.
- The model may recommend a report; only deterministic backend code can validate and persist the permitted output.
- Enforce a strict structured output schema, enum allowlists, length limits and numeric ranges. Reject or safely repair invalid output; never persist arbitrary model text as privileged data.
- Verify every cited message ID belongs to the same session and every excerpt matches the stored message. Unknown IDs, invented quotes or cross-user evidence fail validation.
- Use the minimum transcript and profile context required. Do not send email, exact identity, college/employer or unrelated private data unless a reviewed feature requires it.
- Keep AI evaluation private by default and clearly disclose that it is AI-generated and fallible.
- Use fixed versioned rubrics and prompts. Do not let scenario/user content override the rubric or safety instructions.
- Add adversarial tests: direct prompt injection, fake system instructions in messages, data-exfiltration requests, malicious code snippets, requests for other users' data, malformed JSON, schema overflows and tool-use bait.
- Rate-limit AI calls, cap tokens/context, set timeouts, use bounded retries and enforce per-user/project spending alerts.
- If the provider is unavailable or unsafe, mark the evaluation retryable/failed; never invent feedback to keep the UI populated.

## 6. Rate limiting, abuse and resource quotas

App Check reduces requests from unauthorized app instances but does not stop a legitimate user from abusing the product. Combine controls:

- Per-user rate limits for message posting, session creation/join, reports, search, AI evaluation, file upload, token minting and account recovery.
- Per-IP/device/network anomaly limits for signup, login and high-risk endpoints; avoid relying on IP alone for shared networks.
- Per-session limits for message frequency, body size, participant count, join attempts and concurrent actions.
- CAPTCHA or step-up verification for suspicious signup/recovery/reporting bursts where appropriate.
- Cooldowns, progressive backoff, duplicate detection, spam detection and block/report tools.
- Global quotas and spend limits for AI, storage, egress, functions, notifications and future SFU minutes/bandwidth.
- Return HTTP 429 or a callable `resource-exhausted` error with a retry hint. Do not reveal internal thresholds.
- Keep rate-limit counters server-only. Avoid a single global hot Firestore document; use per-user/per-key buckets with bounded TTL or a managed rate-limit store if traffic justifies it.
- Alert on sudden signup spikes, repeated denied access, high message velocity, token minting spikes, storage growth and AI spend anomalies.

## 7. Package and supply-chain security

- Commit one package-manager lockfile and use frozen/immutable installs in CI.
- Enable GitHub Dependabot or Renovate alerts/PRs and an SCA scanner such as OSV or npm audit in CI.
- Scan direct and transitive dependencies; review package health, maintainer activity, release history, license and install scripts before adoption.
- Prefer maintained, widely used packages for authentication, crypto, parsing, sanitization and upload scanning. Do not write custom cryptography.
- Pin supported Node.js and framework runtime versions and take security patch releases promptly.
- Do not blindly upgrade major versions in production. Review changelogs and run regression/security tests.
- Generate an SBOM for production releases where feasible. Protect CI credentials and restrict deployment permissions.
- Remove unused packages and permissions. Do not use abandoned or copied packages for critical security boundaries.

## 8. Secure file upload and download protocol (future feature)

File upload is not required for the MVP unless a specific user flow depends on it. When introduced:

1. Authenticate the user and verify permission to attach the file to the target session/resource.
2. Generate the storage object ID/path on the server. Never use the raw client filename as the object path.
3. Allowlist file types and extensions. Enforce maximum bytes both in Storage Rules and server-side code.
4. Verify actual file signatures/magic bytes; do not trust extension or `Content-Type` alone.
5. Reject executable files, scripts, HTML, SVG with active content, archives with uncontrolled expansion and unexpected formats unless there is a reviewed use case.
6. Upload into a private quarantine path. Do not make the file readable by other participants yet.
7. Scan for malware using a maintained scanner in an isolated service. Apply decompression limits and timeouts if archive support is explicitly approved.
8. Mark the file `approved` only after validation/scanning. If scan is unavailable, keep it quarantined (fail closed).
9. Serve files through authorized Firebase Storage rules or short-lived signed URLs minted after a fresh permission check. Do not create permanent public URLs for private session attachments.
10. Set safe download headers and preferably force download for untrusted document formats. Never render HTML/SVG uploads in the app origin.
11. Audit upload, scan, download, delete and rejection events. Apply retention and deletion policy.

Storage Rules should validate authenticated owner/path, permitted resource state, file size and declared content type. A server-side scanner must validate the bytes; Storage Rules alone are not antivirus.

## 9. Future WebRTC/SFU media security

Voice/video is out of MVP. Do not build a custom SFU. When adding media, evaluate a managed SFU such as LiveKit Cloud and implement these controls before pilot:

### Authentication and room authorization

- Client first authenticates with Firebase Authentication.
- Client requests a media token from a trusted backend over HTTPS.
- Backend verifies Firebase ID token, App Check, current room membership, session status, participant role, device/session state and account restrictions.
- Backend mints a short-lived SFU JWT with a random/opaque identity, exact room name, minimal publish/subscribe/data grants, `nbf`/expiry and no admin permissions unless explicitly required.
- Never include SFU API secret or signing key in browser/mobile code, app config or Firestore.
- Bind the token to one participant identity and one room. Do not allow clients to select arbitrary room names, identities or grants.
- Revoke/rotate access on removal, ban, role change or session end where supported. For self-hosted systems, use short TTLs and deny token reissue after removal.
- Do not store room tokens in logs, analytics, URLs or persistent Firestore records. Treat issued tokens as bearer credentials that may be visible in client network inspection.

### Media transport and signaling

- Use TLS for HTTPS and secure WebSocket signaling.
- Require WebRTC DTLS-SRTP media encryption; use authenticated TURN/TLS paths where required by the SFU/network design.
- Use the SFU's supported secure room configuration and regularly patch client/server SDKs.
- Do not expose participant lists, metadata or recording controls beyond the current room's authorization scope.
- Record or transcribe only with explicit product disclosure and legally reviewed consent. Make recording state visible. Keep recording storage private.

### Room token hijacking and replay

- Keep token lifetime short enough for the product's connection/reconnect needs.
- Do not put tokens in query strings or shareable URLs.
- Use per-user/per-room token mint rate limits and idempotent connection policies.
- Check membership and ban status on every token issuance; deny issuance to removed/blocked users.
- Configure the SFU to reject unexpected identity/room combinations and apply provider revocation features where available.
- Treat tokens as secrets even if a connected user can inspect their own token; never grant more authority than needed.

### Bandwidth and cost abuse

- Enforce room capacity, max track count, allowed codecs/resolutions, publish permissions, bitrate/profile ceilings and session duration limits at the SFU/backend.
- Limit who can publish video/audio and disable unused data channels/features.
- Rate-limit token issuance, reconnect loops and room creation.
- Monitor per-room participant minutes, egress bandwidth, packet loss, disconnects, bitrate and abnormal usage.
- Apply budget alerts and automatic safe limits. Client-side UI limits are not enforcement.

### Media fallback

If SFU authentication, signaling or media security cannot be verified, deny the connection. If the SFU is unavailable, offer retry or return to the text discussion. Never downgrade to insecure plaintext media.

## 10. Payments and webhook verification (future feature)

No payment processing is assumed in the MVP. When monetization is approved:

- Use a reputable payment provider and hosted/tokenized payment components; do not collect or store full card details, CVV or raw payment credentials.
- Keep payment secret keys and webhook signing secrets in Secret Manager; use separate sandbox and production credentials.
- Verify webhook signatures using the provider's official library and the exact raw request body before parsing/mutating state. Do not verify against reserialized JSON.
- Validate signature timestamp/tolerance where the provider supports it; reject stale or malformed signatures.
- Persist provider event ID and processing status; enforce idempotency and replay protection. Duplicate delivery must not double-charge, double-credit or duplicate entitlement changes.
- Treat the browser success redirect as informational only. Confirm payment state server-to-server from a verified webhook or provider API.
- Calculate prices, currency, tax/discount rules and entitlements on the server. Never trust client-submitted price, plan, amount or `isPaid` flags.
- Verify refunds, disputes, cancellations and subscription renewals through signed events and reconciled provider state.
- Audit entitlement changes and keep customer records access-restricted.
- Complete provider, legal, tax, privacy and PCI-scope review before enabling real payments.

## 11. Audit logging and interaction trails

### What to record

Record security-relevant events such as sign-in anomalies, role changes, account suspensions, session state changes, membership changes, moderation actions, AI evaluation lifecycle, payment verification, upload scan outcomes, token issuance/revocation and administrative data access where required.

Each audit event should include:

- Unique event ID and server timestamp.
- Actor UID/service identity and actor role at action time.
- Action and target resource type/ID.
- Outcome (allowed/denied/succeeded/failed) and safe reason code.
- Request/correlation ID and relevant environment.
- Minimal metadata needed for investigation.

### Integrity rules

- Audit events are written by trusted backend code only. Clients cannot create, edit or delete audit records.
- Keep application interaction events append-only. Corrections create a new compensating event; do not rewrite history silently.
- Do not duplicate full message bodies, private evaluation text or secrets into audit logs. Use resource IDs, event metadata and content hashes only where useful and privacy-reviewed.
- Restrict audit reads to authorized operators; alert on audit pipeline failure or unusual admin access.
- A Firestore collection that denies client updates is **not by itself cryptographically immutable** against privileged project administrators. For stronger tamper resistance, export security audit logs to a separately permissioned Cloud Logging bucket or Cloud Storage bucket with retention lock where supported, and restrict administrative IAM. State the actual guarantee accurately.
- Define retention and deletion schedules. Preserve only the minimum data needed for security, fraud or legal requirements, and disclose retention clearly.

## 12. Privacy and user-data handling

- Publish a clear privacy notice explaining data collected, purpose, AI processing, visibility, retention, deletion and service providers.
- Keep private profile details, learning reports, evidence and moderation information private by default.
- Share public profile fields only with user opt-in. Never expose email addresses in room participants or public profile APIs.
- Do not use private reports for hiring, employability claims or public ranking.
- Minimize PII sent to LLMs, analytics, logs and external services. Use pseudonymous identifiers where possible.
- Obtain consent/notice for voice, video, transcription, recording and any future analytics that require it.
- Provide account export/deletion workflows and define how user content, evidence, reports, backups and audit records are handled.
- Do not log raw transcripts by default. Restrict staff access and audit support access.
- Select data regions and vendors after reviewing relevant India and other launch-market privacy requirements with qualified counsel. This document is engineering guidance, not legal advice.

## 13. Production hardening

Before public launch, implement and verify:

- HTTPS/TLS only; enable HSTS after HTTPS is confirmed across all relevant domains.
- Secure headers including a tested Content Security Policy, `frame-ancestors`/clickjacking protection, `X-Content-Type-Options: nosniff` and appropriate referrer policy.
- Exact allowed origins and redirect URIs; never wildcard credentialed CORS.
- CSRF controls for cookie-authenticated state-changing endpoints.
- Secure, HttpOnly, SameSite cookies when using custom web session cookies; token handling appropriate to native apps.
- No detailed stack traces, debug endpoints, source maps with secrets, test credentials or verbose admin routes in production.
- Firebase App Check configured and enforced after monitoring legitimate traffic for supported services/endpoints.
- Firestore and Storage rules tested; no test-mode or allow-all rules.
- Cloud Functions/Run service accounts with least-privilege IAM, bounded concurrency/instances/timeouts and budget alerts.
- Dependency/security scanning, secret scanning, lockfile enforcement and patch process.
- Backup/restore drill, deployment rollback/forward-fix plan, incident contacts and credential-rotation procedure.
- Production smoke tests and security regression tests after each release.

## 14. Load balancing, scaling and availability

- Use managed App Hosting/Cloud Run/Functions scaling rather than manual single-server assumptions.
- Set max instances, concurrency, timeouts and memory/CPU based on load tests and budget. Autoscaling is not a substitute for rate limits or cost controls.
- Keep functions stateless. Store durable state in Firestore or the selected managed store, not process memory.
- Use pagination, query limits and indexes; avoid unbounded reads/listeners.
- Avoid Firestore hotspots and high contention on one document. Use partitioned counters/aggregates where needed.
- Use queue-based processing for expensive AI and notifications. Bound retries and ensure idempotency.
- Cache only public, non-sensitive, versioned catalogue data. Do not cache private reports or room content in shared caches.
- Add load tests for room joins, message bursts, listener fan-out and evaluation worker load before increasing cohort size.
- Monitor latency, error rate, saturation, Firestore reads/writes, function invocations, egress, AI cost and queue age.

## 15. Fail-safe degradation matrix

| Failure | Required behaviour | Forbidden fallback |
|---|---|---|
| Firebase Auth unavailable/invalid token | Deny protected access; preserve public marketing pages | Anonymous access to private room data |
| Authorization service uncertain | Deny sensitive operation and log safe reason | Trust client role or cached permission indefinitely |
| Firestore unavailable | Disable authoritative writes; show retry state | Pretend message/session state was saved |
| Realtime listener outage | Re-fetch/poll authorized state | Open a public channel or expose broader data |
| AI provider outage/malformed output | Keep session complete; mark evaluation pending/failed and retry boundedly | Fabricate score/report |
| Rate-limit store failure | Apply conservative local/global fallback limits or fail closed for high-cost endpoints | Unlimited AI/upload/token requests |
| File scanner unavailable | Keep upload quarantined | Serve unscanned file |
| Payment signature/provider verification failure | Do not change entitlement; retry/reconcile | Trust client redirect or unsigned webhook |
| SFU/media outage | Stop media, allow retry or return to text | Downgrade to insecure media or issue permissive token |
| Audit pipeline outage | Alert; block high-risk admin operations if audit is mandatory | Silently perform privileged changes without trace |

## 16. Security testing requirements

Every feature PR/release must include relevant positive and negative tests:

- Unauthenticated, wrong-user, non-member, removed-member and expired-session access.
- Role escalation and mass assignment attempts.
- Firestore/Storage Security Rules tests in Firebase Emulator Suite.
- Backend authorization tests for Admin SDK paths because Rules are bypassed.
- IDOR, malformed IDs, oversized input, unknown fields and invalid state transitions.
- XSS/Markdown payloads, NoSQL filter/path injection, SSRF and open redirect tests where applicable.
- Prompt injection and hallucinated evidence tests for AI features.
- Rate-limit, duplicate/idempotency, retry and concurrency tests.
- Signature-failure, stale/replayed webhook tests before payments.
- Invalid/expired/wrong-room/over-privileged SFU token tests before media.
- Dependency and secret scan checks in CI.

## 17. Security incident response

Maintain a short runbook with owners and tested steps to:

1. Disable the affected feature or endpoint with a server-side kill switch.
2. Revoke affected Firebase sessions/refresh tokens and remove compromised roles.
3. Rotate exposed secrets and revoke old keys/tokens.
4. Restrict or disable suspicious uploads, AI calls, payments or media rooms.
5. Preserve relevant audit evidence while limiting additional PII exposure.
6. Identify scope and affected users from logs without copying full private content.
7. Restore from verified backups or deploy a reviewed fix.
8. Notify affected users/regulators when required by applicable law and policy.
9. Document root cause, timeline, impact, remediation and prevention.

## 18. Security acceptance gate

A milestone is not complete if any of these is missing:

- Reviewed Firestore and Storage Security Rules for all data paths introduced.
- Server-side authorization tests for every Admin SDK operation.
- Secret scan and dependency scan pass.
- No secret appears in frontend bundles, source maps, URLs, logs or telemetry.
- Rate limits and input size limits exist for exposed endpoints.
- Failure paths do not bypass authorization or invent success.
- Security/ privacy impact of new data collection is documented.
- `SECURITY_PRIVACY.md`, API docs and this protocol are updated when behaviour changes.

## 19. Official implementation references

Always verify the current official documentation before implementation:

- Firebase security checklist: https://firebase.google.com/support/guides/security-checklist
- Firestore Security Rules: https://firebase.google.com/docs/firestore/security/get-started
- Firestore secure queries: https://firebase.google.com/docs/firestore/security/rules-query
- Firestore field-level rules: https://firebase.google.com/docs/firestore/security/rules-fields
- Verify Firebase ID tokens: https://firebase.google.com/docs/auth/admin/verify-id-tokens
- Firebase session revocation: https://firebase.google.com/docs/auth/admin/manage-sessions
- Firebase App Check: https://firebase.google.com/docs/app-check
- Cloud Functions secrets: https://firebase.google.com/docs/functions/config-env
- Cloud Functions scaling: https://firebase.google.com/docs/functions/manage-functions
- Firestore best practices: https://firebase.google.com/docs/firestore/best-practices
- Storage Security Rules: https://firebase.google.com/docs/storage/security
- Expo + Firebase: https://docs.expo.dev/guides/using-firebase/
- LiveKit token grants (future): https://docs.livekit.io/home/server/generating-tokens
