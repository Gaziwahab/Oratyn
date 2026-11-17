# AI Engine

## 1. MVP responsibility

In MVP, AI is primarily a **post-session evaluator**. It turns actual discussion contributions into a private, formative report. It is not the source of truth for user identity, room permissions, community moderation, or permanent skill labels.

Future AI roles may include a one-to-one practice coach, moderator assistant, challenger, and multi-agent discussion participants. These are later capabilities and must be clearly disclosed as AI.

## 2. Evaluation dimensions

Use a small, understandable rubric. Suggested dimensions:

1. **Technical accuracy** — Are factual or technical claims correct in the scenario's context?
2. **Problem-solving and reasoning** — Does the participant structure the problem, explain assumptions, and reason through consequences?
3. **Critical thinking and trade-offs** — Does the participant compare alternatives, constraints, and failure modes?
4. **Explanation clarity** — Can another learner follow the explanation? Is terminology used appropriately?
5. **Question quality** — Are questions relevant, specific, and useful for revealing assumptions or gaps?
6. **Collaboration and adaptability** — Does the participant respond constructively, consider others' ideas, and revise when warranted?

Not every dimension applies to every scenario or every participant. Use `insufficient_evidence` or `not_applicable` where needed.

## 3. Rubric scale

For dimensions with enough evidence, use a bounded 0–4 descriptive scale:

- `0 — Not demonstrated`: relevant opportunity existed, but the contribution did not demonstrate the behavior.
- `1 — Emerging`: partial attempt; important reasoning or details are missing.
- `2 — Developing`: generally sound but has clear gaps or limited justification.
- `3 — Strong`: accurate, clear, and appropriately justified for the scenario.
- `4 — Excellent`: especially thoughtful, precise, and adaptive; considers meaningful alternatives and constraints.

This is a formative rubric, not a standardized exam or hiring score. The report must explain the rating with evidence. Do not calculate a global user rank from this scale.

## 4. Evaluation input

Provide only the minimum necessary context:

- Scenario prompt, context, constraints, and learning objectives.
- Rubric version and criterion descriptions.
- Session phase sequence.
- Messages by the target participant and relevant peer messages needed to understand replies.
- Stable message IDs, author IDs or pseudonyms, timestamps, and phase metadata.
- Relevant user-chosen experience band only if needed to calibrate explanation; do not infer personal attributes.

Do not send unrelated profile information or private data to the model.

## 5. Evaluation output contract (logical schema)

```json
{
  "summary": "A concise and balanced summary of the participant's contribution.",
  "confidence": "medium",
  "dimensions": [
    {
      "key": "technical_accuracy",
      "status": "scored",
      "rating": 3,
      "summary": "The participant identified the read-heavy workload and selected an appropriate index, but did not discuss write cost.",
      "confidence": "medium",
      "evidence": [
        {
          "message_id": "real-message-uuid",
          "excerpt": "Short excerpt verified against the stored message.",
          "type": "strength",
          "explanation": "This supports the identified workload and index choice."
        }
      ]
    },
    {
      "key": "question_quality",
      "status": "insufficient_evidence",
      "rating": null,
      "summary": "The participant had limited opportunity to ask questions.",
      "confidence": "low",
      "evidence": []
    }
  ],
  "strengths": ["Specific, evidence-supported strength."],
  "improvements": [
    {
      "action": "Compare read benefit against write amplification.",
      "why_it_matters": "Index choice affects both query speed and write cost.",
      "evidence_message_ids": ["real-message-uuid"]
    }
  ],
  "next_practice": {
    "competency_key": "database_tradeoff_reasoning",
    "suggested_activity_type": "scenario",
    "reason": "The discussion showed a useful starting point but limited comparison of operational trade-offs."
  }
}
```

The implementation must define and validate a strict schema. The example is illustrative; never persist arbitrary model output without validation.

## 6. Evidence validation

- Every `message_id` must exist in the evaluated session and be visible to the evaluator.
- Every excerpt must be an exact substring or a carefully verified short excerpt of the referenced stored message. Prefer exact substring checks.
- Reject evidence from another session or another user's private report.
- Do not invent a quote or message ID.
- If no appropriate evidence exists, mark the dimension insufficient.
- Keep report content tied to the target participant; peer messages are context, not evidence of the target user's skill.

## 7. Prompting principles

- Ask the model to assess observable behavior, not personality or potential.
- Evaluate correctness against the scenario's context and constraints, not only a single canonical answer.
- Reward acknowledging uncertainty, revising a claim, and asking a useful question.
- Do not reward verbosity or number of messages.
- Separate technical accuracy from explanation clarity.
- Consider that a participant may have had fewer opportunities to contribute.
- Avoid overconfident language; state uncertainty and missing evidence.
- Provide feedback a learner can act on in the next practice session.

## 8. Evaluation pipeline

1. Session completion event is recorded.
2. Evaluation row is created with `pending` status and a fixed rubric/prompt version.
3. Worker/service changes status to `processing`.
4. Minimal transcript and scenario context are sent to provider adapter.
5. Structured output is parsed and validated.
6. Evidence IDs and excerpts are verified against the database.
7. Domain-specific sanity checks run (ratings within range, required dimensions, no duplicate keys, no unknown message IDs).
8. Normalized report and competency observations are persisted.
9. Status becomes `completed`.
10. On retryable failure, status becomes `failed` with a safe error code; retry is bounded and idempotent.

## 9. Safeguards and fairness

- No public ranking from one or a few sessions.
- Do not infer intelligence, personality, employability, or professional worth.
- No accent, voice, speed, appearance, or demographic inference. MVP is text-only.
- A low-contribution session should not automatically mean low skill; report insufficient evidence.
- If a participant was interrupted, removed, or had a technical issue, that context should be considered before evaluation.
- Show a clear AI-generated label and the rubric version.
- Permit users to provide feedback or challenge a report.
- Use human review for contested evaluations before any consequential action.
- Do not use evaluations as hiring recommendations.

## 10. Reliability, cost, and privacy

- Set timeouts, retry limits, token/context limits, and per-user rate limits.
- Record provider/model usage metadata without storing keys.
- Avoid logging raw transcripts by default.
- Define retention and deletion policy for transcripts and reports before public launch.
- Treat provider outages as recoverable; session completion must remain intact.
- Review model and provider data-handling terms before using real user discussions.

## 11. AI roles after MVP

- **One-to-one coach:** asks adaptive questions and explains concepts.
- **AI moderator:** clarifies phase and turn rules without dominating the room.
- **AI challenger:** introduces constraints or counterarguments in a transparent AI role.
- **AI group participants:** distinct declared perspectives, never pretending to be real humans.

Do not build these roles until post-session evaluation is accurate enough and users want them.
