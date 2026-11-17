import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateCompetencyProgress,
  computeRoomParticipantStandings,
  computeUserDebatePoints,
  recommendNextPractice,
  recommendPracticeQueue,
  verifyEvaluationEvidence,
} from './evaluation';
import { PILOT_SCENARIOS } from './catalogue';
import type { EvaluationReportPayload, SessionMessage } from './types';

test('verifyEvaluationEvidence keeps verified excerpts and rejects invented IDs or quotes', () => {
  const messages: SessionMessage[] = [
    {
      id: 'msg-1',
      sessionId: 'sess-1',
      senderUid: 'user-a',
      senderDisplayName: 'Alice',
      body: 'I would inspect p95 latency and check if client auto-retries are amplifying database pool saturation.',
      messageType: 'text',
      phase: 'initial_contributions',
      replyToMessageId: null,
      clientMessageId: 'cm-1',
      createdAtMs: 1000,
      editedAtMs: null,
      deletedAtMs: null,
    },
    {
      id: 'msg-peer',
      sessionId: 'sess-1',
      senderUid: 'user-b',
      senderDisplayName: 'Bob',
      body: 'We could also add a Redis cache with a 30s TTL.',
      messageType: 'text',
      phase: 'cross_questioning',
      replyToMessageId: 'msg-1',
      clientMessageId: 'cm-2',
      createdAtMs: 2000,
      editedAtMs: null,
      deletedAtMs: null,
    },
  ];

  const candidateReport: EvaluationReportPayload = {
    summary: 'Good diagnostic starting point.',
    confidence: 'medium',
    dimensions: [
      {
        key: 'technical_accuracy',
        status: 'scored',
        rating: 3,
        summary: 'Identified retry amplification.',
        confidence: 'medium',
        evidence: [
          {
            message_id: 'msg-1',
            excerpt: 'client auto-retries are amplifying database pool saturation',
            type: 'strength',
            explanation: 'Correctly connected retries to pool saturation.',
          },
        ],
      },
      {
        key: 'critical_thinking_and_tradeoffs',
        status: 'scored',
        rating: 4,
        summary: 'Hallucinated peer attribution or fake quote.',
        confidence: 'high',
        evidence: [
          {
            message_id: 'msg-peer',
            excerpt: 'add a Redis cache with a 30s TTL',
            type: 'strength',
            explanation: 'Should be rejected because msg-peer belongs to peer, not target.',
          },
          {
            message_id: 'invented-id-999',
            excerpt: 'completely invented quote',
            type: 'strength',
            explanation: 'Should be rejected.',
          },
        ],
      },
    ],
    strengths: ['Connects retries to downstream pressure.'],
    improvements: [
      {
        action: 'Check query plans before adding caches.',
        why_it_matters: 'Avoids masking slow SQL.',
        evidence_message_ids: ['msg-1', 'msg-peer'],
      },
    ],
    next_practice: {
      competency_key: 'systematic_debugging',
      suggested_activity_type: 'scenario',
      reason: 'Continue practicing load diagnostics.',
    },
  };

  const result = verifyEvaluationEvidence({
    report: candidateReport,
    targetUid: 'user-a',
    sessionMessages: messages,
  });

  assert.equal(result.valid, false);
  assert.equal(result.rejectedCount, 2);
  assert.equal(result.verifiedReport.dimensions[0].status, 'scored');
  assert.equal(result.verifiedReport.dimensions[0].evidence.length, 1);
  // Dimension 2 had all evidence rejected -> downgraded safely to insufficient_evidence
  assert.equal(result.verifiedReport.dimensions[1].status, 'insufficient_evidence');
  assert.equal(result.verifiedReport.dimensions[1].rating, null);
  assert.deepEqual(result.verifiedReport.improvements[0].evidence_message_ids, ['msg-1']);
});

