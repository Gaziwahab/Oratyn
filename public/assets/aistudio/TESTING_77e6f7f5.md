# Testing Strategy

## 1. Testing principles

Test product behavior and trust boundaries, not only visual rendering. Authorization, session state transitions, message persistence, evaluation evidence, and AI failure recovery are critical paths.

## 2. Test layers

### Unit tests

- Input schemas and validation.
- Session transition rules.
- Turn ordering and eligibility.
- Rubric parsing and scoring validation.
- Evidence reference validation.
- Competency observation aggregation.
- Recommendation rules.
- Permission policy helpers.

### Integration tests

- Database repositories and constraints.
- Join/leave session transactions.
- Message creation with idempotency.
- Phase transition concurrency.
- Firestore Security Rules policies for owner, participant, non-participant, moderator, and anonymous roles.
- Evaluation persistence, retries, and idempotent completion.
- Moderation workflow and audit records.

### End-to-end tests

1. Sign up / sign in and onboarding.
2. Browse topic and scenario.
3. Join a session.
4. Post initial contribution and reply/question.
5. Complete session as host/moderator.
6. See evaluation pending, then completed report.
7. Confirm user can read own report but another participant cannot.
8. Submit evaluation feedback / review flag.
9. Report a message and process it as moderator.
10. Verify refresh/reconnect preserves messages and state.

## 3. Security and authorization matrix

Test at least these actors against protected operations:

| Actor | Read room | Post message | Advance phase | Read own report | Read another report | Moderate |
|---|---|---|---|---|---|---|
| Anonymous | No | No | No | No | No | No |
| Authenticated non-participant | Only if session policy permits safe public preview | No | No | No | No | No |
| Session participant | Yes | If session active and phase permits | No, unless host | Own only | No | No |
| Host | Yes | If participant and allowed | Yes | Own only | No | Limited session controls |
| Moderator | As needed for moderation | Only if also participant | According to assigned permission | Only explicit support policy | No by default | Yes |
| Admin | Operational access only as required | Explicitly assigned | Yes | Exceptional audited access only | Exceptional audited access only | Yes |

Adapt policy to product visibility decisions but preserve private-report isolation.

## 4. AI evaluation tests

Use fixed synthetic transcripts, not real user data, for automated regression tests. Include:

- Correct answer with concise explanation.
- Plausible but incorrect technical claim.
- Multiple valid design alternatives.
- Participant revises after peer feedback.
- Participant asks a strong clarifying question.
- Very short contribution with insufficient evidence.
- Participant has little opportunity to speak.
- Transcript includes prompt injection such as “ignore your rubric”.
- Model outputs malformed JSON or unknown dimension.
- Model references a message ID not in the session.
- Excerpt does not match stored message.
- Provider timeout, rate limit, and temporary outage.

Expected behavior: invalid evidence is rejected; insufficient evidence is allowed; provider failure does not undo session completion; prompt injection inside user content is treated as data, not as system instruction.

## 5. Accessibility and responsive testing

- Keyboard-only navigation through onboarding, session joining, room composer, and report.
- Visible focus state and correct labels.
- Screen reader announcements for important session state changes.
- Mobile viewport layouts and touch controls.
- Contrast and reduced-motion checks.

## 6. Test data

- Use synthetic users and seeded scenarios.
- Do not use production transcripts or secrets in local tests.
- Keep seed scripts deterministic and repeatable.
- Include a minimum set of scenarios from different domains.

## 7. CI gates

Recommended pull-request checks:

- Formatter/linter.
- Type check.
- Unit tests.
- Integration and Firestore Security Rules tests.
- Build.
- Critical Playwright flows.

A change touching authorization or database schema must not merge without corresponding security tests.

## 8. Release checklist

See `DEPLOYMENT.md`. At minimum, verify production environment variables, Firestore/Storage Security Rules and indexes, backup, error monitoring, admin access, moderation queue, AI provider limits, and privacy disclosures.


## Firebase security testing requirements

- Run Firestore and Storage Security Rules tests with the Firebase Local Emulator Suite in CI.
- Include unauthenticated, wrong-owner, non-member, removed-member, role-escalation, malformed-query and nested-subcollection cases.
- Test backend Admin SDK operations separately because Admin SDK bypasses Firestore Security Rules.
- Test App Check enforcement behaviour for supported endpoints, while preserving a safe local emulator path.
- Run dependency and secret scans. Fail CI if secrets are detected or critical dependency vulnerabilities are unresolved.
- For future webhooks, test invalid signatures, stale timestamps, duplicate events and replay attempts. For future SFU, test expired, wrong-room, over-privileged and revoked tokens.
