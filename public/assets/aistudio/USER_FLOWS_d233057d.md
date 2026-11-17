# User Flows

## 1. First-time learner

1. Visitor opens landing page and understands the value proposition.
2. Selects sign up and creates an account through the configured authentication provider.
3. Completes a short profile: display name, experience band, learning goals, topic interests.
4. Sees a clear explanation of how sessions work and how AI feedback is used.
5. Arrives on the dashboard with recommended topics and available sessions.
6. Opens a topic/scenario, reviews objectives and difficulty, and joins a suitable session.

**UX rule:** Do not force a long baseline test before the learner can explore or join a session.

## 2. Join a discussion session

1. User opens Explore / Sessions.
2. Filters or browses by topic, difficulty, and session type.
3. Opens the session details page.
4. Reviews scenario, learning objectives, current participants, capacity, schedule/participation window, and rules.
5. Joins if eligible and capacity is available.
6. Sees confirmation and session status.
7. Enters the session when it becomes active or contributes asynchronously while the session is open.

Possible states: `open`, `full`, `scheduled`, `active`, `paused`, `completed`, `cancelled`.

## 3. Complete a discussion

1. Host/moderator starts the session.
2. Moderator explains the prompt, rules, and phases.
3. Participants independently submit an initial response.
4. Participants ask clarifying and challenging questions.
5. Participants respond, revise, and compare approaches.
6. Room moves to open discussion.
7. Participants add a conclusion or reflection.
8. Host completes the session.
9. Evaluation job is queued or started.
10. User sees `evaluation_pending` status and can leave the room.
11. User receives a private report when ready.
12. Competency evidence and next-practice suggestions update.

A user who refreshes or disconnects must be able to return to the same session and see persisted content.

## 4. Read a personal evaluation

1. User opens session report from dashboard or session history.
2. Sees evaluation status, rubric dimensions, and a note that the report is AI-generated formative feedback.
3. Opens a dimension to inspect supporting message evidence.
4. Reviews strengths and improvements.
5. Reads one recommended next activity and why it was recommended.
6. Can mark the report as useful/not useful and flag a specific concern.
7. If flagged, sees a review status without being promised a particular outcome or response time.

## 5. Host a session (MVP: authorized host/moderator)

1. Host selects a curated topic/scenario.
2. Sets title (optional), capacity within permitted limits, participation mode, and schedule/window.
3. Reviews the room rules and rubric.
4. Publishes the session.
5. Manages participants and advances phases.
6. Pauses or ends the session when appropriate.
7. Reviews aggregate session status, but does not automatically see each participant's private report.

## 6. Moderator handles a report

1. Moderator opens the moderation queue.
2. Reviews report category, content reference, prior actions, and context permitted by role.
3. Chooses a proportionate action: no action, remove content, warn, suspend, or escalate.
4. Records a reason and audit event.
5. Reporter sees the case status if the product exposes status updates.

AI-generated evaluation content must not be used as the only evidence for punitive moderation.

## 7. Empty-state flow

If no suitable active session exists:

- Show the next scheduled session and relevant upcoming topics.
- Offer asynchronous sessions that accept contributions over a participation window.
- Explain how to request or suggest a topic if this becomes part of the release.
- Do not fabricate live participant counts or show fake online status.

## 8. Error and recovery flows

- **Network interruption:** preserve unsent draft locally where safe; retry on explicit action; do not silently duplicate a message.
- **Session becomes full:** explain the state and offer another real session; do not add the user silently.
- **Session ends while user is composing:** preserve the draft and explain that new posts are disabled.
- **AI provider fails:** keep the session completed, mark evaluation as failed/retryable, and do not lose messages.
- **Evaluation is still running:** show a pending state and avoid claiming the report is ready.
- **Unauthorized access:** show a neutral permission message and do not reveal private room data.
