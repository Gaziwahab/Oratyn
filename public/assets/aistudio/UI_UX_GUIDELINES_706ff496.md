# UI and UX Guidelines

## Product feel

The interface should feel like a focused engineering workspace: calm, sharp, professional, supportive, and slightly technical. Avoid a gamified social-media appearance.

## Visual direction

- Dark-first interface, but do not use pure black as the only background.
- Suggested base: charcoal/slate surfaces; high-contrast readable text.
- Primary accent: electric blue.
- Secondary accent: restrained purple.
- Success: green; warning: amber; destructive: red. Use color semantically, not decoratively.
- Typography: Inter or Geist-style sans serif. Use a clear hierarchy with comfortable line-height.
- Components: rounded cards, subtle borders, restrained shadows, consistent spacing.
- Keep data-heavy pages uncluttered. Use charts only when they clarify progress.

Exact tokens belong in implementation code and may be adjusted after visual testing. Maintain contrast and do not rely on color alone to convey state.

## Layout

- Desktop-first for the discussion workspace, responsive down to mobile.
- Use a stable app shell with compact navigation.
- On wide screens, use a main content column with a secondary context/sidebar area where useful.
- On mobile, prioritize the prompt, current discussion, composer, and phase state. Collapse secondary panels.
- Avoid horizontal scrolling for normal reading and form layouts.

## Interaction principles

- One clear primary action per screen.
- Show the next expected action in a room without turning the entire experience into a strict exam.
- Give users time to think. Avoid unnecessary countdown pressure in asynchronous sessions.
- Make passing a turn possible and socially neutral.
- Distinguish a user's own message, another participant's message, moderator notices, and system events.
- Confirmation is required for irreversible actions such as deleting content or ending a session.
- Use toast notifications only for brief status; important state belongs in the page.

## Discussion room UX

- Always show the scenario context and active phase.
- Make phase changes explicit and explain what changes for participants.
- Present turn order fairly; do not hide who is expected to contribute.
- Allow code snippets and formatted text, but do not execute user code.
- Do not over-highlight AI feedback during the discussion; the AI evaluator primarily reports after completion in MVP.
- Provide refresh/reconnect resilience and visible message-send states.

## Evaluation report UX

- Explain that this is AI-generated formative feedback.
- Separate technical correctness from explanation clarity and collaboration.
- Show evidence references beside claims.
- Use confidence/insufficient-evidence indicators.
- Avoid red/green pass/fail language for a learner's identity.
- Use actionable wording: “In your message about indexing, you identified the read-heavy workload but did not compare write amplification” rather than “Your DBMS skills are poor.”
- Let users flag an evaluation and provide context.

## Accessibility

- Semantic landmarks and heading order.
- Keyboard access for navigation, dialogs, tabs, and composer.
- Visible focus indicator.
- Sufficient text and control contrast.
- Form labels and clear validation messages.
- Announce session state changes and message-send outcomes to assistive technologies without overwhelming users.
- Respect reduced-motion settings.

## Required screen states

Every data-driven screen must include:

- Loading/skeleton state.
- Empty state with a useful next action.
- Error state with retry when safe.
- Permission-denied state.
- Success/confirmation state.
- For sessions: full, scheduled, active, paused, completed, cancelled, and evaluation-pending states.

## Copywriting

- Friendly and direct, not corporate or overly academic.
- Explain technical terms briefly where beginners may encounter them.
- Avoid shaming words like “weak,” “bad developer,” or “failed learner.”
- Use “practice,” “evidence,” “next step,” and “improve” rather than “rank,” “beat,” or “prove your worth.”
