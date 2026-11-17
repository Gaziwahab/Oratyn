# Firestore Data Model

**Status:** Logical Firestore document model for the MVP. The exact fields and indexes must be validated against actual UI queries and Security Rules before implementation. This is not a SQL schema.

## 1. Firestore design rules

- Use Cloud Firestore as the primary application database.
- Store timestamps in UTC using server timestamps for authoritative events.
- Use Firestore-generated or random IDs; avoid sequential IDs in high-write collections.
- Keep growing message/event histories in subcollections, not unbounded arrays.
- Prefer explicit collection paths and typed repository functions. Never build collection paths from arbitrary client strings.
- Denormalize display snapshots only when the read benefit is clear; define which backend operation updates each snapshot.
- Do not store passwords, provider keys, service account files, payment secrets or SFU signing secrets in Firestore.
- Keep private and public profile data separate.
- Firestore Security Rules are document/path based, not SQL RLS. Every collection and subcollection requires deliberate rules and emulator tests.

## 2. Recommended collection map

```text
users/{uid}                                  # private account/profile fields
publicProfiles/{uid}                         # opt-in community-safe profile fields
userPreferences/{uid}
userBlocks/{uid}/blockedUsers/{blockedUid}

domains/{domainId}
topics/{topicId}
competencies/{competencyId}
scenarios/{scenarioId}
rubrics/{rubricId}

sessions/{sessionId}
  participants/{uid}
  messages/{messageId}
  events/{eventId}
  artifacts/{artifactId}                     # future, validated attachments

users/{uid}/evaluations/{evaluationId}       # private report summary
users/{uid}/evaluations/{evaluationId}/dimensions/{dimensionId}
users/{uid}/evaluations/{evaluationId}/evidence/{evidenceId}
users/{uid}/competencyObservations/{observationId}
users/{uid}/recommendations/{recommendationId}

evaluationJobs/{jobId}                      # server-only operational queue state
userReports/{reportId}                       # moderator-restricted case records
moderationActions/{actionId}                 # restricted append-only action records
roles/{uid}                                  # server/admin only
idempotency/{scopedKey}                      # server-only short retention
rateLimitBuckets/{bucketId}                  # server-only short retention
billingCustomers/{uid}                       # future, server-only
billingEvents/{eventId}                      # future, server-only idempotency
webhookEvents/{providerEventId}               # future, server-only

auditEvents/{eventId}                        # server-only append-only audit records
```

## 3. Core documents

### `users/{uid}` — private user record

- `displayName`: bounded string.
- `experienceBand`: enum such as `student`, `beginner`, `junior`, `intermediate`, `advanced`, `prefer_not_to_say`.
- `onboardingCompletedAt`: timestamp or null.
- `accountStatus`: server-controlled enum (`active`, `restricted`, `suspended`, `pending_deletion`).
- `createdAt`, `updatedAt`: timestamps.

Do not put private email/auth provider data here unless needed. Firebase Authentication remains the identity source.

### `publicProfiles/{uid}` — opt-in community identity

- `displayName`, optional short `bio`, selected technologies/interests, `visibility` (`private` or `community`), `updatedAt`.
- Never mirror email, private goals, reports, moderation history or account recovery data here.
- Only publish fields explicitly chosen for community display.

### `userPreferences/{uid}`

- Learning goals, preferred language, notification preferences and selected interests.
- Owner-readable; validated writes through an authenticated user operation.

### Catalogue documents

`domains`, `topics`, `competencies`, `scenarios` and `rubrics` contain curated learning content. Include a stable slug, title, description, difficulty, learning objectives, prerequisites, publication state, version, and timestamps as relevant. Writes are admin/content-manager only. Published content may be read by signed-in users.

`scenarios/{scenarioId}` should contain bounded context, prompt, constraints, expected discussion phases, competency references, estimated duration and participation mode. Keep rubric content/version immutable once used in an evaluation; create a new version rather than silently editing historical criteria.

### `sessions/{sessionId}`

- `scenarioId`, `title`, `hostUid`.
- `status`: `draft`, `open`, `scheduled`, `active`, `paused`, `completed`, `cancelled`.
- `participationMode`: `scheduled` or `async`.
- `startsAt`, `closesAt`, `completedAt`.
- `capacity`: integer 2–6 for MVP.
- `currentPhase`, `phaseVersion`, `participantCount` (server-maintained only if needed).
- `createdAt`, `updatedAt`.

