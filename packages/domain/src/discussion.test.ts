import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_ARENA_MODE_INFO,
  AI_PERSONA_INFO,
  canAdvancePhase,
  canJoinSession,
  canJoinWaitlist,
  canTransitionSessionStatus,
  computeNextTurnUid,
  computeOperationalAnalytics,
  computeRoomContributionDistribution,
  extractSharedNotesAndLab,
  getNextDiscussionPhase,
  parseSafeMarkdown,
  selectNextWaitlistCandidate,
  serializeSharedNotesAndLab,
} from './discussion';
import type { SessionParticipant } from './types';

test('session lifecycle transitions enforce terminal state lock', () => {
  assert.equal(canTransitionSessionStatus('open', 'active'), true);
  assert.equal(canTransitionSessionStatus('active', 'paused'), true);
  assert.equal(canTransitionSessionStatus('paused', 'active'), true);
  assert.equal(canTransitionSessionStatus('active', 'completed'), true);
  assert.equal(canTransitionSessionStatus('completed', 'active'), false);
  assert.equal(canTransitionSessionStatus('cancelled', 'open'), false);
});

test('discussion phase advances strictly in sequence when active', () => {
  assert.equal(getNextDiscussionPhase('introduction'), 'preparation');
  assert.equal(getNextDiscussionPhase('conclusion'), null);
  assert.equal(canAdvancePhase('active', 'introduction', 'preparation'), true);
  assert.equal(canAdvancePhase('paused', 'introduction', 'preparation'), false);
  assert.equal(canAdvancePhase('active', 'introduction', 'open_discussion'), false);
});

test('join capacity prevents exceeding 2-10 participant limits', () => {
  assert.equal(
    canJoinSession({
      status: 'open',
      participantCount: 9,
      capacity: 10,
      existingParticipantStatus: null,
    }).allowed,
    true
  );
  assert.equal(
    canJoinSession({
      status: 'open',
      participantCount: 10,
      capacity: 10,
      existingParticipantStatus: null,
    }).allowed,
    false
  );
  assert.equal(
    canJoinSession({
      status: 'open',
      participantCount: 2,
      capacity: 6,
      existingParticipantStatus: 'removed',
    }).allowed,
    false
  );
  // Already joined member can re-enter even when room is at capacity
  assert.equal(
    canJoinSession({
      status: 'active',
      participantCount: 10,
      capacity: 10,
      existingParticipantStatus: 'joined',
    }).allowed,
    true
  );
});

test('turn order rotates deterministically among joined participants', () => {
  const participants: SessionParticipant[] = [
    { uid: 'u2', sessionId: 's1', displayName: 'B', role: 'participant', status: 'joined', joinedAtMs: 200, leftAtMs: null },
    { uid: 'u1', sessionId: 's1', displayName: 'A', role: 'host', status: 'joined', joinedAtMs: 100, leftAtMs: null },
    { uid: 'u3', sessionId: 's1', displayName: 'C', role: 'participant', status: 'left', joinedAtMs: 300, leftAtMs: 400 },
  ];
  assert.equal(computeNextTurnUid(participants, null), 'u1');
  assert.equal(computeNextTurnUid(participants, 'u1'), 'u2');
  assert.equal(computeNextTurnUid(participants, 'u2'), 'u1');
});

test('safe markdown blocks javascript links and raw HTML execution', () => {
  const blocks = parseSafeMarkdown(
    'Check [bad](javascript:alert(1)) and [docs](https://example.com) and <script>alert(1)</script>\n```ts\nconst x = 1;\n```'
  );
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'paragraph');
  if (blocks[0].type === 'paragraph') {
    const links = blocks[0].spans.filter((s) => s.type === 'link');
    assert.equal(links.length, 1);
    assert.equal(links[0].href, 'https://example.com');
    const rawText = blocks[0].spans.map((s) => ('text' in s ? s.text : '')).join(' ');
    assert.ok(rawText.includes('javascript:alert(1)'));
  }
  assert.equal(blocks[1].type, 'code');
});

