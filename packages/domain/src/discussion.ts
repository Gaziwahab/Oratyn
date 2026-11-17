import type {
  AiArenaMode,
  AiPersonaRole,
  DiscussionPhase,
  EngineeringLabData,
  ParticipantStatus,
  SessionMessage,
  SessionParticipant,
  SessionStatus,
  SessionSummary,
  SessionWaitlistEntry,
  UserReportCase,
} from './types';

export const MIN_ROOM_CAPACITY = 2;
export const MAX_ROOM_CAPACITY = 10;
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_SHARED_NOTES_LENGTH = 8000;

export const AI_ARENA_MODE_INFO: Record<
  AiArenaMode,
  {
    title: string;
    subtitle: string;
    defaultPersonas: readonly AiPersonaRole[];
  }
> = {
  mentor: {
    title: '1-on-1 AI Technical Mentor',
    subtitle:
      'Socratic engineering coach that probes your assumptions and helps you structure trade-offs step by step.',
    defaultPersonas: ['mentor_coach'],
  },
  interviewer: {
    title: '1-on-1 AI Mock Interviewer',
    subtitle:
      'Realistic system design & debugging interviewer that introduces shifting constraints and asks follow-up questions.',
    defaultPersonas: ['mock_interviewer'],
  },
  challenger: {
    title: '1-on-1 AI Critical Challenger',
    subtitle:
      'Stress-tests your proposed architecture or fix with failure modes, edge cases, and operational bottlenecks.',
    defaultPersonas: ['performance_engineer'],
  },
  teach_back: {
    title: '1-on-1 Teach-Back Coach',
    subtitle:
      'Explain a concept or design clearly; the AI identifies ambiguities and asks clarifying learner questions.',
    defaultPersonas: ['pragmatic_engineer'],
  },
  multi_perspective: {
    title: 'Multi-Perspective AI Engineering Panel',
    subtitle:
      'Debate your solution with distinct declared AI perspectives: System Architect, Security, Performance, and Pragmatic Engineer.',
    defaultPersonas: [
      'system_architect',
      'security_engineer',
      'performance_engineer',
      'pragmatic_engineer',
    ],
  },
};

export const AI_PERSONA_INFO: Record<
  AiPersonaRole,
  { displayName: string; badge: string; focus: string }
> = {
  system_architect: {
    displayName: 'System Architect [AI]',
    badge: 'AI · Architecture',
    focus: 'Service boundaries, scalability, data consistency, and failure isolation.',
  },
  security_engineer: {
    displayName: 'Security Engineer [AI]',
    badge: 'AI · Security',
    focus: 'Authentication, least privilege, tenant isolation, injection, and abuse vectors.',
  },
  performance_engineer: {
    displayName: 'Performance Engineer [AI]',
    badge: 'AI · Performance',
    focus: 'Tail latency (p95/p99), connection pools, lock contention, and read/write amplification.',
  },
  pragmatic_engineer: {
    displayName: 'Pragmatic Engineer [AI]',
    badge: 'AI · Pragmatism',
    focus: 'Operational simplicity, delivery speed, observability, and cost constraints.',
  },
  mentor_coach: {
    displayName: 'Engineering Mentor [AI]',
    badge: 'AI · Mentor',
    focus: 'Guided Socratic reasoning, clarifying assumptions, and structured explanation.',
  },
  mock_interviewer: {
    displayName: 'Technical Interviewer [AI]',
    badge: 'AI · Interviewer',
    focus: 'Structured requirements gathering, quantitative estimation, and deep-dive trade-offs.',
  },
};

export function canJoinWaitlist(params: {
  status: SessionStatus;
  participantCount: number;
  capacity: number;
  isAlreadyMember: boolean;
  isAlreadyWaitlisted: boolean;
}): { allowed: boolean; reason?: string } {
  if (params.isAlreadyMember) {
    return { allowed: false, reason: 'You are already a member of this session.' };
  }
  if (params.isAlreadyWaitlisted) {
    return { allowed: false, reason: 'You are already on the waitlist.' };
  }
  if (params.status !== 'open' && params.status !== 'scheduled' && params.status !== 'active') {
    return { allowed: false, reason: 'This session is closed.' };
  }
  if (params.participantCount < params.capacity) {
    return {
      allowed: false,
      reason: 'Seats are currently open—you can join the room directly.',
    };
  }
  return { allowed: true };
}

export function selectNextWaitlistCandidate(
  entries: readonly SessionWaitlistEntry[]
): SessionWaitlistEntry | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort(
    (a, b) => a.joinedAtMs - b.joinedAtMs || a.uid.localeCompare(b.uid)
  );
  return sorted[0];
}

