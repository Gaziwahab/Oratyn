# System Architecture

## 1. Architecture decision

Use a **modular monolith** with a Next.js web application and a trusted Firebase backend. Cloud Firestore is the primary data store. Firebase Authentication establishes identity. Cloud Functions for Firebase (2nd gen) enforce critical business operations. Add Cloud Run or other managed services only when a measured workload needs them.

This architecture is intentionally simple enough for an MVP but has clean seams for an Android app and later voice/SFU infrastructure.

## 2. Logical architecture

```text
Web browser (MVP)                         Android app (future)
Next.js + React + TypeScript               Expo + React Native + TypeScript
       │ Firebase Auth / allowed reads           │ Firebase Auth / allowed reads
       │                                          │
       ├──────────── HTTPS / callable API ────────┤
       │                                          │
       ▼                                          ▼
                Trusted backend boundary
       Cloud Functions for Firebase (2nd gen)
       ├── Authentication verification
       ├── App Check verification/enforcement
       ├── Authorization and role checks
       ├── Input schemas and rate limits
       ├── Feature services
       │   ├── Profiles and preferences
       │   ├── Topic/scenario catalogue
       │   ├── Sessions and membership
       │   ├── Discussion/messages
       │   ├── AI evaluation
       │   ├── Competency/recommendations
       │   ├── Moderation
       │   └── Payments/webhooks (future only)
       ├── Audit events
       └── Provider adapters
             ├── Gemini / alternate LLM
             └── LiveKit token service (future)
       │
       ├───────────────┬────────────────┬─────────────────┐
       ▼               ▼                ▼                 ▼
 Cloud Firestore   Cloud Storage   Cloud Tasks/Jobs   Cloud Logging
 + Security Rules  + Storage Rules (as needed)       + Monitoring
```

## 3. Trust boundaries

Treat all content and metadata received from a browser, mobile app, room participant, upload, external webhook or AI model as untrusted.

- Identity is established by a verified Firebase Authentication token/session, never by a client-supplied `userId`.
- App Check is an additional attestation signal, not proof that a request is authorized.
- Firestore Security Rules protect direct client reads and any intentionally permitted client writes.
- Admin SDK calls bypass Firestore Security Rules. Backend code must independently authorize every operation and run under a least-privilege service account.
- Role/ownership checks happen on the server for all sensitive mutations.
- A realtime listener or room token does not grant application-level permission to read unrelated records.
- AI output, Markdown, uploaded files, external URLs, and payment webhook payloads are untrusted until validated.

## 4. Read/write strategy

### Client reads

The client may read only the minimum documents permitted by Firestore Security Rules—for example, published catalogue entries, its own profile, authorized session summaries and messages for sessions it has joined. Queries must include the constraints required by the rules; rules are not post-query filters.

### Trusted writes

Route sensitive writes through Cloud Functions. At minimum this includes:

- Joining/leaving sessions and capacity checks.
- Changing session lifecycle or phase.
- Creating/editing/deleting messages and writing session events.
- Creating evaluation jobs and storing evaluation results.
- Changing roles, moderation actions and account restrictions.
- Minting future WebRTC/SFU access tokens.
- Verifying future payment webhooks and updating entitlements.

The backend performs input validation, identity verification, membership/role authorization, rate limiting, state checks and atomic writes where required. The client never writes authoritative role, status, score, payment or audit fields directly.

## 5. Core request flows

### Join a session

1. Client calls a trusted function with the session ID and an idempotency key.
2. Backend verifies Firebase ID token and App Check token where configured.
3. Backend reads user, session and membership state.
4. Backend checks account status, access rules, capacity, session state, block restrictions and rate limits.
5. Backend uses a Firestore transaction to create membership and update any required counters safely.
6. Function returns the canonical membership/session state. Clients refresh their authorized listeners.

### Send a message

1. Client sends session ID, client idempotency key, message type and bounded body.
2. Backend authenticates and authorizes the participant against current session membership and phase.
3. Backend validates length, permitted Markdown subset, content type, rate limits and block state.
4. Backend persists the message and append-only interaction event using a transaction/batch as appropriate.
5. Only after successful persistence does Firestore notify listeners.
6. Client reconciles its optimistic message with the canonical server ID. On reconnect it fetches from Firestore; events are not the sole record.

### Complete a session and evaluate

1. Authorized host/moderator completes the session through a validated state transition.
2. Backend persists completion and creates a pending evaluation job idempotently.
3. Worker loads only required scenario, rubric and transcript evidence.
4. Provider adapter calls the chosen model using bounded context, timeouts and output schema.
5. Backend validates response structure, rating ranges, message IDs and evidence excerpts against stored records.
6. Normalized report and competency observations are persisted; report remains private to the user.
7. If AI fails, the session remains completed and report status remains retryable/failed with a safe code.

## 6. Firestore modelling principles

- Use document IDs generated by Firestore or other non-sequential IDs; do not build high-write collections around monotonically increasing IDs.
- Keep documents small and bounded. Put growing messages/events in subcollections, not arrays on a session document.
- Denormalize only for known read patterns and update duplicated summaries through trusted code.
- Use subcollections for per-session membership, messages and events where it improves access boundaries and pagination.
- Add composite indexes from real query requirements and keep `firestore.indexes.json` in version control.
- Avoid a single global counter or one hot document for all traffic. Partition/shard aggregates if measurement shows contention.
- Use Firestore transactions for invariants such as capacity and idempotency; keep them short and retry-safe.
- Do not rely on client clocks for authoritative timestamps; use server timestamps.

## 7. Realtime behaviour

- Firestore is the source of truth; listeners are a delivery mechanism.
- Persist before notifying.
- Paginate messages; do not load an entire room transcript on every refresh.
- Reconnect by fetching canonical session state and the latest page of messages.
- Show connection status and a safe retry state.
- If realtime listeners fail, degrade to refresh/polling. Never bypass authorization to keep the UI working.

## 8. AI isolation

- All model API calls are server-side through an interface such as `EvaluationProvider`.
- Prompt and rubric versions are recorded with every evaluation.
- Structured output is parsed, schema-validated and evidence-checked.
- Do not give the evaluation model credentials, unrestricted tools, direct database write access or authority to change user roles or session state.
- Handle timeouts, refusals, malformed responses, quotas and provider outages as normal states.

## 9. Background jobs and idempotency

Use a durable task/queue mechanism when work must survive a request timeout or be retried reliably. Every job needs a stable ID, bounded retries, retry/backoff policy, dead-letter or failure visibility, and idempotent processing. Never assume a serverless request can run forever after returning a response.

## 10. Failure behaviour

- Authorization uncertainty: deny the action.
- Firestore unavailable: disable writes that depend on authoritative state; do not accept an unpersisted message as sent.
- AI provider unavailable: complete session normally and queue/retry evaluation.
- Realtime unavailable: refresh/poll authoritative state.
- Storage scanning unavailable: keep the file quarantined and unavailable to other users.
- Payment verification unavailable: do not grant or revoke paid entitlements based on an unverified event.
- SFU unavailable in a future release: offer a clear reconnect/leave flow; do not fall back to an insecure media transport.

## 11. Scaling path

Use App Hosting/Cloud Run and Functions autoscaling with explicit maximum instances, concurrency, timeouts and budgets. Load test realistic room/message patterns. Watch Firestore hotspots, index fan-out, listener volume, function cold starts, AI spend and network bandwidth. Extract a worker or media service only after metrics identify a specific bottleneck.
