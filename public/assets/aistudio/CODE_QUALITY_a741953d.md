# Code Quality and Maintainability Standard

**Purpose:** Keep the codebase simple, readable, testable and easy to extend as the web product grows into Android, AI practice rooms, voice sessions and other future capabilities.

This document is mandatory for human developers and AI coding agents.

## 1. Core principles

- **Keep it simple:** choose the smallest design that meets the documented requirement.
- **Readable beats clever:** code should be understandable to another developer without reverse engineering it.
- **Build for real requirements:** do not add abstractions, services, caches or dependencies for hypothetical scale.
- **Separate concerns:** UI, domain rules, persistence, integrations and authorization have different responsibilities.
- **Make change local:** a change to one feature should not require editing unrelated modules.
- **Prefer explicit over magical:** clear function names, types and data flow beat hidden side effects and clever framework tricks.
- **Use composition:** build behaviour from small functions and components instead of deep inheritance.
- **Design for failure:** external services can time out, return malformed data or become unavailable.
- **Test behaviour:** test outcomes and security boundaries, not private implementation details.

## 2. Recommended module boundaries

Use feature-oriented modules. The exact file placement may follow the AI Studio starter, but preserve the boundaries below.

```text
apps/web/src/
  app/                       # Next.js routes, layouts and route-level composition
  components/                # Reusable UI primitives only
  features/
    auth/
    profile/
    catalogue/
    sessions/
    discussions/
    evaluations/
    progress/
    moderation/
  lib/                       # Client-safe shared utilities

functions/src/
  features/
    profiles/
    catalogue/
    sessions/
    discussions/
    evaluations/
    moderation/
  shared/
    auth/
    authorization/
    validation/
    rate-limits/
    audit/
    errors/
  providers/
    ai/

packages/
  domain/                    # Pure types and business rules
  validation/                # Runtime schemas
  contracts/                 # API request/response contracts
```

### Dependency direction

- UI may depend on shared contracts and client-safe feature helpers.
- UI must not import Firebase Admin SDK, service-account code or server-only secrets.
- Domain rules should be pure TypeScript and should not depend on React or Firebase SDKs.
- Backend handlers depend on domain services, authorization, validation and repositories.
- Repositories depend on Firebase server SDKs and hide Firestore-specific document paths.
- External services (Gemini, payment provider, SFU, email) are accessed through small adapters.
- Avoid circular dependencies between features.

## 3. Function and component design

- A function should do one clear job and have an intentional input/output contract.
- Keep handlers thin: parse → authenticate → authorize → rate-limit → call service → map result.
- Put multi-step business rules in named domain/application services, not route handlers or React components.
- Keep React components focused on one UI responsibility. Move complex forms and state transitions into focused hooks or feature modules.
- Prefer controlled, typed data flow. Avoid hidden global mutable state.
- Use explicit result/error types for expected failures. Do not throw generic errors for normal validation or permission outcomes.
- Keep functions and files reasonably small; split by cohesive responsibility, not arbitrary line count.
- Comments should explain non-obvious reasoning, trade-offs or security assumptions—not restate the code.

## 4. TypeScript standards

- Enable `strict` mode and keep it enabled.
- Avoid `any`. Use `unknown` at trust boundaries and narrow it with runtime validation.
- Do not assume a TypeScript interface validates network data. Parse external input and model output at runtime.
- Use discriminated unions for states and result types where they improve correctness.
- Use enums/string unions for fixed values; avoid magic strings spread across the codebase.
- Keep API types, Firestore document types and UI view models distinct when their trust/shape differs.
- Do not expose server-only types or secrets through shared client packages.
- Avoid non-null assertions except when an invariant is documented and tested.

## 5. Firestore and data-access efficiency