Do not allow clients to directly edit `status`, `hostUid`, `capacity`, `participantCount`, `currentPhase` or `phaseVersion`.

### `sessions/{sessionId}/participants/{uid}`

- `uid`, `role` (`participant`, `host`, `moderator`), `status` (`joined`, `left`, `removed`), `joinedAt`, `leftAt`.
- A participant cannot grant themselves a host/moderator role. Membership changes go through trusted functions.

### `sessions/{sessionId}/messages/{messageId}`

- `senderUid`, `body`, `messageType` (`text`, `code`, `system`), `phase`, `replyToMessageId` nullable.
- `clientMessageId` for idempotency, `createdAt`, `editedAt`, `deletedAt`.
- `body` must have a strict size limit. Store only safe structured metadata; never render arbitrary HTML.
- For a user-visible edit/delete, preserve a minimal event record and follow the retention/redaction policy. Do not create an immutable copy of every private message without a documented need.

### `sessions/{sessionId}/events/{eventId}`

Append-only server-created interaction trail for important room actions: phase transition, join/leave, message create/edit/delete reference, host action, participant removal, evaluation started/completed. Include `actorUid` where known, event type, target IDs, server timestamp, request/correlation ID, and minimal metadata. Do not duplicate full message bodies or unnecessary personal data.

### Evaluations and competency observations

Store evaluation reports under the evaluated user's namespace so the access boundary is clear. Each evaluation records `sessionId`, `scenarioId`, `rubricVersion`, `promptVersion`, provider/model identifier, status, confidence and completion time. Dimensions and evidence are separate bounded records. Evidence must reference real message IDs in the same session and store only short verified excerpts.

`competencyObservations` represent one evidence observation, not permanent truth about a user's ability. `recommendations` must include a rationale and source evidence IDs. One session cannot establish mastery.

## 4. Moderation and staff data

`userReports`, `moderationActions`, and `roles` are inaccessible to ordinary clients except narrowly permitted reporter status fields if explicitly designed. Moderation reads/writes go through staff-authorized server endpoints. Record who performed an action, target, reason, timestamp and case reference. Never allow clients to write their own role or moderation outcome.

## 5. Future payments and media

- `billingCustomers` maps a Firebase UID to the provider's customer ID; server-only.
- `billingEvents`/`webhookEvents` record verified provider event IDs to make webhook handling idempotent. Never store card numbers, CVV, raw payment credentials or payment provider secrets.
- Do not persist SFU access tokens in Firestore. Generate short-lived tokens on demand from the trusted server. Store only the minimal session/media state required.

## 6. Indexes and queries

Define the MVP queries before adding indexes. Likely indexes include:

- Published topics by domain/difficulty/order.
- Open/scheduled sessions by status, scenario, start time and participation mode.
- User's joined sessions by membership status and join time (may use a server-maintained user-session index if required).
- Messages by `createdAt` with pagination inside a session.
- Evaluation reports by owner and creation time.
- Moderator reports by status and creation time.

Maintain `firestore.indexes.json` in version control. Do not create unbounded collection reads. Keep query limits and pagination mandatory for messages and administrative lists.

## 7. Access policy summary

| Data | Default client access | Write path |
|---|---|---|
| Private user profile | Owner only | Owner-validated function or narrow owner rule |
| Public profile | Only if user opted into community visibility | Owner-validated function |
| Published catalogue | Signed-in users | Admin-only backend |
| Session summary | Authorized members; limited discovery fields for open sessions | Trusted functions |
| Participants | Session member-visible minimum fields | Trusted functions |
| Messages | Joined session members only | Trusted function |
| Session events | Restricted session visibility; no private operational metadata | Trusted function only |
| Evaluation and evidence | Evaluated user only | Trusted evaluation worker only |
| Reports/moderation/roles | Staff or narrowly permitted reporter status | Trusted staff functions only |
| Billing/webhooks/audit/rate limits | No ordinary client access | Trusted backend only |

## 8. Firestore-specific cautions

- Firestore Security Rules are not filters. Query constraints must guarantee that all returned documents are allowed.
- Server SDK/Admin SDK bypass Security Rules. Protect backend entry points and service-account IAM separately.
- Transactions can be retried; keep transaction callbacks deterministic and free of external side effects. Use idempotency records for external actions.
- Avoid a single document updated by every message/user. Firestore can experience contention/hotspots on high-write documents.
- Define data deletion, export and retention policy before public launch. Backups and immutable audit retention may have different deletion timelines; disclose this clearly.
