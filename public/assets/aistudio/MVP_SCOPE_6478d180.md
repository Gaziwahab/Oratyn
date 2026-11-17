# MVP Scope and Release Boundaries

## MVP statement

The MVP proves whether small-group written engineering practice plus evidence-based personal feedback creates repeatable learning value for CS students and early-career developers.

## Included in MVP (P0)

### Foundation
- Responsive web app with sign-up, sign-in, sign-out, and protected routes.
- Basic profile: display name, experience band, interests, learning goals.
- Role model for regular user, moderator, and administrator.

### Content
- Curated topic and scenario library.
- Topic detail pages with objectives, difficulty, prerequisites, and room formats.
- Admin-managed seed content for the pilot.

### Human discussion
- Small text-based rooms, 2–6 participants.
- Browse, join, leave, and see participant/session state.
- Structured first-contribution phase, question/challenge phase, open discussion, and conclusion.
- Turn order/turn ownership, time or phase guidance, and pass option.
- Persisted messages with safe Markdown/code rendering.
- Host/moderator actions: start, pause, advance phase, end session, remove participant where authorized.
- Basic real-time updates or a reliable polling fallback.

### Learning feedback
- Post-session AI evaluation for each participant.
- Private report with rubric dimensions, evidence references, strengths, improvements, confidence, and a next activity.
- Evaluation status and retry handling.
- Basic competency observations and next-practice suggestions.

### Safety and operations
- Report message/user, block user, admin review queue, remove content, warn/suspend account.
- Database migrations and RLS tests.
- Basic analytics events, error monitoring, environment setup, and deployment checklist.

## Not included in MVP

- Voice or video calls.
- AI group rooms with multiple AI personas.
- Fully autonomous one-to-one AI tutor or mock interviewer.
- Automated matching by skill, availability, or personality.
- Public leaderboard or global ranking.
- User follower/friend graph, likes, feed, or creator monetization.
- Real-time collaborative whiteboard or complex diagram editor.
- Arbitrary code execution, IDE integration, GitHub synchronization, or repository analysis.
- Mentor marketplace, employer dashboard, certificates, or hiring score.
- Multilingual interface.
- Native mobile apps.

## MVP room format

Use a text-first room that can operate as a scheduled facilitated session or as an asynchronous discussion with a clear participation window. This keeps the product useful even when all participants are not online at the same moment. Do not imply a voice call is happening.

## Pilot content recommendation

Begin with a small set of well-designed scenarios across a few representative domains:

1. Data structures and algorithm trade-offs.
2. OOP/design principles and code review.
3. DBMS and query/index reasoning.
4. Networking/API failure diagnosis.
5. Operating systems/concurrency basics.
6. Backend/system design fundamentals.

A small curated library is preferable to hundreds of shallow topics. Each scenario must include an answer-independent rubric that rewards reasoning and trade-off awareness, not one memorized solution.

## Launch cohort

Start with a controlled cohort and human facilitation. Make scheduled sessions and async participation reliable before attempting automated matching. Collect feedback from users after each completed session.

## Explicit release gates

Do not add P1/P2 features until:

- A user can complete the full core journey without staff intervention except session facilitation.
- Sessions persist correctly and recover from refresh/disconnection.
- Reports are understandable, evidence-linked, and can be flagged.
- Moderators can handle reports and abusive content.
- The team can measure session completion, repeat practice, report usefulness, and moderation load.
