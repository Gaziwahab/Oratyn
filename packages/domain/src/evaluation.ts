import type {
  CompetencyObservation,
  CompetencyStatus,
  ConfidenceLevel,
  EvaluationReportPayload,
  RubricDimensionKey,
  ScenarioItem,
  SessionMessage,
} from './types';

export const RUBRIC_DIMENSION_INFO: Record<
  RubricDimensionKey,
  { name: string; description: string }
> = {
  technical_accuracy: {
    name: 'Technical Accuracy',
    description: 'Correctness of technical claims, mechanisms, and terminology in scenario context.',
  },
  problem_solving_and_reasoning: {
    name: 'Problem-Solving & Reasoning',
    description: 'Structuring the problem, stating assumptions, and narrowing hypotheses systematically.',
  },
  critical_thinking_and_tradeoffs: {
    name: 'Critical Thinking & Trade-Offs',
    description: 'Comparing alternatives, operational constraints, failure modes, and justifying decisions.',
  },
  explanation_clarity: {
    name: 'Explanation Clarity',
    description: 'Communicating ideas clearly so peers can follow reasoning without ambiguity.',
  },
  question_quality: {
    name: 'Question Quality',
    description: 'Asking specific, relevant questions that uncover missing context or hidden assumptions.',
  },
  collaboration_and_adaptability: {
    name: 'Collaboration & Adaptability',
    description: 'Engaging peers constructively and revising hypotheses when new evidence appears.',
  },
};