- Keep Firestore paths and query logic inside repositories or typed data-access modules.
- Avoid direct ad hoc Firestore calls from many UI components.
- Always set query limits and paginate growing collections such as messages, reports and audit events.
- Add indexes for known query patterns and commit them to version control.
- Avoid loading entire transcripts or entire user collections into the browser.
- Keep frequently updated fields separate from large documents to reduce contention and unnecessary reads.
- Avoid global counters and single hot documents; aggregate or shard only when measured.
- Use transactions for invariants; keep transaction callbacks deterministic and free of external side effects.
- Do not duplicate the same source of truth in multiple documents unless a read model is justified and has a clear update owner.
- Use server timestamps for authoritative events.
- Unsubscribe Firestore listeners on component unmount and handle reconnect/error states.
- Cache only public, non-sensitive data unless a private caching design has been explicitly reviewed.

## 6. Security as code quality

- Every endpoint and trusted function follows the same order: verify identity, validate input, authorize resource/action, apply rate limits, execute the business operation, record the required audit event, return minimal output.
- No UI-only permission checks.
- No client-write shortcut for roles, payment status, evaluation scores, session state or audit events.
- Avoid generic “admin” bypasses in shared repositories; keep privileged methods explicit and narrowly used.
- Do not log raw request bodies by default. Redact credentials and private content.
- Never create raw HTML rendering escape hatches for user content.
- No user-supplied code execution.
- See `SECURITY_PROTOCOL.md` for the detailed security requirements.

## 7. Errors, retries and idempotency

- Use stable application error codes for expected conditions (forbidden, not found, conflict, validation, rate limit, dependency unavailable).
- Keep client-facing messages useful but do not disclose internal resource existence, database paths, secrets or stack traces.
- Retry only retryable operations and use bounded exponential backoff with jitter where appropriate.
- Never blindly retry a non-idempotent external action.
- Use idempotency keys for message creation, membership changes, AI jobs and future payment events.
- Keep user-facing operations recoverable after refresh/reconnect.
- Do not report success before durable persistence succeeds.

## 8. External integrations

- Hide vendor SDKs behind narrow adapters, for example `EvaluationProvider`, `PaymentProvider` and `MediaTokenProvider`.
- The domain layer should not depend on Gemini-specific response objects or LiveKit-specific token classes.
- Validate external provider responses before converting them into domain types.
- Add timeouts, quotas, bounded retries and safe fallback behaviour.
- Keep external API secrets in server-side Secret Manager bindings only.
- Mock providers in automated tests; do not make normal CI depend on live paid APIs.

## 9. UI quality and accessibility

- Use semantic HTML and accessible labels/roles.
- Keyboard interaction and visible focus must work.
- Include loading, empty, error, offline, permission-denied and success states.
- Prevent duplicate form submissions and show clear validation feedback.
- Keep visual tokens centralized; avoid one-off hardcoded styles everywhere.
- Make layouts responsive from the start, even though desktop may be the main MVP experience.
- Avoid adding a UI library for a single component unless there is a clear benefit.

## 10. Dependencies and upgrades

- Add a dependency only when it solves a real problem that cannot be handled cleanly with the current stack.
- Prefer mature, actively maintained libraries with a clear security and license posture.
- Check compatibility with Firebase, Next.js, Node.js and Expo before adding or upgrading dependencies.
- Commit one lockfile and use frozen installs in CI.
- Run lint, typecheck, unit tests, Firebase emulator tests and production build after upgrades.
- Review major-version migration guides; do not use automated force upgrades without review.
- Remove unused dependencies and dead code.

## 11. Code review checklist

Before marking a task complete, confirm:

- [ ] The implementation meets the documented acceptance criteria without unrequested feature creep.
- [ ] UI, domain, persistence and integrations are separated appropriately.
- [ ] Names and types make the data flow understandable.
- [ ] External input and provider output are runtime-validated.
- [ ] Server authorization and Firestore/Storage Rules are in place.
- [ ] Rate limits, idempotency and error states are implemented where relevant.
- [ ] Queries are bounded, paginated and index-supported.
- [ ] Sensitive data is not sent to logs, analytics or the browser unnecessarily.
- [ ] Tests cover success, failure and forbidden-access behaviour.
- [ ] No secrets, debug code or unnecessary dependencies were added.
- [ ] Documentation and decision log are updated when contracts or architecture change.

## 12. Definition of a maintainable change

A good change is not the one with the most abstractions or the fewest lines. It is the smallest complete implementation that is secure, testable, understandable and easy to modify without breaking unrelated features.
