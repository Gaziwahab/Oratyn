# Product Requirements Document (PRD)

**Status:** Baseline specification for MVP implementation. Product assumptions should be validated through a pilot.

## 1. Product objective

Help CS students and early-career developers improve engineering reasoning, technical explanation, questioning, and collaboration through structured written discussions and actionable feedback.

## 2. Problem statement

Users can learn syntax and complete isolated exercises but often lack safe, repeatable opportunities to explain decisions, defend trade-offs, ask and answer technical questions, and revise an approach after receiving criticism. The product provides these practice opportunities and makes progress visible through evidence rather than opaque reputation points.

## 3. Goals

- Make it easy to find a relevant engineering topic and join a small written session.
- Ensure each participant has a fair opportunity to contribute.
- Generate clear personal feedback after a discussion.
- Track demonstrated competencies over repeated sessions.
- Recommend a next practice activity that is neither too easy nor unreasonably difficult.
- Maintain safe, respectful, privacy-conscious community interactions.

## 4. Non-goals for MVP

- Full online course delivery, certificates, or a job-placement promise.
- Audio/video rooms or live coding execution.
- Multi-agent AI group discussions or full AI mentor marketplace.
- Automated participant matching or complex scheduling optimization.
- Public global leaderboards, follower counts, likes, or infinite feed.
- Employer hiring scores or claims that AI can certify expertise.
- Microservices, complex event streaming, or custom real-time infrastructure.

## 5. Personas

### P1 — Student learner

A CS student who knows classroom concepts but wants to explain and apply them in realistic technical conversations. Needs clear prompts, approachable peers, beginner-friendly language, and feedback without public embarrassment.

### P2 — Early-career developer

A beginner or junior developer seeking stronger debugging, code review, design reasoning, and technical communication. Needs realistic scenarios and more challenging peers.

### P3 — Session host / moderator

A trusted user or administrator who schedules and facilitates sessions, helps maintain fairness, and handles issues. In MVP this may be an internal moderator rather than a self-serve marketplace role.

## 6. Core experience requirements

### 6.1 Account and profile

- Users can register, sign in, sign out, and recover access through the configured auth provider.
- Users can set a display name, short bio (optional), experience band, learning goals, topics of interest, and technologies they know or want to learn.
- Profile visibility is controlled and privacy defaults are conservative.
- The system must not require public real names, college names, or employer names.

### 6.2 Onboarding and baseline

- Ask for relevant interests and current experience band.
- Ask what the user wants to improve: technical depth, explanation, problem-solving, design, debugging, review, or collaboration.
- Do not make a long diagnostic assessment a blocker to trying the product.
- A short optional baseline exercise may be added after the core MVP is stable.

### 6.3 Topic and scenario catalogue

- Users can browse and search a curated topic catalogue.
- Each topic includes title, short description, domain, difficulty, learning objectives, prerequisites, and suitable room formats.
- Each scenario includes a prompt, context, constraints, expected discussion tasks, and an evaluation rubric.
- MVP content is curated by administrators. User-submitted scenarios require moderation and are not required for launch.

### 6.4 Discussion sessions

- Users can browse upcoming and open sessions and view topic, difficulty, format, schedule/status, participant count, and rules.
- Users can join or leave a session according to its capacity and status.
- Sessions support 2–6 participants in MVP; target group size is 4–6.
- A session follows the lifecycle in `DISCUSSION_ENGINE.md`.
- The room starts with structured contributions, then supports questions and open discussion.
- Participants can submit written messages, code snippets, and lightweight text/diagram links or descriptions. No arbitrary executable code is run.
- Participants can pass on a turn without penalty.
- A host or moderator can pause, advance, or end a session according to permissions.
- Messages are attributed to the participant who submitted them and have stable IDs and timestamps.

### 6.5 AI evaluation

- A report is generated after a session reaches a completed state.
- Each user's report is private by default and evaluates that user's observable contribution.
- Dimensions include technical accuracy, reasoning/problem-solving, critical thinking, explanation clarity, question quality, and collaboration where sufficient evidence exists.
- Reports include strengths, specific improvement opportunities, evidence references, confidence, and a next-practice recommendation.
- Insufficient evidence is a valid result; the system must not invent a score.
- Users can flag an evaluation for review.

