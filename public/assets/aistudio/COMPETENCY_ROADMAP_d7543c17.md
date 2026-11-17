# Competency Model and Adaptive Roadmap

## 1. Purpose

Translate practice evidence into useful next steps. The system should represent what a learner has demonstrated, what remains uncertain, and which practice activity could help next.

## 2. Competency graph, not a simple course checklist

A competency can have prerequisites and relationships to multiple topics. A learner may demonstrate the same competency in different scenarios. For MVP, use relational links and explicit recommendations; do not build a sophisticated graph database.

Example domains and competencies:

| Domain | Example competencies |
|---|---|
| Programming fundamentals | Explain control flow, reason about data structures, discuss complexity |
| OOP and design | Identify responsibilities, explain encapsulation, compare design alternatives |
| Databases | Explain indexes, reason about transactions, compare query plans |
| Operating systems | Explain concurrency, identify race conditions, reason about scheduling |
| Networking and APIs | Explain request lifecycle, diagnose failures, discuss reliability |
| Backend engineering | Design API boundaries, reason about caching, handle errors and retries |
| System design | Clarify requirements, identify bottlenecks, compare architecture trade-offs |
| Engineering practice | Review code constructively, ask clarifying questions, communicate uncertainty |

## 3. Evidence sources

MVP uses:

- AI evaluation evidence linked to session messages.
- Session completion and scenario/rubric metadata.
- User feedback on whether a report was useful.
- Future sources may include quizzes, teach-back, code review artifacts, mentor validation, or project evidence.

Do not equate completing a tutorial or joining a room with demonstrating mastery.

## 4. Observation vs. competency level

Store dated observations. A dashboard may show an estimated status such as `not_enough_evidence`, `emerging`, `developing`, or `consistent`, but it must be derived from multiple observations and display recency/confidence.

A single low rating should not permanently reduce a competency. A single high rating should not certify mastery. Repeated observations across different scenarios provide stronger evidence.

## 5. Recommendation logic for MVP

Use a transparent, explainable rules-based recommender before adding complex ML:

1. Filter to published topics/scenarios the user has not recently completed.
2. Respect prerequisites or show prerequisite practice when needed.
3. Prefer competencies relevant to the user's stated goals.
4. Consider recent observations with low or medium confidence, not only low scores.
5. Avoid recommending the same activity repeatedly after dismissal or recent completion.
6. Mix reinforcement and stretch practice.
7. Return one primary recommendation plus optional alternatives.
8. Provide a short reason tied to evidence or user goals.

Example: “Try the API failure scenario next. Your last session showed good request-flow reasoning, and this scenario adds retry and timeout trade-offs.”

## 6. Progress UI

Show:

- Competency name and plain-language description.
- Current status with confidence and evidence count.
- Recent practice sessions contributing to the status.
- Last observed date.
- Suggested next activity and rationale.

Avoid a single percentage that implies complete measurement of a person's engineering ability.

## 7. Data integrity

- Competency observations are immutable or versioned; do not silently overwrite history.
- Store the source evaluation and rubric version.
- Allow corrections when a report is reviewed or invalidated.
- Keep recommendations distinct from observations.
- Record recommendation reason/version so the system can be audited and improved.

## 8. Future development

Possible future enhancements include a prerequisite graph, semantic scenario retrieval, calibrated longitudinal estimates, self-assessment comparison, mentor feedback, and skill passport export. Each requires validation and clear user consent.
