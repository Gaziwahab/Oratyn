# API and Trusted Function Contracts

**Status:** Logical MVP contract. The implementation may use HTTPS/callable Cloud Functions, Next.js Route Handlers or approved Firebase SDK reads. All sensitive mutations must authenticate, authorize, validate, rate-limit and apply idempotency where appropriate.

## 1. API principles

- Base version prefix: `/api/v1` for HTTP routes; callable function names may use equivalent stable versioned contracts.
- JSON request/response unless a specific upload protocol is documented.
- Derive caller identity from a verified Firebase ID token; never accept request-body `uid` as identity.
- Verify App Check for supported endpoints after staged rollout/enforcement.
- Use typed runtime schemas on the backend.
- Use server timestamps and canonical Firestore state.
- Use idempotency keys for retries such as join/message creation and future payments.
- Never return provider keys, Admin credentials, stack traces, private reports or another user's private data.

## 2. Read model

Where Firestore Security Rules permit, web/mobile clients may use SDK reads for:

- Published topics, domains and scenarios.
- Their own profile/preferences.
- Session summaries and participants for sessions they are authorized to view.
- Messages for sessions they have joined.
- Their own evaluation reports and progress.

Every query must include rule-compatible constraints and a hard limit/cursor. Firestore Security Rules are not filters. If the query's authorization cannot be guaranteed with rules, expose a server-side read function that checks the caller and returns a minimal projection.

## 3. Trusted operations

### Profile

- `getMyProfile` — return authenticated user's private profile and onboarding status.
- `updateMyProfile` — update only allowlisted fields.
- `updateMyPreferences` — update validated interests, goals and notification preferences.

### Catalogue (admin writes)

- `listTopics` / `getTopic` — published content only.
- `createTopic` / `updateTopic` — content-manager/admin only; create a new rubric version rather than mutating historical rubric versions.

### Sessions

- `createSession` — host-authorized; validate scenario, date and capacity.
- `joinSession` — idempotent; check account, session state, capacity, blocks and membership in a transaction.
- `leaveSession` — apply lifecycle rules.
- `startSession`, `pauseSession`, `resumeSession`, `advancePhase`, `completeSession` — host/moderator/admin only; validate state transitions.

### Discussion

- `sendMessage` — member-only, active-session/phase checks, strict body limit, safe Markdown subset, per-user/per-room rate limit and idempotency.
- `editMessage` — only sender/moderator under a defined edit policy; record an event.
- `deleteMessage` — soft-delete/redact under policy; record an event and preserve required evidence/retention constraints.
- `reportContent` — authenticated user; rate-limited and deduplicated.
- `blockUser` / `unblockUser` — owner-only.

### Evaluation and progress

- `requestEvaluation` — normally created automatically when session completes; idempotent.
- `getMyEvaluation` — owner only.
- `submitEvaluationFeedback` — owner only.
- `getMyProgress` — owner only.
- `dismissRecommendation` — owner only.

### Admin/moderation

- `listModerationReports`, `assignReport`, `resolveReport`, `applyModerationAction` — moderator/admin only; every privileged action produces an audit event.
- `grantRole`, `revokeRole`, `suspendAccount` — admin-only server operation; never client writes.

## 4. Response conventions

Success:

```json
{
  "data": { "id": "resource-id" },
  "meta": { "requestId": "request-id" }
}
```

Error:

```json
{
  "error": {
    "code": "SESSION_FULL",
    "message": "This session has reached its participant limit."
  },
  "meta": { "requestId": "request-id" }
}
```

Use appropriate status/error codes: 400 invalid input, 401 unauthenticated, 403 forbidden, 404 or concealed-resource response, 409 state conflict, 422 semantic validation failure, 429/rate-limit error, 500 unexpected error, 503 temporary dependency failure.

## 5. Idempotency and concurrency

- Client sends a random `clientMessageId` or idempotency key for create operations.
- Backend scopes the key by authenticated UID and operation.
- A repeated request returns the canonical prior result or a safe duplicate response.
- Capacity and phase changes use Firestore transactions and version/state checks.
- Transaction callbacks must not call external services or produce non-idempotent side effects; enqueue external work after durable state transition.

## 6. Realtime contract

Listeners carry only the minimum permitted data. Do not broadcast private report content, user email, moderation case details or secrets. Persist first; client listeners fetch data authorized by Firestore Rules. On reconnect, fetch authoritative state and messages with pagination.

## 7. Future integrations

- Payment webhook: verify signature against exact raw body, timestamp/replay window and provider event ID before changing entitlement.
- Media token: issue only after Firebase identity, App Check, membership and room state verification; token grants are minimal and short-lived.
- File upload: authorize target resource, generate path, enforce Storage Rules and quarantine/scan before release.

## 8. Contract maintenance

Update this document and tests whenever operation names, fields, error codes or permissions change. Keep Firestore reads and trusted server mutations clearly distinguished. See `SECURITY_PROTOCOL.md` for mandatory controls.