### 6.6 Skill profile and recommendations

- Store competency observations separately from profile claims.
- Competency levels are updated only when enough evidence exists across practice opportunities.
- A single weak session must not permanently label a user's skill level.
- Recommend a next activity using user goals, topic prerequisites, demonstrated evidence, and recency.
- Explain why an activity is recommended.

### 6.7 Community safety

- Users can report a message or participant and block another user.
- Moderators can review reports, remove content, warn or suspend users, and record actions.
- Room rules and reporting access are visible.
- AI output is not the sole basis for punitive actions.

## 7. Functional requirements and priority

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Authentication and protected app access | P0 |
| FR-02 | Editable learner profile and interests | P0 |
| FR-03 | Curated topics and scenarios | P0 |
| FR-04 | Browse, view, join, and leave text sessions | P0 |
| FR-05 | Session capacity and participant state | P0 |
| FR-06 | Structured discussion phases and open discussion | P0 |
| FR-07 | Persisted messages with safe rendering | P0 |
| FR-08 | Host/moderator controls for session lifecycle | P0 |
| FR-09 | Post-session AI evaluation with evidence | P0 |
| FR-10 | Private evaluation report and report flagging | P0 |
| FR-11 | Basic competency profile | P0 |
| FR-12 | Next-practice recommendation | P0 |
| FR-13 | Reporting, blocking, and admin moderation | P0 |
| FR-14 | Search and filter topic catalogue | P1 |
| FR-15 | User-created sessions with guardrails | P1 |
| FR-16 | Scheduled recurring sessions and reminders | P1 |
| FR-17 | One-to-one AI practice | P1 |
| FR-18 | Automatic participant matching | P2 |
| FR-19 | Voice/video discussions | P2 |
| FR-20 | AI multi-agent group rooms | P2 |
| FR-21 | Shared diagramming and engineering simulation workspace | P2 |
| FR-22 | Shareable Developer Skill Passport | P2 |

## 8. Non-functional requirements

- Security: enforce authentication, authorization, and least privilege on all protected resources.
- Privacy: private reports and discussions must not become public without explicit user action.
- Reliability: failed AI evaluation must not corrupt or lose a completed discussion.
- Performance: normal topic/session pages should feel responsive under ordinary early-stage traffic; establish measured targets during implementation.
- Accessibility: keyboard navigation, semantic structure, visible focus, sufficient contrast, and screen-reader labels.
- Maintainability: modular monolith with clear feature boundaries and documented contracts.
- Observability: capture errors, latency, evaluation failures, and relevant product events without leaking private content.

## 9. Core user journey

Sign up → choose interests and goals → explore a curated topic → join a small written session → complete structured turns → discuss and challenge ideas → finish session → read private report → review skill observations → choose recommended next practice.

## 10. UX acceptance criteria

- A new user can reach a relevant topic or session without completing a lengthy test.
- A user can understand session topic, level, expectations, and time commitment before joining.
- Room participants can tell which phase is active and what action is expected.
- A participant can pass a turn.
- Users can distinguish their private report from public profile content.
- A recommendation explains its rationale.
- Empty, loading, error, full-session, ended-session, and permission-denied states are designed.

## 11. AI evaluation acceptance criteria

- Every scored or qualitative claim points to supporting message IDs or is labelled as general feedback.
- No evidence means `insufficient_evidence`, not a fabricated score.
- Technical correctness and communication clarity are reported separately.
- Reports do not use personality labels or infer employability.
- Users can flag a report and see that it is under review.
- The same rubric version is recorded so results can be interpreted over time.

## 12. Release definition

The MVP is ready for a limited pilot when all P0 requirements have working end-to-end flows, authorization tests pass, AI evaluation failure is recoverable, moderation is available, and the deployment checklist is complete. See `MVP_SCOPE.md`, `TESTING.md`, and `DEPLOYMENT.md`.