const LAB_MARKER = '\n\n<!-- ENGINEERING_LAB_JSON:';
const LAB_END_MARKER = ':END_ENGINEERING_LAB_JSON -->';

export function extractSharedNotesAndLab(rawSharedNotes: string): {
  markdownNotes: string;
  labData: EngineeringLabData;
} {
  const defaultLab: EngineeringLabData = {
    diagramNodes: [
      { id: 'n_client', label: 'API Client', kind: 'client', notes: 'Sends HTTPS requests' },
      { id: 'n_service', label: 'Core Service', kind: 'service', notes: 'Stateless worker pool' },
      { id: 'n_db', label: 'Primary DB', kind: 'database', notes: 'Transactional store' },
    ],
    diagramEdges: [
      { id: 'e_1', fromId: 'n_client', toId: 'n_service', protocol: 'HTTPS' },
      { id: 'e_2', fromId: 'n_service', toId: 'n_db', protocol: 'SQLPool' },
    ],
    annotations: [],
  };

  const startIdx = rawSharedNotes.indexOf(LAB_MARKER);
  if (startIdx === -1) {
    return { markdownNotes: rawSharedNotes, labData: defaultLab };
  }

  const markdownNotes = rawSharedNotes.slice(0, startIdx);
  const jsonStart = startIdx + LAB_MARKER.length;
  const endIdx = rawSharedNotes.indexOf(LAB_END_MARKER, jsonStart);
  if (endIdx === -1) {
    return { markdownNotes, labData: defaultLab };
  }

  try {
    const parsed = JSON.parse(rawSharedNotes.slice(jsonStart, endIdx)) as Partial<EngineeringLabData>;
    return {
      markdownNotes,
      labData: {
        diagramNodes: Array.isArray(parsed.diagramNodes) ? parsed.diagramNodes.slice(0, 15) : defaultLab.diagramNodes,
        diagramEdges: Array.isArray(parsed.diagramEdges) ? parsed.diagramEdges.slice(0, 20) : defaultLab.diagramEdges,
        annotations: Array.isArray(parsed.annotations) ? parsed.annotations.slice(0, 25) : [],
      },
    };
  } catch {
    return { markdownNotes, labData: defaultLab };
  }
}

export function serializeSharedNotesAndLab(
  markdownNotes: string,
  labData: EngineeringLabData
): string {
  const cleanNotes = markdownNotes.replace(new RegExp(`${LAB_MARKER}[\\s\\S]*$`), '').trimEnd();
  const compactLab = JSON.stringify({
    diagramNodes: labData.diagramNodes.slice(0, 15),
    diagramEdges: labData.diagramEdges.slice(0, 20),
    annotations: labData.annotations.slice(0, 25),
  });
  const combined = `${cleanNotes}${LAB_MARKER}${compactLab}${LAB_END_MARKER}`;
  return combined.slice(0, MAX_SHARED_NOTES_LENGTH);
}

const ALLOWED_SESSION_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  draft: ['open', 'scheduled', 'cancelled'],
  open: ['scheduled', 'active', 'cancelled'],
  scheduled: ['open', 'active', 'cancelled'],
  active: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransitionSessionStatus(
  from: SessionStatus,
  to: SessionStatus
): boolean {
  return ALLOWED_SESSION_TRANSITIONS[from].includes(to);
}

const ACTIVE_DISCUSSION_SEQUENCE: readonly DiscussionPhase[] = [
  'introduction',
  'preparation',
  'initial_contributions',
  'cross_questioning',
  'open_discussion',
  'conclusion',
];

export const PHASE_METADATA: Record<
  DiscussionPhase,
  { label: string; guidance: string; participantAction: string }
> = {
  introduction: {
    label: 'Introduction',
    guidance: 'Moderator outlines the scenario, room norms, and discussion goal.',
    participantAction: 'Review the prompt and constraints.',
  },
  preparation: {
    label: 'Preparation',
    guidance: 'Think through assumptions, bottlenecks, and trade-offs independently.',
    participantAction: 'Draft your initial reasoning before sharing.',
  },
  initial_contributions: {
    label: 'Initial Contributions',
    guidance: 'Each participant shares an independent approach or passes without penalty.',
    participantAction: 'Post your initial approach or pass your turn.',
  },
  cross_questioning: {
    label: 'Cross-Questioning',
    guidance: 'Ask clarifying, probing, or assumption-testing questions about peer approaches.',
    participantAction: 'Ask a focused technical question or respond to one.',
  },
  open_discussion: {
    label: 'Open Discussion',
    guidance: 'Compare alternatives, adapt your approach, and weigh operational trade-offs.',
    participantAction: 'Refine your solution based on peer challenges.',
  },
  conclusion: {
    label: 'Conclusion',
    guidance: 'Summarize key takeaways, remaining uncertainties, and your revised position.',
    participantAction: 'Share a concise closing reflection.',
  },
  evaluation_pending: {
    label: 'Evaluation Pending',
    guidance: 'Session is complete. Private, evidence-linked AI feedback is being prepared.',
    participantAction: 'You may leave the room and view your report shortly.',
  },
  evaluation_complete: {
    label: 'Evaluation Ready',
    guidance: 'Your private formative report is available for review.',
    participantAction: 'Open your private report and inspect evidence.',
  },
};

