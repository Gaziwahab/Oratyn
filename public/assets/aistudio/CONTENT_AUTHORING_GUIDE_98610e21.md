# Content and Scenario Authoring Guide

## 1. Content quality standard

The catalogue is a core part of the learning experience. Prefer a small number of well-designed prompts with clear objectives and fair rubrics over a large list of shallow questions.

Each scenario should create more than one reasonable line of reasoning. The rubric should reward assumptions, trade-offs, evidence, and adaptation—not memorization of a single answer.

## 2. Starter subject taxonomy

Use these as expandable domains, not as a requirement to launch every topic immediately.

### Computer science foundations

- Data structures and algorithms.
- Object-oriented programming and design principles.
- Operating systems and concurrency.
- Database management systems and transactions.
- Computer networks and protocols.
- Software engineering and testing.
- Theory of computation and compiler fundamentals.

### Software development

- Programming languages: C, C++, Java, Python, JavaScript/TypeScript.
- Frontend engineering and browser fundamentals.
- Backend engineering and API design.
- Full-stack application design.
- Mobile development concepts.
- Git, code review, debugging, and testing practices.

### Modern engineering

- System design and distributed systems.
- Microservices and service boundaries.
- Cloud, deployment, and DevOps.
- Security and threat modeling.
- Database design and performance.
- Caching, queues, reliability, and observability.
- Data engineering and analytics.

### Emerging areas (expand later)

- AI/ML, generative AI, and LLM application engineering.
- Blockchain fundamentals.
- Internet of Things and embedded systems.
- Privacy engineering and applied security.

## 3. Scenario template

```yaml
slug: api-timeout-under-load
title: Diagnose an API that slows down under load
domain: Backend Engineering
topic: API Reliability
difficulty: intermediate
estimated_minutes: 25
participation_mode: both
context: "A service's p95 latency has increased after traffic grew."
prompt: "Propose a diagnostic plan and explain what you would investigate first."
constraints:
  - "You cannot immediately add more servers."
  - "The team has limited observability data."
learning_objectives:
  - "Ask clarifying questions before proposing a fix."
  - "Identify plausible bottlenecks and evidence needed."
  - "Compare mitigation and long-term options."
prerequisites:
  - "HTTP request lifecycle"
  - "Basic database and caching concepts"
competencies:
  - "systematic_debugging"
  - "reliability_tradeoff_reasoning"
  - "technical_explanation"
rubric_version: 1
```

The implementation can use database records instead of YAML. The template shows required content, not a required file format.

## 4. Scenario author checklist

- Is the context understandable without hidden assumptions?
- Is the expected level explicit?
- Are constraints realistic and relevant?
- Can more than one answer be defensible?
- Are learning objectives observable in a discussion?
- Does the rubric distinguish correctness from reasoning and communication?
- Are prerequisites stated?
- Is there enough information to begin, while leaving room for clarifying questions?
- Is the prompt free of confidential, dangerous, or discriminatory content?
- Can it be completed within the stated time/participation window?

## 5. Example pilot scenario: API slows down under load

**Context:** An API that previously handled normal traffic now has elevated p95 latency. Error rates are also increasing during peak periods. The team has a small budget and incomplete observability.

**Prompt:** You are on the engineering team. Explain what you would ask, what evidence you would collect, what you would investigate first, and which short-term mitigation you would consider. Be explicit about assumptions.

**Constraints:** You cannot immediately add more servers. You do not yet know whether the bottleneck is application code, database, network, dependency, or traffic pattern.

**Strong discussion signals:** Clarifying questions about traffic and latency distribution; separating symptoms from causes; using evidence before prescribing; comparing database/query, dependency, resource, and caching hypotheses; discussing risk of retries and caching; identifying safe mitigation and follow-up measurement.

**Rubric anchors:**

- Technical accuracy: understands latency percentiles, request paths, bottlenecks, and retry/caching risks.
- Reasoning: proposes a sequence of diagnostics and uses evidence to narrow hypotheses.
- Trade-offs: compares mitigations and side effects.
- Explanation: communicates assumptions and steps clearly.
- Questions: asks for traffic, error, trace, resource, and dependency information that changes the diagnosis.
- Collaboration: responds constructively and revises a hypothesis when new evidence appears.

There is no single required final architecture or fix. The evaluation should reward a sound diagnostic process.

## 6. Rubric authoring

Every dimension needs:

- Stable machine key.
- Learner-facing name.
- Plain-language description.
- Observable behaviors.
- Anchors for each rating band.
- Conditions for `insufficient_evidence` and `not_applicable`.
- Examples of evidence that should and should not count.

Do not use vague criteria such as “smartness,” “confidence,” “leadership personality,” or “communication vibe.”

## 7. Content governance

- Only authorized content managers publish scenarios in MVP.
- Store scenario and rubric versions.
- Review content after reports show repeated ambiguity or disagreement.
- Keep an archive rather than silently altering the meaning of old sessions.
- Use synthetic examples in seed data.