test('aggregateCompetencyProgress never grants consistent mastery from one session', () => {
  const singleSession = aggregateCompetencyProgress([
    {
      id: 'obs-1',
      uid: 'user-a',
      competencyKey: 'systematic_debugging',
      sessionId: 'sess-1',
      evaluationId: 'eval-1',
      rating: 4,
      confidence: 'high',
      rubricVersion: 1,
      observedAtMs: 1000,
    },
  ]);

  assert.equal(singleSession[0].status, 'emerging');
  assert.equal(singleSession[0].confidence, 'low');

  const repeatedSessions = aggregateCompetencyProgress([
    {
      id: 'obs-1',
      uid: 'user-a',
      competencyKey: 'systematic_debugging',
      sessionId: 'sess-1',
      evaluationId: 'eval-1',
      rating: 3,
      confidence: 'medium',
      rubricVersion: 1,
      observedAtMs: 1000,
    },
    {
      id: 'obs-2',
      uid: 'user-a',
      competencyKey: 'systematic_debugging',
      sessionId: 'sess-2',
      evaluationId: 'eval-2',
      rating: 4,
      confidence: 'high',
      rubricVersion: 1,
      observedAtMs: 2000,
    },
    {
      id: 'obs-3',
      uid: 'user-a',
      competencyKey: 'systematic_debugging',
      sessionId: 'sess-3',
      evaluationId: 'eval-3',
      rating: 3,
      confidence: 'high',
      rubricVersion: 1,
      observedAtMs: 3000,
    },
  ]);

  assert.equal(repeatedSessions[0].status, 'consistent');
  assert.equal(repeatedSessions[0].confidence, 'high');
});

test('recommendNextPractice prioritizes weak competencies and excludes completed/dismissed', () => {
  const rec = recommendNextPractice({
    scenarios: PILOT_SCENARIOS,
    completedScenarioIds: new Set(['scen-api-timeout-under-load']),
    dismissedScenarioIds: new Set(),
    competencyProgress: [
      {
        competencyKey: 'database_tradeoff_reasoning',
        status: 'emerging',
        confidence: 'low',
        observationCount: 1,
        lastObservedAtMs: 1000,
        averageRating: 1.5,
      },
    ],
    userInterests: ['Databases'],
  });

  assert.ok(rec !== null);
  assert.notEqual(rec.scenario.id, 'scen-api-timeout-under-load');
  assert.ok(rec.scenario.competencies.includes('database_tradeoff_reasoning'));

  const queue = recommendPracticeQueue({
    scenarios: PILOT_SCENARIOS,
    completedScenarioIds: new Set(['scen-api-timeout-under-load']),
    dismissedScenarioIds: new Set(),
    competencyProgress: [
      {
        competencyKey: 'database_tradeoff_reasoning',
        status: 'emerging',
        confidence: 'low',
        observationCount: 1,
        lastObservedAtMs: 1000,
        averageRating: 1.5,
      },
    ],
    userInterests: ['Databases'],
  });
  assert.ok(queue.primary !== null);
  assert.equal(queue.alternatives.length, 2);
});

test('computeUserDebatePoints and computeRoomParticipantStandings award points for approach, questioning back, and clarification', () => {
  const standings = computeRoomParticipantStandings(
    [
      { uid: 'u1', displayName: 'Gazi Wahab', role: 'host' },
      { uid: 'u2', displayName: 'Priya', role: 'participant' },
    ],
    [
      {
        senderUid: 'u1',
        senderDisplayName: 'Gazi Wahab',
        body: 'First I would inspect p95 latency metrics and bound client retry storms because unbounded retries saturate the connection pool trade-off.',
        phase: 'initial_contributions',
        replyToMessageId: null,
        messageType: 'text',
      },
      {
        senderUid: 'u2',
        senderDisplayName: 'Priya',
        body: 'What happens if the token bucket rate limiter fails open during a traffic spike?',
        phase: 'cross_questioning',
        replyToMessageId: 'm1',
        messageType: 'text',
      },
    ]
  );

  assert.equal(standings.length, 2);
  assert.ok(standings[0].totalPoints > 0);
  const gazi = standings.find((s) => s.uid === 'u1')!;
  const priya = standings.find((s) => s.uid === 'u2')!;
  assert.ok(gazi.bestApproachPts >= 16);
  assert.ok(priya.questionBackPts >= 15);

  const userPts = computeUserDebatePoints(null, [
    {
      body: 'How do we prevent cache stampede when TTL expires?',
      phase: 'cross_questioning',
      replyToMessageId: 'm1',
      messageType: 'text',
    },
  ]);
  assert.ok(userPts.questionBackPts > 0);
  assert.ok(userPts.totalPoints > 0);
});