test('waitlist eligibility only allows full active/open/scheduled sessions and FIFO order', () => {
  assert.equal(
    canJoinWaitlist({
      status: 'open',
      participantCount: 4,
      capacity: 4,
      isAlreadyMember: false,
      isAlreadyWaitlisted: false,
    }).allowed,
    true
  );
  assert.equal(
    canJoinWaitlist({
      status: 'open',
      participantCount: 2,
      capacity: 4,
      isAlreadyMember: false,
      isAlreadyWaitlisted: false,
    }).allowed,
    false
  );
  const next = selectNextWaitlistCandidate([
    { uid: 'u9', sessionId: 's1', displayName: 'Late', joinedAtMs: 500 },
    { uid: 'u2', sessionId: 's1', displayName: 'Early', joinedAtMs: 100 },
  ]);
  assert.equal(next?.uid, 'u2');
});

test('all AI Arena personas carry explicit [AI] disclosure labels', () => {
  for (const persona of Object.values(AI_PERSONA_INFO)) {
    assert.ok(persona.displayName.includes('[AI]'));
    assert.ok(persona.badge.startsWith('AI'));
  }
  assert.equal(AI_ARENA_MODE_INFO.multi_perspective.defaultPersonas.length, 4);
});

test('engineering lab diagram and code review annotations round-trip inside sharedNotes', () => {
  const initial = extractSharedNotesAndLab('# Notes\nHello');
  assert.equal(initial.markdownNotes, '# Notes\nHello');
  assert.equal(initial.labData.diagramNodes.length, 3);

  const updated = serializeSharedNotesAndLab('# Updated Notes', {
    diagramNodes: [{ id: 'n1', label: 'Redis Cache', kind: 'cache', notes: 'TTL 60s' }],
    diagramEdges: [],
    annotations: [
      {
        id: 'a1',
        authorUid: 'u1',
        authorName: 'Alex',
        lineNumber: 12,
        severity: 'risk',
        comment: 'Missing webhook signature check',
        createdAtMs: 1000,
      },
    ],
  });
  const parsed = extractSharedNotesAndLab(updated);
  assert.equal(parsed.markdownNotes, '# Updated Notes');
  assert.equal(parsed.labData.diagramNodes[0].label, 'Redis Cache');
  assert.equal(parsed.labData.annotations[0].lineNumber, 12);
});

test('computeOperationalAnalytics aggregates session lifecycle and moderation stats', () => {
  const summary = computeOperationalAnalytics(
    [
      { status: 'open', hostUid: 'u1', participantUids: ['u1', 'u2'] },
      { status: 'active', hostUid: 'u2', participantUids: ['u2', 'u3'] },
      { status: 'completed', hostUid: 'u1', participantUids: ['u1', 'u3'] },
    ],
    [{ status: 'open' }, { status: 'resolved' }]
  );
  assert.equal(summary.totalSessions, 3);
  assert.equal(summary.openOrScheduledCount, 1);
  assert.equal(summary.activeOrPausedCount, 1);
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.completionRatePct, 50);
  assert.equal(summary.uniqueParticipantsCount, 3);
  assert.equal(summary.openModerationReportsCount, 1);
  assert.equal(summary.resolvedModerationReportsCount, 1);
});

test('computeRoomContributionDistribution identifies skewed participation and quieter members', () => {
  const dist = computeRoomContributionDistribution(
    [
      { uid: 'u1', displayName: 'Alice', role: 'host', status: 'joined' },
      { uid: 'u2', displayName: 'Bob', role: 'participant', status: 'joined' },
    ],
    [
      { senderUid: 'u1', messageType: 'text' },
      { senderUid: 'u1', messageType: 'code' },
      { senderUid: 'u2', messageType: 'pass' },
    ]
  );
  assert.equal(dist.totalContributions, 2);
  assert.equal(dist.balanceStatus, 'skewed');
  assert.equal(dist.quieterParticipants.length, 1);
  assert.equal(dist.quieterParticipants[0].uid, 'u2');
});




