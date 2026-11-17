# Analytics and Success Metrics

## 1. North-star outcome

**Demonstrated learning improvement per active learner over repeated practice opportunities.**

This is a product outcome, not a claim that the system can measure a person's complete engineering ability. Use multiple evidence points and report limitations.

## 2. Primary product metrics

- **Session completion rate:** completed sessions / sessions started.
- **Repeat practice rate:** users completing another session within a defined follow-up window.
- **Report usefulness:** proportion of evaluation feedback marked useful or mixed, with qualitative comments reviewed.
- **Evidence coverage:** proportion of evaluation claims with validated evidence references.
- **Evaluation reliability:** failure rate, invalid-output rate, evidence-rejection rate, and review flags.
- **Contribution distribution:** whether participation is reasonably distributed across room members; use as a fairness diagnostic, not a score.
- **Competency progression:** changes in repeated comparable observations over time, with confidence and sample size visible.
- **Safety response:** report volume, time to review, action consistency, and repeat incidents.

## 3. Guardrail metrics

- Session no-show and abandonment rate.
- Number of sessions with too few participants.
- AI cost per completed evaluation.
- Evaluation disagreement/appeal rate.
- User reports and block rate.
- Message send failure / duplicate rate.
- Accessibility defects and mobile task completion.

## 4. Events to instrument

Suggested event names:

- `account_created`
- `onboarding_completed`
- `topic_viewed`
- `scenario_viewed`
- `session_joined`
- `session_left`
- `session_started`
- `phase_changed`
- `message_sent`
- `turn_passed`
- `session_completed`
- `evaluation_started`
- `evaluation_completed`
- `evaluation_failed`
- `evaluation_feedback_submitted`
- `evaluation_review_requested`
- `recommendation_viewed`
- `recommendation_accepted`
- `recommendation_dismissed`
- `user_report_submitted`
- `moderation_action_taken`

## 5. Privacy-safe analytics

- Do not send full message bodies, transcripts, private report text, email, or secrets to general analytics.
- Prefer event IDs, coarse categories, timestamps, and pseudonymous identifiers.
- Define consent/notice requirements for analytics in the launch jurisdiction.
- Restrict access and define retention.
- Analytics must not become a covert hiring or employee-monitoring tool.

## 6. MVP dashboard for operators

Show:

- Active cohort size.
- Sessions scheduled/opened/started/completed.
- Participant attendance and repeat practice.
- Evaluation pending/completed/failed counts.
- AI cost and latency.
- Reports awaiting moderation.
- Top scenario usage and user feedback.

## 7. What not to optimize

Do not optimize for messages per user, hours online, daily streaks, likes, follower counts, public rank, or sheer number of rooms. These can incentivize noisy or performative behavior and do not prove learning.

## 8. Pilot questions

After each pilot cohort, ask whether users understood the report, identified a specific improvement, tried the next activity, felt safe challenging another participant, and would return for another session. Pair quantitative data with interviews and transcript review conducted under the privacy policy.