export function getNextDiscussionPhase(
  current: DiscussionPhase
): DiscussionPhase | null {
  const index = ACTIVE_DISCUSSION_SEQUENCE.indexOf(current);
  if (index === -1 || index >= ACTIVE_DISCUSSION_SEQUENCE.length - 1) {
    return null;
  }
  return ACTIVE_DISCUSSION_SEQUENCE[index + 1];
}

export function canAdvancePhase(
  status: SessionStatus,
  current: DiscussionPhase,
  target: DiscussionPhase
): boolean {
  if (status !== 'active') {
    return false;
  }
  return getNextDiscussionPhase(current) === target;
}

export function canJoinSession(params: {
  status: SessionStatus;
  participantCount: number;
  capacity: number;
  existingParticipantStatus: ParticipantStatus | null;
}): { allowed: boolean; reason?: string } {
  const { status, participantCount, capacity, existingParticipantStatus } = params;

  if (existingParticipantStatus === 'removed') {
    return { allowed: false, reason: 'You were removed from this session.' };
  }
  if (existingParticipantStatus === 'joined') {
    return { allowed: true };
  }
  if (status !== 'open' && status !== 'scheduled' && status !== 'active') {
    return {
      allowed: false,
      reason: 'This session is no longer accepting new participants.',
    };
  }
  if (participantCount >= capacity || participantCount >= MAX_ROOM_CAPACITY) {
    return {
      allowed: false,
      reason: 'This session has reached its participant limit.',
    };
  }
  return { allowed: true };
}

export function computeNextTurnUid(
  participants: readonly SessionParticipant[],
  currentTurnUid: string | null
): string | null {
  const active = participants
    .filter((p) => p.status === 'joined')
    .sort((a, b) => a.joinedAtMs - b.joinedAtMs || a.uid.localeCompare(b.uid));

  if (active.length === 0) {
    return null;
  }
  if (!currentTurnUid) {
    return active[0].uid;
  }
  const currentIdx = active.findIndex((p) => p.uid === currentTurnUid);
  if (currentIdx === -1) {
    return active[0].uid;
  }
  return active[(currentIdx + 1) % active.length].uid;
}

export type MarkdownBlock =
  | { type: 'paragraph'; spans: InlineSpan[] }
  | { type: 'list'; items: InlineSpan[][] }
  | { type: 'code'; language: string; code: string };

export type InlineSpan =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; label: string; href: string };

const SAFE_URL_REGEX = /^https:\/\/[^\s<>"']+$/i;

export function isSafeHttpsUrl(url: string): boolean {
  return SAFE_URL_REGEX.test(url.trim());
}

export function parseInlineMarkdown(input: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const tokenRegex = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ type: 'text', text: input.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      spans.push({ type: 'code', text: token.slice(1, -1) });
    } else if (token.startsWith('**') && token.endsWith('**')) {
      spans.push({ type: 'bold', text: token.slice(2, -2) });
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/.exec(token);
      if (linkMatch && isSafeHttpsUrl(linkMatch[2])) {
        spans.push({ type: 'link', label: linkMatch[1], href: linkMatch[2] });
      } else {
        spans.push({ type: 'text', text: token });
      }
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < input.length) {
    spans.push({ type: 'text', text: input.slice(lastIndex) });
  }
  return spans;
}

/**
 * Parses a strictly safe subset of Markdown (paragraphs, bullet lists, fenced code blocks,
 * bold, inline code, and https-only links). Never emits raw HTML.
 */
export function parseSafeMarkdown(raw: string): MarkdownBlock[] {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const blocks: MarkdownBlock[] = [];
  const lines = normalized.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim().replace(/[^a-zA-Z0-9_-]/g, '');
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        i++; // skip closing fence
      }
      blocks.push({
        type: 'code',
        language: lang || 'text',
        code: codeLines.join('\n'),
      });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: InlineSpan[][] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(parseInlineMarkdown(lines[i].replace(/^\s*[-*]\s+/, '')));
        i++;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({
      type: 'paragraph',
      spans: parseInlineMarkdown(paraLines.join(' ')),
    });
  }

  return blocks;
}

