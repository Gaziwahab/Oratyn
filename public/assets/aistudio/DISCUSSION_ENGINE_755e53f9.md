# Discussion Engine

## 1. Purpose

The discussion engine is the core product experience. It must create a fair, useful structure for participants to explain a position, ask questions, challenge assumptions, revise, and reflect—without making every room feel like an examination.

## 2. Room types

MVP supports a general structured text discussion using curated scenarios. Design the domain model so later room templates can include:

- **Design Room:** compare architecture or implementation approaches.
- **Debug Room:** diagnose a bug or production-like incident.
- **Code Review Room:** review a snippet for correctness, readability, security, and maintainability.
- **Debate Room:** defend or challenge a technical proposition with reasons.
- **Teach Room:** explain a topic and respond to learner questions.

Do not build every specialized template in the first release. Begin with one general session protocol and a small number of scenario templates.

## 3. Group size and roles

- MVP capacity: 2–6 participants, host included if host is contributing.
- Recommended group: 4–6.
- Roles: host, moderator, participant. A user may have host and moderator permissions through trusted assignment.
- All users in the room must be real participants or clearly identified system messages. Do not fabricate people or AI personas.

## 4. Session lifecycle

Recommended status transitions:

```text
draft → open → scheduled → active → paused → active → completed
                    └──────────────────────────────→ cancelled
open → active
```

Not every path is mandatory. Enforce a defined transition table in server logic. `completed` and `cancelled` are terminal for MVP. A completed session can be reopened only through an explicit audited admin recovery process.

## 5. Discussion phases

1. **Introduction** — Host explains the objective, norms, and timeline.
2. **Preparation** — Participants read the prompt and privately prepare an approach.
3. **Initial contributions** — Each participant submits an independent answer or proposed approach.
4. **Cross-questioning** — Participants ask clarifying, probing, or challenging questions.
5. **Open discussion** — Participants compare alternatives, respond, and improve ideas.
6. **Conclusion** — Participants summarize their position or learning.
7. **Evaluation pending / complete** — AI assessment runs after session completion.

For asynchronous sessions, phases can be open for a defined window rather than a timed live turn. The host may move phases forward when participation is sufficient or the window closes.

## 6. Fair turn-taking

- Show who is expected to contribute next, but allow host discretion.
- Participants can pass a turn without penalty.
- Turn order should rotate and avoid repeated first/last placement where practical.
- A participant should not be allowed to monopolize the initial contribution phase.
- Time limits are guidance, not a measure of answer quality. In async mode, use submission windows.
- Moderator can invite a quieter participant but must not pressure them to disclose personal reasons for passing.
- The system must not score message count or speaking duration as a proxy for skill.

## 7. Message model and rendering

- MVP accepts text with a safe Markdown subset and fenced code blocks.
- Persist author, message ID, session ID, phase, timestamp, and optional reply target.
- Sanitize rendered content to prevent script injection and unsafe embeds.
- Do not execute posted code, HTML, shell commands, or links automatically.
- Consider character limits and rate limits to prevent spam.
- Support edit/delete policy explicitly. If content is edited after evaluation, preserve enough history/versioning to keep report evidence interpretable.

## 8. Host controls

Host/moderator may:

- Start session.
- Pause and resume active session.
- Advance to next phase within allowed transitions.
- Close/cancel session with a reason.
- Remove a participant for safety or disruption, with audit logging.

Host must not be able to read a participant's private report merely because they hosted the room.

## 9. System events

Show system notices for important state changes: user joined/left, phase changed, session paused/resumed/completed, evaluation pending/ready. System messages must be visually distinct and not attributed to a human.

## 10. Completion conditions

A session may be completed by the host/moderator after the conclusion phase, or automatically when an async window expires under a documented rule. Do not auto-complete a session while a valid submission is being saved.

## 11. Failure and concurrency rules

- Use transactions or conditional updates to prevent simultaneous phase changes from producing invalid states.
- Use idempotency keys for message submission.
- The server is authoritative for participant membership, phase, status, and permissions.
- If a user reconnects, reload current session state and paginated messages.
- If realtime delivery is missed, ordinary fetching must restore the correct state.