export const RATING_BAND_LABELS: Record<number, string> = {
  0: '0 — Not demonstrated',
  1: '1 — Emerging',
  2: '2 — Developing',
  3: '3 — Strong',
  4: '4 — Excellent',
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export interface EvidenceVerificationResult {
  valid: boolean;
  verifiedReport: EvaluationReportPayload;
  rejectedCount: number;
  reasons: string[];
}

/**
 * Verifies every cited message_id and excerpt in an AI evaluation report against
 * the actual stored messages authored by the evaluated participant in that session.
 * Rejects invented IDs, cross-user evidence, and unverified excerpts.
 */
export function verifyEvaluationEvidence(params: {
  report: EvaluationReportPayload;
  targetUid: string;
  sessionMessages: readonly SessionMessage[];
}): EvidenceVerificationResult {
  const { report, targetUid, sessionMessages } = params;
  const userMessageMap = new Map<string, SessionMessage>();
  for (const msg of sessionMessages) {
    if (msg.senderUid === targetUid && !msg.deletedAtMs && msg.messageType !== 'system') {
      userMessageMap.set(msg.id, msg);
    }
  }

  let rejectedCount = 0;
  const reasons: string[] = [];
  const seenKeys = new Set<string>();

  const verifiedDimensions = report.dimensions.map((dim) => {
    if (seenKeys.has(dim.key)) {
      reasons.push(`Duplicate dimension key rejected: ${dim.key}`);
      rejectedCount++;
    }
    seenKeys.add(dim.key);

    const validEvidence = dim.evidence.filter((ev) => {
      const stored = userMessageMap.get(ev.message_id);
      if (!stored) {
        rejectedCount++;
        reasons.push(`Message ID ${ev.message_id} not found for evaluated participant.`);
        return false;
      }
      const normBody = normalizeWhitespace(stored.body).toLowerCase();
      const normExcerpt = normalizeWhitespace(ev.excerpt).toLowerCase();
      if (!normExcerpt || !normBody.includes(normExcerpt)) {
        rejectedCount++;
        reasons.push(`Excerpt did not match stored message ${ev.message_id}.`);
        return false;
      }
      return true;
    });

    // If a scored dimension lost all supporting evidence, downgrade cleanly to insufficient_evidence
    if (dim.status === 'scored' && validEvidence.length === 0) {
      return {
        ...dim,
        status: 'insufficient_evidence' as const,
        rating: null,
        confidence: 'low' as const,
        evidence: [],
        summary:
          'Insufficient verified message evidence in this session to score this dimension reliably.',
      };
    }

    return {
      ...dim,
      rating:
        dim.status === 'scored' && dim.rating !== null
          ? Math.max(0, Math.min(4, Math.round(dim.rating)))
          : null,
      evidence: validEvidence,
    };
  });

  const verifiedImprovements = report.improvements.map((item) => ({
    ...item,
    evidence_message_ids: item.evidence_message_ids.filter((id) => userMessageMap.has(id)),
  }));

  return {
    valid: rejectedCount === 0,
    rejectedCount,
    reasons,
    verifiedReport: {
      ...report,
      dimensions: verifiedDimensions,
      improvements: verifiedImprovements,
    },
  };
}

export interface CompetencyAggregate {
  competencyKey: string;
  status: CompetencyStatus;
  confidence: ConfidenceLevel;
  observationCount: number;
  lastObservedAtMs: number | null;
  averageRating: number | null;
}

/**
 * Aggregates dated competency observations cautiously.
 * A single session can never establish 'consistent' mastery.
 */
export function aggregateCompetencyProgress(
  observations: readonly CompetencyObservation[]
): CompetencyAggregate[] {
  const byKey = new Map<string, CompetencyObservation[]>();
  for (const obs of observations) {
    const list = byKey.get(obs.competencyKey) ?? [];
    list.push(obs);
    byKey.set(obs.competencyKey, list);
  }

  const results: CompetencyAggregate[] = [];
  for (const [competencyKey, list] of byKey.entries()) {
    const sorted = [...list].sort((a, b) => b.observedAtMs - a.observedAtMs);
    const count = sorted.length;
    const avg = sorted.reduce((acc, item) => acc + item.rating, 0) / count;

    let status: CompetencyStatus = 'not_enough_evidence';
    let confidence: ConfidenceLevel = 'low';

    if (count === 1) {
      status = avg >= 2 ? 'emerging' : 'not_enough_evidence';
      confidence = 'low';
    } else if (count === 2) {
      status = avg >= 2.5 ? 'developing' : 'emerging';
      confidence = 'medium';
    } else {
      if (avg >= 3) {
        status = 'consistent';
      } else if (avg >= 2) {
        status = 'developing';
      } else {
        status = 'emerging';
      }
      confidence = 'high';
    }

    results.push({
      competencyKey,
      status,
      confidence,
      observationCount: count,
      lastObservedAtMs: sorted[0]?.observedAtMs ?? null,
      averageRating: Number(avg.toFixed(2)),
    });
  }

  return results.sort((a, b) => (b.lastObservedAtMs ?? 0) - (a.lastObservedAtMs ?? 0));
}

export interface PracticeRecommendation {
  scenario: ScenarioItem;
  reason: string;
}

export function recommendNextPractice(params: {
  scenarios: readonly ScenarioItem[];
  completedScenarioIds: ReadonlySet<string>;
  dismissedScenarioIds: ReadonlySet<string>;
  competencyProgress: readonly CompetencyAggregate[];
  userInterests: readonly string[];
}): PracticeRecommendation | null {
  const {
    scenarios,
    completedScenarioIds,
    dismissedScenarioIds,
    competencyProgress,
    userInterests,
  } = params;

  const candidates = scenarios.filter(
    (s) =>
      s.status === 'published' &&
      !completedScenarioIds.has(s.id) &&
      !dismissedScenarioIds.has(s.id)
  );

  if (candidates.length === 0) {
    return null;
  }

  const weakOrUncertainKeys = new Set(
    competencyProgress
      .filter((c) => c.status === 'not_enough_evidence' || c.status === 'emerging')
      .map((c) => c.competencyKey)
  );

  const scored = candidates.map((scenario) => {
    let score = 0;
    const matchedWeak = scenario.competencies.filter((c) => weakOrUncertainKeys.has(c));
    const matchedInterest = userInterests.some(
      (i) =>
        scenario.domainTitle.toLowerCase().includes(i.toLowerCase()) ||
        scenario.topicTitle.toLowerCase().includes(i.toLowerCase())
    );
    score += matchedWeak.length * 3;
    if (matchedInterest) score += 2;
    if (scenario.difficulty === 'beginner' || scenario.difficulty === 'intermediate') {
      score += 1;
    }
    return { scenario, score, matchedWeak, matchedInterest };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];

  let reason = `Recommended in ${top.scenario.domainTitle} to build practical reasoning across ${top.scenario.competencies.slice(0, 2).join(' and ')}.`;
  if (top.matchedWeak.length > 0) {
    reason = `Focuses on ${top.matchedWeak[0].replace(/_/g, ' ')}, where recent practice has limited or emerging evidence.`;
  } else if (top.matchedInterest) {
    reason = `Matches your stated interest in ${top.scenario.domainTitle} (${top.scenario.difficulty} level).`;
  }

  return {
    scenario: top.scenario,
    reason,
  };
}

export interface PracticeQueueRecommendation extends PracticeRecommendation {
  tag: 'primary' | 'reinforcement' | 'stretch';
}

export interface PracticeRecommendationQueue {
  primary: PracticeQueueRecommendation | null;
  alternatives: PracticeQueueRecommendation[];
}

/**
 * Returns one primary recommendation plus up to 2 reinforcement/stretch alternatives
 * (per COMPETENCY_ROADMAP.md Section 5).
 */
export function recommendPracticeQueue(params: {
  scenarios: readonly ScenarioItem[];
  completedScenarioIds: ReadonlySet<string>;
  dismissedScenarioIds: ReadonlySet<string>;
  competencyProgress: readonly CompetencyAggregate[];
  userInterests: readonly string[];
}): PracticeRecommendationQueue {
  const {
    scenarios,
    completedScenarioIds,
    dismissedScenarioIds,
    competencyProgress,
    userInterests,
  } = params;

  const candidates = scenarios.filter(
    (s) =>
      s.status === 'published' &&
      !completedScenarioIds.has(s.id) &&
      !dismissedScenarioIds.has(s.id)
  );

  if (candidates.length === 0) {
    return { primary: null, alternatives: [] };
  }

  const weakOrUncertainKeys = new Set(
    competencyProgress
      .filter((c) => c.status === 'not_enough_evidence' || c.status === 'emerging')
      .map((c) => c.competencyKey)
  );

  const developingOrConsistentKeys = new Set(
    competencyProgress
      .filter((c) => c.status === 'developing' || c.status === 'consistent')
      .map((c) => c.competencyKey)
  );

  const scored = candidates.map((scenario) => {
    let score = 0;
    const matchedWeak = scenario.competencies.filter((c) => weakOrUncertainKeys.has(c));
    const matchedReinforce = scenario.competencies.filter((c) =>
      developingOrConsistentKeys.has(c)
    );
    const matchedInterest = userInterests.some(
      (i) =>
        scenario.domainTitle.toLowerCase().includes(i.toLowerCase()) ||
        scenario.topicTitle.toLowerCase().includes(i.toLowerCase())
    );
    score += matchedWeak.length * 3;
    if (matchedInterest) score += 2;
    if (scenario.difficulty === 'beginner' || scenario.difficulty === 'intermediate') {
      score += 1;
    }

    let reason = `Recommended in ${scenario.domainTitle} to build practical reasoning across ${scenario.competencies
      .slice(0, 2)
      .map((c) => c.replace(/_/g, ' '))
      .join(' and ')}.`;
    if (matchedWeak.length > 0) {
      reason = `Focuses on ${matchedWeak[0].replace(
        /_/g,
        ' '
      )}, where recent practice has limited or emerging evidence.`;
    } else if (matchedInterest) {
      reason = `Matches your stated interest in ${scenario.domainTitle} (${scenario.difficulty} level).`;
    }

    const tag: 'reinforcement' | 'stretch' =
      scenario.difficulty === 'advanced' || matchedReinforce.length === 0
        ? 'stretch'
        : 'reinforcement';

    return { scenario, score, reason, tag };
  });

  scored.sort((a, b) => b.score - a.score);
  const [first, ...rest] = scored;

  return {
    primary: first
      ? {
          scenario: first.scenario,
          reason: first.reason,
          tag: 'primary',
        }
      : null,
    alternatives: rest.slice(0, 2).map((item) => ({
      scenario: item.scenario,
      reason: item.reason,
      tag: item.tag,
    })),
  };
}

export interface DebatePointBreakdown {
  bestApproachPts: number;
  questionBackPts: number;
  clarificationPts: number;
  tradeoffDefensePts: number;
  totalPoints: number;
  badges: string[];
}

export interface RoomParticipantStanding {
  uid: string;
  displayName: string;
  role: string;
  bestApproachPts: number;
  questionBackPts: number;
  clarificationPts: number;
  tradeoffDefensePts: number;
  totalPoints: number;
  badges: string[];
  contributionCount: number;
  questionsAskedCount: number;
}

/**
 * Computes points and recognition badges from an AI evaluation report and user messages.
 * Rewards Questioning Back, Best Clarification, Best Technical Approach, and Trade-Off Defense.
 */
export function computeUserDebatePoints(
  report: EvaluationReportPayload | null,
  userMessages: readonly Pick<
    SessionMessage,
    'body' | 'phase' | 'replyToMessageId' | 'messageType'
  >[]
): DebatePointBreakdown {
  const activeMsgs = userMessages.filter(
    (m) => m.messageType === 'text' || m.messageType === 'code'
  );
  const questionsCount = activeMsgs.filter(
    (m) =>
      m.body.includes('?') ||
      m.phase === 'cross_questioning' ||
      Boolean(m.replyToMessageId)
  ).length;

  const getDimRating = (key: RubricDimensionKey): number => {
    const dim = report?.dimensions.find((d) => d.key === key);
    if (!dim || dim.status !== 'scored' || dim.rating === null) return 0;
    return dim.rating;
  };

  const techRating = getDimRating('technical_accuracy');
  const reasoningRating = getDimRating('problem_solving_and_reasoning');
  const questionRating = getDimRating('question_quality');
  const clarityRating = getDimRating('explanation_clarity');
  const tradeoffRating = getDimRating('critical_thinking_and_tradeoffs');
  const collabRating = getDimRating('collaboration_and_adaptability');

  const bestApproachPts = Math.min(
    30,
    Math.round(((techRating + reasoningRating) / 8) * 24) +
      (activeMsgs.length > 0 ? 6 : 0)
  );
  const questionBackPts = Math.min(
    25,
    Math.round((questionRating / 4) * 17) + Math.min(8, questionsCount * 4)
  );
  const clarificationPts = Math.min(
    25,
    Math.round((clarityRating / 4) * 19) + (activeMsgs.length >= 2 ? 6 : 3)
  );
  const tradeoffDefensePts = Math.min(
    20,
    Math.round(((tradeoffRating + collabRating) / 8) * 20)
  );

  const totalPoints =
    bestApproachPts + questionBackPts + clarificationPts + tradeoffDefensePts;

  const badges: string[] = [];
  if (bestApproachPts >= 20) badges.push('Best Technical Approach');
  if (questionBackPts >= 15 || questionsCount >= 2)
    badges.push('Sharpest Question-Back');
  if (clarificationPts >= 18) badges.push('Best Clarification & Explanation');
  if (tradeoffDefensePts >= 14) badges.push('Trade-Off Defender');
  if (badges.length === 0 && activeMsgs.length > 0) {
    badges.push('Active Engineering Contributor');
  }

  return {
    bestApproachPts,
    questionBackPts,
    clarificationPts,
    tradeoffDefensePts,
    totalPoints,
    badges,
  };
}

/**
 * Computes room-wide standings across all joined/participating members in a discussion or debate room
 * so participants can see who earned points for Best Approach, Questioning Back, and Clarification.
 */
export function computeRoomParticipantStandings(
  participants: readonly { uid: string; displayName: string; role: string }[],
  messages: readonly Pick<
    SessionMessage,
    'senderUid' | 'senderDisplayName' | 'body' | 'phase' | 'replyToMessageId' | 'messageType'
  >[]
): RoomParticipantStanding[] {
  const participantMap = new Map<
    string,
    { uid: string; displayName: string; role: string }
  >();
  for (const p of participants) {
    participantMap.set(p.uid, p);
  }
  for (const m of messages) {
    if (!participantMap.has(m.senderUid)) {
      participantMap.set(m.senderUid, {
        uid: m.senderUid,
        displayName: m.senderDisplayName,
        role: 'participant',
      });
    }
  }

  const standings: RoomParticipantStanding[] = [];

  for (const member of participantMap.values()) {
    const memberMsgs = messages.filter(
      (m) =>
        m.senderUid === member.uid &&
        (m.messageType === 'text' || m.messageType === 'code')
    );
    const questionsAskedCount = memberMsgs.filter(
      (m) =>
        m.body.includes('?') ||
        m.phase === 'cross_questioning' ||
        Boolean(m.replyToMessageId)
    ).length;

    const hasInitialApproach = memberMsgs.some(
      (m) =>
        m.phase === 'initial_contributions' ||
        m.phase === 'introduction' ||
        m.body.length >= 60
    );
    const hasClarification = memberMsgs.some(
      (m) =>
        m.phase === 'open_discussion' ||
        m.phase === 'conclusion' ||
        Boolean(m.replyToMessageId) ||
        /because|example|specifically|means|clarify/i.test(m.body)
    );
    const hasTradeoff = memberMsgs.some((m) =>
      /trade-off|latency|throughput|cache|timeout|retry|consistency|memory|scale|bottleneck/i.test(
        m.body
      )
    );

    const bestApproachPts =
      memberMsgs.length === 0
        ? 0
        : Math.min(
            30,
            (hasInitialApproach ? 16 : 8) +
              Math.min(14, Math.floor(memberMsgs.reduce((a, b) => a + b.body.length, 0) / 35))
          );

    const questionBackPts =
      memberMsgs.length === 0
        ? 0
        : Math.min(25, questionsAskedCount * 10 + (questionsAskedCount > 0 ? 5 : 0));

    const clarificationPts =
      memberMsgs.length === 0
        ? 0
        : Math.min(
            25,
            (hasClarification ? 15 : 7) + Math.min(10, memberMsgs.length * 3)
          );

    const tradeoffDefensePts =
      memberMsgs.length === 0
        ? 0
        : Math.min(20, (hasTradeoff ? 14 : 6) + Math.min(6, memberMsgs.length * 2));

    const totalPoints =
      bestApproachPts + questionBackPts + clarificationPts + tradeoffDefensePts;

    const badges: string[] = [];
    if (bestApproachPts >= 20) badges.push('Best Approach');
    if (questionBackPts >= 15) badges.push('Question-Back Pro');
    if (clarificationPts >= 18) badges.push('Best Clarification');
    if (tradeoffDefensePts >= 14) badges.push('Trade-Off Analyst');

    standings.push({
      uid: member.uid,
      displayName: member.displayName,
      role: member.role,
      bestApproachPts,
      questionBackPts,
      clarificationPts,
      tradeoffDefensePts,
      totalPoints,
      badges,
      contributionCount: memberMsgs.length,
      questionsAskedCount,
    });
  }

  return standings.sort((a, b) => b.totalPoints - a.totalPoints);
}