export interface OperationalAnalyticsSummary {
  totalSessions: number;
  openOrScheduledCount: number;
  activeOrPausedCount: number;
  completedCount: number;
  completionRatePct: number;
  uniqueParticipantsCount: number;
  openModerationReportsCount: number;
  resolvedModerationReportsCount: number;
}

export function computeOperationalAnalytics(
  sessions: readonly Pick<
    SessionSummary,
    'status' | 'participantUids' | 'hostUid'
  >[],
  reports: readonly Pick<UserReportCase, 'status'>[]
): OperationalAnalyticsSummary {
  let openOrScheduledCount = 0;
  let activeOrPausedCount = 0;
  let completedCount = 0;
  const uniqueUids = new Set<string>();

  for (const s of sessions) {
    if (s.status === 'open' || s.status === 'scheduled') {
      openOrScheduledCount += 1;
    } else if (s.status === 'active' || s.status === 'paused') {
      activeOrPausedCount += 1;
    } else if (s.status === 'completed') {
      completedCount += 1;
    }
    if (s.hostUid) uniqueUids.add(s.hostUid);
    for (const uid of s.participantUids) {
      uniqueUids.add(uid);
    }
  }

  const startedTotal = activeOrPausedCount + completedCount;
  const completionRatePct =
    startedTotal > 0 ? Math.round((completedCount / startedTotal) * 100) : 0;

  let openModerationReportsCount = 0;
  let resolvedModerationReportsCount = 0;
  for (const r of reports) {
    if (r.status === 'open' || r.status === 'under_review') {
      openModerationReportsCount += 1;
    } else {
      resolvedModerationReportsCount += 1;
    }
  }

  return {
    totalSessions: sessions.length,
    openOrScheduledCount,
    activeOrPausedCount,
    completedCount,
    completionRatePct,
    uniqueParticipantsCount: uniqueUids.size,
    openModerationReportsCount,
    resolvedModerationReportsCount,
  };
}

export interface ParticipantContributionStat {
  uid: string;
  displayName: string;
  role: SessionParticipant['role'];
  messageCount: number;
  passCount: number;
  sharePct: number;
}

export interface RoomContributionDistribution {
  totalContributions: number;
  balanceStatus: 'early_stage' | 'balanced' | 'skewed';
  perParticipant: ParticipantContributionStat[];
  quieterParticipants: { uid: string; displayName: string }[];
}

/**
 * Computes non-punitive room participation distribution as a fairness diagnostic
 * (per DISCUSSION_ENGINE.md Section 6 & ANALYTICS_SUCCESS_METRICS.md Section 2).
 * Never used as a skill score.
 */
export function computeRoomContributionDistribution(
  participants: readonly Pick<
    SessionParticipant,
    'uid' | 'displayName' | 'role' | 'status'
  >[],
  messages: readonly Pick<SessionMessage, 'senderUid' | 'messageType'>[]
): RoomContributionDistribution {
  const joined = participants.filter((p) => p.status === 'joined');
  const msgCounts = new Map<string, number>();
  const passCounts = new Map<string, number>();
  let totalContributions = 0;

  for (const m of messages) {
    if (m.messageType === 'pass') {
      passCounts.set(m.senderUid, (passCounts.get(m.senderUid) ?? 0) + 1);
    } else if (m.messageType === 'text' || m.messageType === 'code') {
      msgCounts.set(m.senderUid, (msgCounts.get(m.senderUid) ?? 0) + 1);
      totalContributions += 1;
    }
  }

  const perParticipant: ParticipantContributionStat[] = joined.map((p) => {
    const messageCount = msgCounts.get(p.uid) ?? 0;
    const passCount = passCounts.get(p.uid) ?? 0;
    const sharePct =
      totalContributions > 0
        ? Math.round((messageCount / totalContributions) * 100)
        : 0;
    return {
      uid: p.uid,
      displayName: p.displayName,
      role: p.role,
      messageCount,
      passCount,
      sharePct,
    };
  });

  let balanceStatus: RoomContributionDistribution['balanceStatus'] =
    'early_stage';
  if (joined.length >= 2 && totalContributions >= joined.length) {
    const maxShare = Math.max(...perParticipant.map((p) => p.sharePct), 0);
    const anyZero = perParticipant.some((p) => p.messageCount === 0);
    balanceStatus = maxShare > 65 || anyZero ? 'skewed' : 'balanced';
  }

  const avgCount =
    joined.length > 0 ? totalContributions / joined.length : 0;
  const quieterParticipants =
    joined.length >= 2 && totalContributions >= 2
      ? perParticipant
          .filter((p) => p.messageCount === 0 || p.messageCount < avgCount * 0.5)
          .map((p) => ({ uid: p.uid, displayName: p.displayName }))
      : [];

  return {
    totalContributions,
    balanceStatus,
    perParticipant,
    quieterParticipants,
  };
}



