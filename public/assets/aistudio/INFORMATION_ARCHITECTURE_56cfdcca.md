# Information Architecture

## Primary navigation

For signed-in learners:

1. **Home** — personal dashboard, recommended practice, upcoming sessions, recent reports.
2. **Explore** — topics, scenarios, open sessions, and scheduled sessions.
3. **My Sessions** — joined, hosted, completed, and cancelled sessions.
4. **My Progress** — competency observations, history, recommendations.
5. **Profile** — personal details and visibility settings.

Secondary navigation: notifications (when implemented), help/rules, settings, sign out.

Admin/moderator navigation is role-gated and should not appear for ordinary users:

- Content management: topics and scenarios.
- Session management.
- Moderation queue.
- User management and audit history.
- Basic operational analytics.

## Route map (suggested)

| Route | Purpose | Access |
|---|---|---|
| `/` | Landing page | Public |
| `/auth/sign-in` | Sign in | Public |
| `/auth/sign-up` | Sign up | Public |
| `/onboarding` | Profile, interests, goals | Signed-in incomplete profile |
| `/dashboard` | Learner home | Signed-in |
| `/explore` | Topic and session discovery | Signed-in |
| `/topics/[slug]` | Topic detail and related scenarios | Signed-in |
| `/scenarios/[slug]` | Scenario brief and related sessions | Signed-in |
| `/sessions` | Session list and filters | Signed-in |
| `/sessions/[sessionId]` | Session detail / room | Authorized participant or permitted viewer |
| `/sessions/[sessionId]/report` | Personal report | Owning participant; moderator access only under explicit policy |
| `/my-sessions` | User session history | Signed-in |
| `/progress` | Competency profile and next practice | Signed-in |
| `/profile` | User profile | Signed-in |
| `/settings` | Privacy and account settings | Signed-in |
| `/admin` | Admin overview | Admin only |
| `/admin/content` | Curate topics/scenarios | Admin/content manager |
| `/admin/sessions` | Manage sessions | Authorized host/admin |
| `/admin/moderation` | Review reports | Moderator/admin |

Routes are suggestions; preserve semantics if the framework's routing conventions differ.

## Dashboard hierarchy

1. Greeting and a clear primary action: find a practice session.
2. Recommended next practice, with reason.
3. Upcoming/active sessions.
4. Recent personal feedback.
5. Progress snapshot with evidence count and recency, not a single opaque score.

Do not make the dashboard a social feed.

## Content hierarchy

- Domain (e.g. Backend Engineering)
  - Topic (e.g. API Design)
    - Competencies (e.g. API trade-off reasoning, failure handling)
    - Prerequisites
    - Scenarios
      - Room format
      - Prompt and constraints
      - Rubric
      - Suggested duration/participation window

## Session detail hierarchy

- Topic and scenario title
- Difficulty and learning objectives
- Participation mode and schedule/window
- Participant count / capacity
- Session status
- Rules and phase sequence
- Join/leave action

## Session room hierarchy

- Room header: title, status, phase, host, participant list.
- Scenario panel: prompt, context, constraints, objectives.
- Phase/timeline indicator.
- Main discussion stream.
- Current turn / next action guidance.
- Composer with safe Markdown/code formatting.
- Participant and room actions.
- Report status after completion.

## Design rule

The primary call-to-action should always be obvious. The interface should help users answer: “What should I practise next, and what do I do in this room right now?”
