# Trust, Safety, and Moderation

## 1. Community purpose

The platform should make technical disagreement safe and useful. Participants may challenge ideas strongly, but must not harass, demean, threaten, discriminate, spam, or target another person.

## 2. Expected behavior

- Critique the idea, implementation, or reasoning—not the person's worth.
- Ask clarifying questions before assuming intent.
- Explain why an approach may fail and offer evidence or alternatives.
- Acknowledge uncertainty and be willing to revise.
- Do not pressure participants to reveal real names, college, employer, location, or personal contact details.
- Do not share another participant's private messages or report outside the platform without permission.

## 3. Prohibited behavior

- Harassment, threats, stalking, doxxing, or targeted abuse.
- Hate speech or discriminatory attacks.
- Sexual harassment or unwanted sexual content.
- Spam, scams, phishing, malware links, and credential requests.
- Impersonation or misleading claims that an AI participant is a real person.
- Posting private information or confidential employer/customer data.
- Malicious code, unsafe instructions, or attempts to exploit the platform.
- Manipulating AI feedback or flooding a room to gain reputation/points.

## 4. User controls

MVP should provide:

- Report a message, participant, or session.
- Block/unblock a user.
- Leave a session.
- Mute/ignore notifications from a session where feasible.
- Access to community rules and a contact/report path.

A block should prevent unwanted direct interaction and be considered by discovery/session interactions. The exact behavior for shared sessions should be clear and safe; do not reveal a blocker's identity unnecessarily.

## 5. Moderation workflow

1. Report is created with a category, target reference, reporter, and optional details.
2. Report enters a restricted queue.
3. Moderator reviews relevant context and prior actions.
4. Moderator records decision and reason.
5. Available actions: no action, content removal, warning, temporary suspension, permanent suspension, escalation.
6. The system records an audit event.
7. Reporter receives a limited status update where supported.
8. Appeals or review requests can be handled by an administrator.

## 6. Proportional enforcement

Use context and severity. A disagreement about a technical approach is not misconduct by itself. A first minor incident may justify guidance; threats, doxxing, or severe abuse may require immediate stronger action. Moderation decisions should be consistent and documented.

## 7. AI and moderation

- AI may flag content for moderator review, but should not be the sole basis for account suspension.
- Do not treat an AI evaluation score as a moderation signal.
- Clearly label AI-generated room participants in future releases.
- AI-generated feedback should be respectful, non-shaming, and tied to observable contributions.
- Provide a way to flag harmful or inaccurate AI output.

## 8. Moderator permissions and privacy

- Moderators see only the information necessary to resolve a case.
- Hosting a session does not automatically grant access to private evaluations.
- Privileged views and actions should be audited.
- Avoid exposing reporter identity to the reported user unless required by a documented appeal process or law.

## 9. MVP operational minimum

Before inviting an external pilot cohort, the team must be able to receive reports, review them, remove content, warn/suspend a user, and record decisions. If moderation capacity is not available, restrict access to an invite-only pilot rather than opening unmoderated rooms.
