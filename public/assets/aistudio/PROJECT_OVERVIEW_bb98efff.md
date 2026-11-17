# Project Overview

## 1. Working concept

A practice platform that helps people become stronger software engineers by repeatedly solving, explaining, questioning, reviewing, and improving engineering ideas with other people and, later, AI practice partners.

The product trains more than the ability to write code. It helps a learner articulate why an approach works, identify trade-offs, ask precise questions, respond to counterarguments, debug systematically, and collaborate constructively.

## 2. The problem

Many learners consume tutorials and complete coding exercises but get limited practice in the activities that occur in real engineering teams:

- Explaining a design or implementation to another person.
- Defending a technical decision with evidence and trade-offs.
- Asking clarifying questions before proposing a solution.
- Comparing alternatives instead of assuming the first idea is correct.
- Reviewing someone else's code or architecture constructively.
- Diagnosing a system under incomplete or changing information.
- Adapting an approach after a challenge or new constraint.

Traditional courses tend to teach content; coding platforms often evaluate whether an answer passes tests. Neither necessarily measures how someone reasons and communicates in an engineering conversation.

## 3. Proposed solution

The platform organizes practice around small engineering rooms and realistic scenarios. A user makes an initial contribution, receives questions or challenges, responds to peers, and gets a personal report based on the actual discussion. Over repeated sessions, the system builds a cautious picture of demonstrated competencies and recommends the next practice activity.

## 4. Core learning loop

1. **Choose:** Select a topic, competency, room type, or scenario.
2. **Prepare:** Read a concise brief and inspect the constraints.
3. **Contribute:** Explain an approach, ask a question, review an artifact, or propose a diagnosis.
4. **Challenge:** Peers ask questions, identify trade-offs, and introduce alternatives.
5. **Revise:** The learner improves or qualifies their original approach.
6. **Reflect:** The system provides private, evidence-linked feedback.
7. **Progress:** The competency profile and next-practice suggestions update when evidence is sufficient.

## 5. Initial audience

### Primary audience

- Computer science and software engineering students.
- Beginners and junior developers preparing for internships or their first software role.

### Secondary audience

- Developers who want structured practice in system design, debugging, review, and technical communication.
- Mentors and educators who may host sessions in a later release.

The MVP should be designed around the primary audience. Do not let advanced professional features make the first experience confusing for beginners.

## 6. Initial product pillars

| Pillar | Purpose | MVP status |
|---|---|---|
| Engineering Rooms | Small-group written discussions about real engineering topics | Core |
| Discussion Protocol | Structured opening contributions followed by questions and open discussion | Core |
| AI Feedback | Private, evidence-linked report after a completed discussion | Core |
| Skill Profile | Record demonstrated competencies and evidence over time | Basic version |
| Adaptive Practice | Suggest a useful next activity based on evidence and prerequisites | Basic version |
| AI Practice Arena | One-to-one and multi-agent AI practice | Later |
| Engineering Labs | Rich simulations, collaborative diagrams, code execution/review workspace | Later |
| Developer Skill Passport | Shareable evidence-based profile | Later |
| Voice, matching, mentors | Live audio rooms, automated matching, mentor sessions | Later |

## 7. What the product is not

- Not another feed where developers post content and compete for likes.
- Not a course marketplace or replacement for technical documentation.
- Not a coding judge whose only signal is pass/fail.
- Not an AI chatbot with a developer-themed interface.
- Not a hiring or personality assessment tool.

## 8. Product principles

1. **Practice over passive consumption.** The primary action is doing and reflecting.
2. **Reasoning over performance theatre.** Reward good questions, revision, and collaboration, not loudness.
3. **Evidence over opaque scores.** Feedback must point to actual contributions.
4. **Progress over comparison.** Personal improvement matters more than public rank.
5. **Small groups over mass rooms.** Everyone should have a reasonable chance to contribute.
6. **Human agency.** AI supports practice; users can disagree with assessments and control profile visibility.
7. **Simple first release.** Validate the learning loop before adding complex media and social features.

## 9. Initial launch assumptions

- Responsive web application, desktop-first design with mobile support.
- English-only initial experience.
- Text-only discussions in the MVP.
- Small groups of 2–6 participants; target 4–6 where possible.
- A curated set of high-quality topics and scenarios is better than a large unreviewed catalogue.
- A pilot may use manually scheduled or moderator-hosted sessions to solve the cold-start problem.
- No public user scoring or monetization is required to validate the first release.

## 10. Main risks

- Empty rooms or insufficiently active peers.
- AI feedback that sounds authoritative but is wrong.
- Learners optimizing for scores rather than learning.
- Discussions dominated by one participant.
- Too broad a topic catalogue and unclear onboarding.
- Privacy concerns around storing discussion transcripts.
- Building voice, matching, and simulation infrastructure before proving demand.

Mitigations are defined in the relevant product, AI, safety, and implementation documents.
