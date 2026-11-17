import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  isLocalTestPreview,
  OperationType,
} from '../../lib/firebase';
import { fetchPublishedCatalogue } from '../catalogue/catalogueService';
import {
  AI_PERSONA_INFO,
  canAdvancePhase,
  canJoinSession,
  canJoinWaitlist,
  canTransitionSessionStatus,
  computeNextTurnUid,
  getNextDiscussionPhase,
} from '../../../packages/domain/src/discussion';
import {
  computeRoomParticipantStandings,
  computeUserDebatePoints,
} from '../../../packages/domain/src/evaluation';
import type {
  AiArenaMode,
  AiPersonaRole,
  ArenaMessage,
  ArenaSessionSummary,
  AuditEventRecord,
  CompetencyObservation,
  DiscussionPhase,
  ModerationAction,
  ModerationStatus,
  ReportCategory,
  ScenarioItem,
  SessionEvent,
  SessionMessage,
  SessionParticipant,
  SessionStatus,
  SessionSummary,
  SessionWaitlistEntry,
  SkillPassportRecord,
  UserEvaluationRecord,
  UserProfile,
  UserReportCase,
} from '../../../packages/domain/src/types';
import {
  CreateReportSchema,
  CreateSessionSchema,
  ResolveReportSchema,
  SendMessageSchema,
  UpdateSharedNotesSchema,
} from '../../../packages/validation/src/schemas';
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  ArenaTurnResponseData,
  GenerateEvaluationResponseData,
  MediaTokenResponseData,
} from '../../../packages/contracts/src/api';

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

function makeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

function mapSessionDoc(id: string, d: Record<string, unknown>): SessionSummary {
  const caps = (d.roomCapabilities as SessionSummary['roomCapabilities']) ?? {
    textEnabled: true,
    audioVideoPlanned: true,
    sharedWorkspacePlanned: true,
    mediaProvider: 'livekit',
    mediaMode: 'text_only_mvp',
  };

  return {
    id,
    scenarioId: String(d.scenarioId ?? ''),
    scenarioSlug: String(d.scenarioSlug ?? ''),
    scenarioTitle: String(d.scenarioTitle ?? ''),
    roomType: d.roomType as SessionSummary['roomType'],
    difficulty: d.difficulty as SessionSummary['difficulty'],
    title: String(d.title ?? ''),
    hostUid: String(d.hostUid ?? ''),
    hostDisplayName: String(d.hostDisplayName ?? ''),
    status: d.status as SessionStatus,
    participationMode: d.participationMode as SessionSummary['participationMode'],
    visibility: (d.visibility as 'public' | 'private') ?? 'public',
    capacity: Number(d.capacity ?? 4),
    participantCount: Number(d.participantCount ?? 0),
    participantUids: Array.isArray(d.participantUids) ? (d.participantUids as string[]) : [],
    currentPhase: d.currentPhase as DiscussionPhase,
    phaseVersion: Number(d.phaseVersion ?? 1),
    activeTurnUid: typeof d.activeTurnUid === 'string' ? d.activeTurnUid : null,
    sharedNotes: typeof d.sharedNotes === 'string' ? d.sharedNotes : '',
    roomCapabilities: caps,
    startsAtMs: typeof d.startsAtMs === 'number' ? d.startsAtMs : null,
    closesAtMs: typeof d.closesAtMs === 'number' ? d.closesAtMs : null,
    completedAtMs: typeof d.completedAtMs === 'number' ? d.completedAtMs : null,
    createdAtMs: toMillis(d.createdAt),
    updatedAtMs: toMillis(d.updatedAt),
  };
}

export async function listPublicSessions(): Promise<SessionSummary[]> {
  if (isLocalTestPreview()) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, 'sessions'),
        where('visibility', '==', 'public'),
        limit(30)
      )
    );
    return snap.docs
      .map((d) => mapSessionDoc(d.id, d.data()))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'sessions');
  }
}

export const listDiscoverableSessions = listPublicSessions;

export async function listUserJoinedSessions(uid: string): Promise<SessionSummary[]> {
  if (isLocalTestPreview()) return [];
  try {
    const [joinedSnap, hostedSnap, publicList] = await Promise.all([
      getDocs(
        query(
          collection(db, 'sessions'),
          where('participantUids', 'array-contains', uid),
          limit(30)
        )
      ),
      getDocs(
        query(
          collection(db, 'sessions'),
          where('hostUid', '==', uid),
          limit(30)
        )
      ),
      listPublicSessions().catch(() => [] as SessionSummary[]),
    ]);

    const byId = new Map<string, SessionSummary>();
    for (const d of joinedSnap.docs) {
      byId.set(d.id, mapSessionDoc(d.id, d.data()));
    }
    for (const d of hostedSnap.docs) {
      byId.set(d.id, mapSessionDoc(d.id, d.data()));
    }

    // Also check public sessions where the user previously participated and left (0/capacity completed rooms)
    const uncheckedPublic = publicList.filter((s) => !byId.has(s.id));
    if (uncheckedPublic.length > 0) {
      const checks = await Promise.all(
        uncheckedPublic.map(async (s) => {
          try {
            const partSnap = await getDoc(doc(db, 'sessions', s.id, 'participants', uid));
            return partSnap.exists() ? s : null;
          } catch {
            return null;
          }
        })
      );
      for (const found of checks) {
        if (found) byId.set(found.id, found);
      }
    }

    return Array.from(byId.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'sessions');
  }
}

export async function autoGenerateEvaluationForCompletedSession(params: {
  uid: string;
  profile: UserProfile;
  sessionId: string;
}): Promise<void> {
  try {
    const [{ session, messages }, cat] = await Promise.all([
      getSessionWithMessages(params.sessionId, params.uid),
      fetchPublishedCatalogue(),
    ]);
    if (!session) return;
    const scenario =
      cat.scenarios.find((s) => s.id === session.scenarioId) ??
      cat.scenarios[0] ??
      null;
    if (!scenario) return;

    await generateAndSaveEvaluation({
      uid: params.uid,
      profile: params.profile,
      session,
      scenario,
      messages,
    });
  } catch {
    // Non-fatal background generation
  }
}

export async function reconcileStaleUserRooms(params: {
  uid: string;
  displayName: string;
  activeSessionId?: string | null;
  profile?: UserProfile | null;
}): Promise<number> {
  if (isLocalTestPreview()) return 0;
  try {
    const snap = await getDocs(
      query(
        collection(db, 'sessions'),
        where('participantUids', 'array-contains', params.uid),
        limit(30)
      )
    );

    const staleSessions = snap.docs
      .map((d) => mapSessionDoc(d.id, d.data()))
      .filter(
        (s) =>
          s.id !== params.activeSessionId &&
          s.status !== 'completed' &&
          s.status !== 'cancelled'
      );

    if (staleSessions.length === 0) return 0;

    let endedCount = 0;
    for (const stale of staleSessions) {
      try {
        const res = await leaveSessionRoom({
          sessionId: stale.id,
          uid: params.uid,
          displayName: params.displayName,
        });
        if (res.roomEnded) {
          endedCount += 1;
          if (params.profile) {
            void autoGenerateEvaluationForCompletedSession({
              uid: params.uid,
              profile: params.profile,
              sessionId: stale.id,
            });
          }
        }
      } catch {
        // continue reconciling other rooms
      }
    }
    return endedCount;
  } catch {
    return 0;
  }
}

export interface RealLeaderboardStandingRow {
  uid: string;
  displayName: string;
  roleLabel: string;
  sessionsCompleted: number;
  bestApproachPoints: number;
  questionBackPoints: number;
  clarificationPoints: number;
  defensePoints: number;
  totalPoints: number;
  badges: string[];
  isCurrentUser: boolean;
}

export async function fetchRealLeaderboardStandings(params: {
  currentUid: string;
  currentDisplayName: string;
  currentRoleLabel: string;
}): Promise<RealLeaderboardStandingRow[]> {
  const [publicSessions, myJoinedSessions, myEvaluations] = await Promise.all([
    listPublicSessions().catch(() => [] as SessionSummary[]),
    listUserJoinedSessions(params.currentUid).catch(() => [] as SessionSummary[]),
    listUserEvaluations(params.currentUid).catch(() => [] as UserEvaluationRecord[]),
  ]);

  const sessionMap = new Map<string, SessionSummary>();
  for (const s of [...publicSessions, ...myJoinedSessions]) {
    sessionMap.set(s.id, s);
  }
  const allSessions = Array.from(sessionMap.values());

  const userAgg = new Map<
    string,
    {
      uid: string;
      displayName: string;
      roleLabel: string;
      sessionIds: Set<string>;
      bestApproachPoints: number;
      questionBackPoints: number;
      clarificationPoints: number;
      defensePoints: number;
      badges: Set<string>;
    }
  >();

  const ensureUser = (uid: string, displayName: string, roleLabel?: string) => {
    let existing = userAgg.get(uid);
    if (!existing) {
      existing = {
        uid,
        displayName: displayName || 'Engineer',
        roleLabel:
          uid === params.currentUid
            ? params.currentRoleLabel
            : roleLabel || 'Engineering Room Participant',
        sessionIds: new Set<string>(),
        bestApproachPoints: 0,
        questionBackPoints: 0,
        clarificationPoints: 0,
        defensePoints: 0,
        badges: new Set<string>(),
      };
      userAgg.set(uid, existing);
    } else if (displayName && existing.displayName === 'Engineer') {
      existing.displayName = displayName;
    }
    return existing;
  };

  // Ensure current authenticated user is always represented with their real profile
  ensureUser(params.currentUid, params.currentDisplayName, params.currentRoleLabel);

  const evaluatedSessionIdsForCurrentUser = new Set(
    myEvaluations.map((ev) => ev.sessionId)
  );

  // Add points from current user's real AI Evaluation reports
  for (const ev of myEvaluations) {
    const entry = ensureUser(
      params.currentUid,
      params.currentDisplayName,
      params.currentRoleLabel
    );
    entry.sessionIds.add(ev.sessionId);
    const { messages } = await getSessionWithMessages(
      ev.sessionId,
      params.currentUid
    ).catch(() => ({ session: null, messages: [] as SessionMessage[] }));
    const userMsgs = messages.filter((m) => m.senderUid === params.currentUid);
    const pts = computeUserDebatePoints(ev.report, userMsgs);
    entry.bestApproachPoints += pts.bestApproachPts;
    entry.questionBackPoints += pts.questionBackPts;
    entry.clarificationPoints += pts.clarificationPts;
    entry.defensePoints += pts.tradeoffDefensePts;
    for (const b of pts.badges) {
      entry.badges.add(b);
    }
  }

  // Inspect real sessions in Firestore for participant transcripts & points
  await Promise.all(
    allSessions.slice(0, 20).map(async (sess) => {
      try {
        const [partSnap, msgSnap] = await Promise.all([
          getDocs(query(collection(db, 'sessions', sess.id, 'participants'), limit(15))),
          getDocs(
            query(
              collection(db, 'sessions', sess.id, 'messages'),
              orderBy('createdAt', 'asc'),
              limit(120)
            )
          ),
        ]);

        const parts: SessionParticipant[] = partSnap.docs.map((d) => {
          const data = d.data();
          return {
            uid: String(data.uid),
            sessionId: String(data.sessionId),
            displayName: String(data.displayName),
            role: data.role as SessionParticipant['role'],
            status: data.status as SessionParticipant['status'],
            joinedAtMs: toMillis(data.joinedAt),
            leftAtMs: typeof data.leftAtMs === 'number' ? data.leftAtMs : null,
            micEnabled: Boolean(data.micEnabled),
            camEnabled: Boolean(data.camEnabled),
            mediaMode: (data.mediaMode as SessionParticipant['mediaMode']) ?? 'text',
            mediaConsentGranted: Boolean(data.mediaConsentGranted),
          };
        });

        const msgs: SessionMessage[] = msgSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            sessionId: String(data.sessionId),
            senderUid: String(data.senderUid),
            senderDisplayName: String(data.senderDisplayName),
            body: String(data.body),
            messageType: data.messageType as SessionMessage['messageType'],
            phase: data.phase as DiscussionPhase,
            replyToMessageId:
              typeof data.replyToMessageId === 'string' ? data.replyToMessageId : null,
            clientMessageId: String(data.clientMessageId),
            createdAtMs: toMillis(data.createdAt),
            editedAtMs: typeof data.editedAtMs === 'number' ? data.editedAtMs : null,
            deletedAtMs: typeof data.deletedAtMs === 'number' ? data.deletedAtMs : null,
          };
        });

        // Ensure host and all participants are registered in real standings
        if (sess.hostUid && sess.hostDisplayName) {
          const hostEntry = ensureUser(sess.hostUid, sess.hostDisplayName);
          hostEntry.sessionIds.add(sess.id);
        }

        const standings = computeRoomParticipantStandings(parts, msgs);
        for (const st of standings) {
          const entry = ensureUser(st.uid, st.displayName);
          entry.sessionIds.add(sess.id);
          // Avoid double-counting if this session was already scored via currentUid's AI evaluation report
          if (
            st.uid === params.currentUid &&
            evaluatedSessionIdsForCurrentUser.has(sess.id)
          ) {
            continue;
          }
          entry.bestApproachPoints += st.bestApproachPts;
          entry.questionBackPoints += st.questionBackPts;
          entry.clarificationPoints += st.clarificationPts;
          entry.defensePoints += st.tradeoffDefensePts;
          for (const b of st.badges) {
            entry.badges.add(b);
          }
        }
      } catch {
        // skip unreadable private session
      }
    })
  );

  return Array.from(userAgg.values()).map((u) => {
    const totalPoints =
      u.bestApproachPoints +
      u.questionBackPoints +
      u.clarificationPoints +
      u.defensePoints;
    return {
      uid: u.uid,
      displayName: u.displayName,
      roleLabel: u.roleLabel,
      sessionsCompleted: u.sessionIds.size,
      bestApproachPoints: u.bestApproachPoints,
      questionBackPoints: u.questionBackPoints,
      clarificationPoints: u.clarificationPoints,
      defensePoints: u.defensePoints,
      totalPoints,
      badges: Array.from(u.badges),
      isCurrentUser: u.uid === params.currentUid,
    };
  });
}

export async function createSessionRoom(params: {
  scenario: ScenarioItem;
  hostUid: string;
  hostDisplayName: string;
  title: string;
  roomType: ScenarioItem['roomType'];
  participationMode: 'scheduled' | 'async';
  visibility: 'public' | 'private';
  capacity: number;
  startsAtMs: number | null;
}): Promise<string> {
  const parsed = CreateSessionSchema.parse({
    scenarioId: params.scenario.id,
    title: params.title,
    roomType: params.roomType,
    participationMode: params.participationMode,
    visibility: params.visibility,
    capacity: params.capacity,
    startsAtMs: params.startsAtMs,
  });

  const sessionId = makeId('sess');
  const sessionRef = doc(db, 'sessions', sessionId);
  const participantRef = doc(db, 'sessions', sessionId, 'participants', params.hostUid);
  const eventId = makeId('evt');
  const eventRef = doc(db, 'sessions', sessionId, 'events', eventId);

  try {
    await runTransaction(db, async (tx) => {
      tx.set(sessionRef, {
        id: sessionId,
        scenarioId: parsed.scenarioId,
        scenarioSlug: params.scenario.slug,
        scenarioTitle: params.scenario.title,
        roomType: parsed.roomType,
        difficulty: params.scenario.difficulty,
        title: parsed.title,
        hostUid: params.hostUid,
        hostDisplayName: params.hostDisplayName,
        status:
          parsed.participationMode === 'scheduled' && parsed.startsAtMs
            ? 'scheduled'
            : 'active',
        participationMode: parsed.participationMode,
        visibility: parsed.visibility,
        capacity: parsed.capacity,
        participantCount: 1,
        participantUids: [params.hostUid],
        currentPhase: 'initial_contributions',
        phaseVersion: 1,
        activeTurnUid: params.hostUid,
        sharedNotes: `# Shared Architecture & Problem Notes\n\nScenario: ${params.scenario.title}\n\nUse this space to capture key assumptions, constraints, and agreed trade-offs.`,
        roomCapabilities: {
          textEnabled: true,
          audioVideoPlanned: true,
          sharedWorkspacePlanned: true,
          mediaProvider: 'livekit',
          mediaMode: 'audio_video_live',
        },
        startsAtMs: parsed.startsAtMs,
        closesAtMs: null,
        completedAtMs: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.set(participantRef, {
        uid: params.hostUid,
        sessionId,
        displayName: params.hostDisplayName,
        role: 'host',
        status: 'joined',
        joinedAt: serverTimestamp(),
        leftAtMs: null,
        micEnabled: false,
        camEnabled: false,
        mediaMode: 'text',
        mediaConsentGranted: false,
      });

      tx.set(eventRef, {
        id: eventId,
        sessionId,
        actorUid: params.hostUid,
        eventType: 'session_created',
        summary: `${params.hostDisplayName} created the session.`,
        createdAt: serverTimestamp(),
      });
    });

    return sessionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `sessions/${sessionId}`);
  }
}

export async function joinSessionRoom(params: {
  sessionId: string;
  uid: string;
  displayName: string;
}): Promise<void> {
  const sessionRef = doc(db, 'sessions', params.sessionId);
  const participantRef = doc(db, 'sessions', params.sessionId, 'participants', params.uid);
  const eventId = makeId('evt');
  const eventRef = doc(db, 'sessions', params.sessionId, 'events', eventId);

  try {
    await runTransaction(db, async (tx) => {
      const [sessSnap, partSnap] = await Promise.all([
        tx.get(sessionRef),
        tx.get(participantRef),
      ]);

      if (!sessSnap.exists()) {
        throw new Error('Session not found.');
      }

      const sess = mapSessionDoc(sessSnap.id, sessSnap.data());
      const existingPart = partSnap.exists()
        ? (partSnap.data() as { status: SessionParticipant['status'] })
        : null;

      if (sess.participantUids.includes(params.uid) && existingPart?.status === 'joined') {
        return;
      }

      const check = canJoinSession({
        status: sess.status,
        participantCount: sess.participantCount,
        capacity: sess.capacity,
        existingParticipantStatus: existingPart?.status ?? null,
      });

      if (!check.allowed) {
        throw new Error(check.reason ?? 'Cannot join this session.');
      }

      tx.update(sessionRef, {
        participantCount: sess.participantCount + 1,
        participantUids: [...sess.participantUids, params.uid],
        updatedAt: serverTimestamp(),
      });

      if (partSnap.exists()) {
        tx.update(participantRef, {
          status: 'joined',
          leftAtMs: null,
        });
      } else {
        tx.set(participantRef, {
          uid: params.uid,
          sessionId: params.sessionId,
          displayName: params.displayName,
          role: 'participant',
          status: 'joined',
          joinedAt: serverTimestamp(),
          leftAtMs: null,
          micEnabled: false,
          camEnabled: false,
          mediaMode: 'text',
          mediaConsentGranted: false,
        });
      }

      tx.set(eventRef, {
        id: eventId,
        sessionId: params.sessionId,
        actorUid: params.uid,
        eventType: 'participant_joined',
        summary: `${params.displayName} joined the session.`,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('limit') || error.message.includes('Session'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `sessions/${params.sessionId}`);
  }
}

export async function leaveSessionRoom(params: {
  sessionId: string;
  uid: string;
  displayName: string;
}): Promise<{ roomEnded: boolean }> {
  const sessionRef = doc(db, 'sessions', params.sessionId);
  const participantRef = doc(
    db,
    'sessions',
    params.sessionId,
    'participants',
    params.uid
  );
  const eventId = makeId('evt');
  const eventRef = doc(db, 'sessions', params.sessionId, 'events', eventId);

  let roomEnded = false;

  try {
    await runTransaction(db, async (tx) => {
      const sessSnap = await tx.get(sessionRef);
      if (!sessSnap.exists()) return;
      const sess = mapSessionDoc(sessSnap.id, sessSnap.data());
      if (!sess.participantUids.includes(params.uid)) {
        roomEnded = sess.participantCount === 0 || sess.status === 'completed';
        return;
      }

      const nextUids = sess.participantUids.filter((id) => id !== params.uid);
      const nextCount = Math.max(0, nextUids.length);
      roomEnded = nextCount === 0;

      const sessionUpdates: Record<string, unknown> = {
        participantCount: nextCount,
        participantUids: nextUids,
        activeTurnUid:
          sess.activeTurnUid === params.uid
            ? nextUids[0] ?? null
            : sess.activeTurnUid,
        updatedAt: serverTimestamp(),
      };

      if (roomEnded) {
        sessionUpdates.status = 'completed';
        sessionUpdates.currentPhase = 'evaluation_pending';
        sessionUpdates.phaseVersion = sess.phaseVersion + 1;
        sessionUpdates.completedAtMs = Date.now();
        sessionUpdates.activeTurnUid = null;
      }

      tx.update(sessionRef, sessionUpdates);

      tx.update(participantRef, {
        status: 'left',
        leftAtMs: Date.now(),
        micEnabled: false,
        camEnabled: false,
        mediaMode: 'text',
      });

      tx.set(eventRef, {
        id: eventId,
        sessionId: params.sessionId,
        actorUid: params.uid,
        eventType: roomEnded ? 'session_completed' : 'participant_left',
        summary: roomEnded
          ? `${params.displayName} left the room. No active participants remain — session automatically ended for AI report & leaderboard scoring.`
          : `${params.displayName} left the session.`,
        createdAt: serverTimestamp(),
      });
    });

    return { roomEnded };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${params.sessionId}`);
  }
}

export async function updateParticipantMediaState(params: {
  sessionId: string;
  uid: string;
  micEnabled: boolean;
  camEnabled: boolean;
  mediaMode: 'text' | 'audio' | 'audio_video';
  mediaConsentGranted: boolean;
}): Promise<void> {
  const participantRef = doc(db, 'sessions', params.sessionId, 'participants', params.uid);
  try {
    await updateDoc(participantRef, {
      micEnabled: params.micEnabled,
      camEnabled: params.camEnabled,
      mediaMode: params.mediaMode,
      mediaConsentGranted: params.mediaConsentGranted,
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `sessions/${params.sessionId}/participants/${params.uid}`
    );
  }
}

export async function requestRoomMediaToken(params: {
  sessionId: string;
  mediaMode: 'audio' | 'audio_video';
  consentAccepted: true;
}): Promise<MediaTokenResponseData> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required.');
  }
  const idToken = await currentUser.getIdToken();
  const res = await fetch('/api/v1/media/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(errBody?.error?.message ?? 'Could not initialize Audio/Video room stage.');
  }

  const json = (await res.json()) as ApiSuccessResponse<MediaTokenResponseData>;
  return json.data;
}

export async function joinSessionWaitlist(params: {
  session: SessionSummary;
  uid: string;
  displayName: string;
  existingWaitlist: SessionWaitlistEntry[];
}): Promise<void> {
  const check = canJoinWaitlist({
    status: params.session.status,
    participantCount: params.session.participantCount,
    capacity: params.session.capacity,
    isAlreadyMember: params.session.participantUids.includes(params.uid),
    isAlreadyWaitlisted: params.existingWaitlist.some((w) => w.uid === params.uid),
  });
  if (!check.allowed) {
    throw new Error(check.reason ?? 'Cannot join waitlist.');
  }

  const waitRef = doc(db, 'sessions', params.session.id, 'waitlist', params.uid);
  try {
    await setDoc(waitRef, {
      uid: params.uid,
      sessionId: params.session.id,
      displayName: params.displayName,
      joinedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `sessions/${params.session.id}/waitlist/${params.uid}`
    );
  }
}

export async function leaveSessionWaitlist(params: {
  sessionId: string;
  uid: string;
}): Promise<void> {
  const waitRef = doc(db, 'sessions', params.sessionId, 'waitlist', params.uid);
  try {
    await deleteDoc(waitRef);
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `sessions/${params.sessionId}/waitlist/${params.uid}`
    );
  }
}

export async function transitionSessionLifecycle(params: {
  sessionId: string;
  actorUid: string;
  targetStatus: SessionStatus;
}): Promise<void> {
  const sessionRef = doc(db, 'sessions', params.sessionId);
  const eventId = makeId('evt');
  const eventRef = doc(db, 'sessions', params.sessionId, 'events', eventId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists()) throw new Error('Session not found.');
      const sess = mapSessionDoc(snap.id, snap.data());

      if (!canTransitionSessionStatus(sess.status, params.targetStatus)) {
        throw new Error(`Invalid transition from ${sess.status} to ${params.targetStatus}.`);
      }

      const updates: Record<string, unknown> = {
        status: params.targetStatus,
        updatedAt: serverTimestamp(),
      };

      if (params.targetStatus === 'completed') {
        updates.currentPhase = 'evaluation_pending';
        updates.phaseVersion = sess.phaseVersion + 1;
        updates.completedAtMs = Date.now();
      }

      tx.update(sessionRef, updates);

      const eventMap: Partial<Record<SessionStatus, SessionEvent['eventType']>> = {
        active: sess.status === 'paused' ? 'session_resumed' : 'session_started',
        paused: 'session_paused',
        completed: 'session_completed',
        cancelled: 'session_cancelled',
      };

      tx.set(eventRef, {
        id: eventId,
        sessionId: params.sessionId,
        actorUid: params.actorUid,
        eventType: eventMap[params.targetStatus] ?? 'phase_changed',
        summary: `Session status changed to ${params.targetStatus}.`,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid transition')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${params.sessionId}`);
  }
}

export async function advanceSessionPhase(params: {
  sessionId: string;
  actorUid: string;
}): Promise<void> {
  const sessionRef = doc(db, 'sessions', params.sessionId);
  const eventId = makeId('evt');
  const eventRef = doc(db, 'sessions', params.sessionId, 'events', eventId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists()) throw new Error('Session not found.');
      const sess = mapSessionDoc(snap.id, snap.data());
      const nextPhase = getNextDiscussionPhase(sess.currentPhase);
      if (!nextPhase || !canAdvancePhase(sess.status, sess.currentPhase, nextPhase)) {
        throw new Error('Cannot advance phase from the current state.');
      }

      tx.update(sessionRef, {
        currentPhase: nextPhase,
        phaseVersion: sess.phaseVersion + 1,
        updatedAt: serverTimestamp(),
      });

      tx.set(eventRef, {
        id: eventId,
        sessionId: params.sessionId,
        actorUid: params.actorUid,
        eventType: 'phase_changed',
        summary: `Moved to phase: ${nextPhase.replace(/_/g, ' ')}.`,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot advance')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${params.sessionId}`);
  }
}

export async function setNextTurnParticipant(params: {
  sessionId: string;
  actorUid: string;
  targetUid: string;
  targetDisplayName: string;
}): Promise<void> {
  const sessionRef = doc(db, 'sessions', params.sessionId);
  const eventId = makeId('evt');
  const eventRef = doc(db, 'sessions', params.sessionId, 'events', eventId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists()) throw new Error('Session not found.');
      tx.update(sessionRef, {
        activeTurnUid: params.targetUid,
        updatedAt: serverTimestamp(),
      });
      tx.set(eventRef, {
        id: eventId,
        sessionId: params.sessionId,
        actorUid: params.actorUid,
        eventType: 'turn_passed',
        summary: `Host invited ${params.targetDisplayName} for the next turn.`,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${params.sessionId}`);
  }
}

export async function removeParticipantFromSession(params: {
  sessionId: string;
  actorUid: string;
  targetUid: string;
  targetDisplayName: string;
  reason: string;
  recordAdminAudit?: boolean;
}): Promise<void> {
  const sessionRef = doc(db, 'sessions', params.sessionId);
  const partRef = doc(
    db,
    'sessions',
    params.sessionId,
    'participants',
    params.targetUid
  );
  const eventId = makeId('evt');
  const eventRef = doc(db, 'sessions', params.sessionId, 'events', eventId);

  try {
    await runTransaction(db, async (tx) => {
      const [sessSnap, partSnap] = await Promise.all([
        tx.get(sessionRef),
        tx.get(partRef),
      ]);
      if (!sessSnap.exists()) throw new Error('Session not found.');
      const sess = mapSessionDoc(sessSnap.id, sessSnap.data());
      if (params.targetUid === sess.hostUid) {
        throw new Error('Cannot remove the session host.');
      }

      const nextUids = sess.participantUids.filter(
        (id) => id !== params.targetUid
      );
      tx.update(sessionRef, {
        participantUids: nextUids,
        participantCount: Math.max(0, nextUids.length),
        activeTurnUid:
          sess.activeTurnUid === params.targetUid
            ? nextUids[0] ?? null
            : sess.activeTurnUid,
        updatedAt: serverTimestamp(),
      });

      if (partSnap.exists()) {
        tx.update(partRef, {
          status: 'removed',
          leftAtMs: Date.now(),
        });
      }

      tx.set(eventRef, {
        id: eventId,
        sessionId: params.sessionId,
        actorUid: params.actorUid,
        eventType: 'participant_removed',
        summary: `Removed ${params.targetDisplayName} from room (${params.reason.slice(
          0,
          120
        )}).`,
        createdAt: serverTimestamp(),
      });

      if (params.recordAdminAudit) {
        const auditId = makeId('aud');
        const auditRef = doc(db, 'auditEvents', auditId);
        tx.set(auditRef, {
          id: auditId,
          actorUid: params.actorUid,
          action: 'session.remove_participant',
          targetType: 'session',
          targetId: params.sessionId,
          outcome: 'succeeded',
          createdAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot remove')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${params.sessionId}`);
  }
}


export async function sendDiscussionMessage(params: {
  sessionId: string;
  senderUid: string;
  senderDisplayName: string;
  phase: DiscussionPhase;
  body: string;
  messageType: 'text' | 'code' | 'pass';
  replyToMessageId: string | null;
  clientMessageId: string;
  participants: SessionParticipant[];
  currentTurnUid: string | null;
}): Promise<void> {
  const parsed = SendMessageSchema.parse({
    sessionId: params.sessionId,
    body: params.body,
    messageType: params.messageType,
    replyToMessageId: params.replyToMessageId,
    clientMessageId: params.clientMessageId,
  });

  const messageRef = doc(
    db,
    'sessions',
    params.sessionId,
    'messages',
    parsed.clientMessageId
  );

  try {
    await setDoc(messageRef, {
      id: parsed.clientMessageId,
      sessionId: parsed.sessionId,
      senderUid: params.senderUid,
      senderDisplayName: params.senderDisplayName,
      body: parsed.body,
      messageType: parsed.messageType,
      phase: params.phase,
      replyToMessageId: parsed.replyToMessageId,
      clientMessageId: parsed.clientMessageId,
      createdAt: serverTimestamp(),
      editedAtMs: null,
      deletedAtMs: null,
    });

    const nextTurnUid = computeNextTurnUid(
      params.participants,
      params.currentTurnUid ?? params.senderUid
    );
    await updateDoc(doc(db, 'sessions', params.sessionId), {
      status: 'active',
      activeTurnUid: nextTurnUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `sessions/${params.sessionId}/messages`
    );
  }
}

export async function saveSharedWorkspaceNotes(params: {
  sessionId: string;
  sharedNotes: string;
}): Promise<void> {
  const parsed = UpdateSharedNotesSchema.parse(params);
  try {
    await updateDoc(doc(db, 'sessions', parsed.sessionId), {
      sharedNotes: parsed.sharedNotes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${parsed.sessionId}`);
  }
}

export function subscribeSessionRoom(params: {
  sessionId: string;
  isMember: boolean;
  onSession: (session: SessionSummary | null) => void;
  onParticipants: (participants: SessionParticipant[]) => void;
  onMessages: (messages: SessionMessage[]) => void;
  onEvents: (events: SessionEvent[]) => void;
  onWaitlist?: (waitlist: SessionWaitlistEntry[]) => void;
  onError: (err: Error) => void;
}): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      doc(db, 'sessions', params.sessionId),
      (snap) => {
        if (!snap.exists()) {
          params.onSession(null);
          return;
        }
        params.onSession(mapSessionDoc(snap.id, snap.data()));
      },
      (error) => params.onError(error)
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'sessions', params.sessionId, 'participants'), limit(12)),
      (snap) => {
        const list: SessionParticipant[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: String(data.uid),
            sessionId: String(data.sessionId),
            displayName: String(data.displayName),
            role: data.role as SessionParticipant['role'],
            status: data.status as SessionParticipant['status'],
            joinedAtMs: toMillis(data.joinedAt),
            leftAtMs: typeof data.leftAtMs === 'number' ? data.leftAtMs : null,
            micEnabled: Boolean(data.micEnabled),
            camEnabled: Boolean(data.camEnabled),
            mediaMode: (data.mediaMode as SessionParticipant['mediaMode']) ?? 'text',
            mediaConsentGranted: Boolean(data.mediaConsentGranted),
          };
        });
        params.onParticipants(list);
      },
      (error) => params.onError(error)
    )
  );

  if (params.onWaitlist) {
    unsubs.push(
      onSnapshot(
        query(collection(db, 'sessions', params.sessionId, 'waitlist'), limit(20)),
        (snap) => {
          const wait: SessionWaitlistEntry[] = snap.docs
            .map((d) => {
              const data = d.data();
              return {
                uid: String(data.uid),
                sessionId: String(data.sessionId),
                displayName: String(data.displayName),
                joinedAtMs: toMillis(data.joinedAt),
              };
            })
            .sort((a, b) => a.joinedAtMs - b.joinedAtMs);
          params.onWaitlist?.(wait);
        },
        (error) => params.onError(error)
      )
    );
  }

  if (params.isMember) {
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'sessions', params.sessionId, 'messages'),
          orderBy('createdAt', 'asc'),
          limit(100)
        ),
        (snap) => {
          const msgs: SessionMessage[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              sessionId: String(data.sessionId),
              senderUid: String(data.senderUid),
              senderDisplayName: String(data.senderDisplayName),
              body: String(data.body),
              messageType: data.messageType as SessionMessage['messageType'],
              phase: data.phase as DiscussionPhase,
              replyToMessageId:
                typeof data.replyToMessageId === 'string' ? data.replyToMessageId : null,
              clientMessageId: String(data.clientMessageId),
              createdAtMs: toMillis(data.createdAt),
              editedAtMs: typeof data.editedAtMs === 'number' ? data.editedAtMs : null,
              deletedAtMs: typeof data.deletedAtMs === 'number' ? data.deletedAtMs : null,
            };
          });
          params.onMessages(msgs);
        },
        (error) => params.onError(error)
      )
    );

    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'sessions', params.sessionId, 'events'),
          orderBy('createdAt', 'desc'),
          limit(25)
        ),
        (snap) => {
          const evts: SessionEvent[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              sessionId: String(data.sessionId),
              actorUid: String(data.actorUid),
              eventType: data.eventType as SessionEvent['eventType'],
              summary: String(data.summary),
              createdAtMs: toMillis(data.createdAt),
            };
          });
          params.onEvents(evts);
        },
        (error) => params.onError(error)
      )
    );
  }

  return () => {
    for (const u of unsubs) u();
  };
}

export async function generateAndSaveEvaluation(params: {
  uid: string;
  profile: UserProfile;
  session: SessionSummary;
  scenario: ScenarioItem;
  messages: SessionMessage[];
}): Promise<UserEvaluationRecord> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== params.uid) {
    throw new Error('Authentication required.');
  }

  const evalId = `eval_${params.session.id}`;
  const evalRef = doc(db, 'users', params.uid, 'evaluations', evalId);

  const existingSnap = await getDoc(evalRef);
  if (existingSnap.exists() && existingSnap.data().status === 'completed') {
    const d = existingSnap.data();
    return {
      id: existingSnap.id,
      uid: d.uid,
      sessionId: d.sessionId,
      scenarioId: d.scenarioId,
      scenarioTitle: d.scenarioTitle,
      rubricVersion: d.rubricVersion,
      promptVersion: d.promptVersion,
      provider: d.provider,
      model: d.model,
      status: d.status,
      report: d.report ?? null,
      errorCode: d.errorCode ?? null,
      feedbackUseful: d.feedbackUseful ?? null,
      flaggedForReview: Boolean(d.flaggedForReview),
      flagReason: d.flagReason ?? null,
      createdAtMs: toMillis(d.createdAt),
      completedAtMs: typeof d.completedAtMs === 'number' ? d.completedAtMs : null,
    };
  }

  const idToken = await currentUser.getIdToken();
  const payload = {
    sessionId: params.session.id,
    scenario: {
      id: params.scenario.id,
      title: params.scenario.title,
      context: params.scenario.context,
      prompt: params.scenario.prompt,
      constraints: params.scenario.constraints,
      learningObjectives: params.scenario.learningObjectives,
      rubricVersion: params.scenario.rubricVersion,
    },
    targetParticipant: {
      pseudonym: params.profile.displayName,
      experienceBand: params.profile.experienceBand,
    },
    messages: params.messages
      .filter((m) => !m.deletedAtMs)
      .slice(-120)
      .map((m) => ({
        id: m.id,
        authorRole: (m.senderUid === params.uid ? 'target' : 'peer') as 'target' | 'peer',
        authorPseudonym:
          m.senderUid === params.uid ? params.profile.displayName : 'PeerParticipant',
        phase: m.phase,
        messageType: m.messageType,
        body: m.body,
        createdAtMs: m.createdAtMs,
      })),
  };

  const res = await fetch('/api/v1/evaluations/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(
      errBody?.error?.message ?? 'Evaluation provider could not generate your report right now.'
    );
  }

  const json = (await res.json()) as ApiSuccessResponse<GenerateEvaluationResponseData>;
  const data = json.data;
  const completedAtMs = Date.now();

  try {
    await setDoc(evalRef, {
      id: evalId,
      uid: params.uid,
      sessionId: params.session.id,
      scenarioId: params.scenario.id,
      scenarioTitle: params.scenario.title,
      rubricVersion: data.rubricVersion,
      promptVersion: data.promptVersion,
      provider: data.provider,
      model: data.model,
      status: 'completed',
      report: data.report,
      errorCode: null,
      feedbackUseful: null,
      flaggedForReview: false,
      flagReason: null,
      createdAt: serverTimestamp(),
      completedAtMs,
    });

    const scoredDims = data.report.dimensions.filter(
      (d) => d.status === 'scored' && d.rating !== null
    );
    const avgScore =
      scoredDims.length > 0
        ? Math.round(
            scoredDims.reduce((acc, d) => acc + (d.rating ?? 0), 0) / scoredDims.length
          )
        : null;

    if (avgScore !== null) {
      for (const compKey of params.scenario.competencies) {
        const obsId = `obs_${params.session.id}_${compKey}`;
        await setDoc(doc(db, 'users', params.uid, 'competencyObservations', obsId), {
          id: obsId,
          uid: params.uid,
          competencyKey: compKey,
          sessionId: params.session.id,
          evaluationId: evalId,
          rating: avgScore,
          confidence: data.report.confidence,
          rubricVersion: data.rubricVersion,
          observedAt: serverTimestamp(),
        });
      }
    }

    return {
      id: evalId,
      uid: params.uid,
      sessionId: params.session.id,
      scenarioId: params.scenario.id,
      scenarioTitle: params.scenario.title,
      rubricVersion: data.rubricVersion,
      promptVersion: data.promptVersion,
      provider: data.provider,
      model: data.model,
      status: 'completed',
      report: data.report,
      errorCode: null,
      feedbackUseful: null,
      flaggedForReview: false,
      flagReason: null,
      createdAtMs: completedAtMs,
      completedAtMs,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${params.uid}/evaluations/${evalId}`);
  }
}

export async function getUserEvaluationForSession(
  uid: string,
  sessionId: string
): Promise<UserEvaluationRecord | null> {
  const evalId = `eval_${sessionId}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'evaluations', evalId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: snap.id,
      uid: String(d.uid),
      sessionId: String(d.sessionId),
      scenarioId: String(d.scenarioId),
      scenarioTitle: String(d.scenarioTitle),
      rubricVersion: Number(d.rubricVersion ?? 1),
      promptVersion: String(d.promptVersion ?? 'eval-v1'),
      provider: String(d.provider ?? 'gemini'),
      model: String(d.model ?? 'gemini-3-flash-preview'),
      status: d.status as UserEvaluationRecord['status'],
      report: d.report ?? null,
      errorCode: d.errorCode ?? null,
      feedbackUseful: d.feedbackUseful ?? null,
      flaggedForReview: Boolean(d.flaggedForReview),
      flagReason: d.flagReason ?? null,
      createdAtMs: toMillis(d.createdAt),
      completedAtMs: typeof d.completedAtMs === 'number' ? d.completedAtMs : null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}/evaluations/${evalId}`);
  }
}

export async function getSessionWithMessages(
  sessionId: string,
  uid?: string
): Promise<{
  session: SessionSummary | null;
  messages: SessionMessage[];
}> {
  try {
    if (!sessionId.startsWith('arena_')) {
      const sessSnap = await getDoc(doc(db, 'sessions', sessionId));
      if (sessSnap.exists()) {
        const session = mapSessionDoc(sessSnap.id, sessSnap.data());
        const msgSnap = await getDocs(
          query(
            collection(db, 'sessions', sessionId, 'messages'),
            orderBy('createdAt', 'asc'),
            limit(120)
          )
        );
        const messages: SessionMessage[] = msgSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            sessionId: String(data.sessionId),
            senderUid: String(data.senderUid),
            senderDisplayName: String(data.senderDisplayName),
            body: String(data.body),
            messageType: data.messageType as SessionMessage['messageType'],
            phase: data.phase as DiscussionPhase,
            replyToMessageId:
              typeof data.replyToMessageId === 'string'
                ? data.replyToMessageId
                : null,
            clientMessageId: String(data.clientMessageId),
            createdAtMs: toMillis(data.createdAt),
            editedAtMs:
              typeof data.editedAtMs === 'number' ? data.editedAtMs : null,
            deletedAtMs:
              typeof data.deletedAtMs === 'number' ? data.deletedAtMs : null,
          };
        });
        return { session, messages };
      }
    }

    if (uid) {
      const arenaSnap = await getDoc(
        doc(db, 'users', uid, 'arenaSessions', sessionId)
      );
      if (arenaSnap.exists()) {
        const aData = arenaSnap.data();
        const statusVal =
          aData.status === 'completed' ? 'completed' : ('active' as const);
        const syntheticSession: SessionSummary = {
          id: arenaSnap.id,
          scenarioId: String(aData.scenarioId),
          scenarioSlug: String(aData.scenarioSlug ?? ''),
          scenarioTitle: String(aData.scenarioTitle),
          roomType: 'discussion',
          difficulty: 'intermediate',
          title: `AI Arena: ${String(aData.scenarioTitle)}`,
          hostUid: uid,
          hostDisplayName: 'Learner',
          status: statusVal,
          participationMode: 'async',
          visibility: 'private',
          capacity: 2,
          participantCount: 1,
          participantUids: [uid],
          currentPhase:
            statusVal === 'completed' ? 'evaluation_complete' : 'open_discussion',
          phaseVersion: 1,
          activeTurnUid: null,
          sharedNotes:
            typeof aData.coachingNotes === 'string' ? aData.coachingNotes : '',
          roomCapabilities: {
            textEnabled: true,
            audioVideoPlanned: false,
            sharedWorkspacePlanned: true,
            mediaProvider: 'livekit',
            mediaMode: 'text_only_mvp',
          },
          startsAtMs: null,
          closesAtMs: null,
          completedAtMs: statusVal === 'completed' ? toMillis(aData.updatedAt) : null,
          createdAtMs: toMillis(aData.createdAt),
          updatedAtMs: toMillis(aData.updatedAt),
        };

        const arenaMsgSnap = await getDocs(
          query(
            collection(db, 'users', uid, 'arenaSessions', sessionId, 'messages'),
            orderBy('createdAt', 'asc'),
            limit(100)
          )
        );
        const arenaMessages: SessionMessage[] = arenaMsgSnap.docs.map((d) => {
          const m = d.data();
          const isLearner = m.senderType === 'learner';
          return {
            id: d.id,
            sessionId,
            senderUid: isLearner ? uid : `ai_${String(m.personaRole ?? 'guide')}`,
            senderDisplayName: String(m.senderDisplayName),
            body: String(m.body),
            messageType: 'text',
            phase: 'open_discussion',
            replyToMessageId: null,
            clientMessageId: d.id,
            createdAtMs: toMillis(m.createdAt),
            editedAtMs: null,
            deletedAtMs: null,
          };
        });
        return { session: syntheticSession, messages: arenaMessages };
      }
    }

    return { session: null, messages: [] };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `sessions/${sessionId}`);
  }
}

export async function listUserEvaluations(uid: string): Promise<UserEvaluationRecord[]> {
  if (isLocalTestPreview()) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, 'users', uid, 'evaluations'),
        where('uid', '==', uid),
        limit(30)
      )
    );
    return snap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          uid: String(d.uid),
          sessionId: String(d.sessionId),
          scenarioId: String(d.scenarioId),
          scenarioTitle: String(d.scenarioTitle),
          rubricVersion: Number(d.rubricVersion ?? 1),
          promptVersion: String(d.promptVersion ?? 'eval-v1'),
          provider: String(d.provider ?? 'gemini'),
          model: String(d.model ?? 'gemini-3-flash-preview'),
          status: d.status as UserEvaluationRecord['status'],
          report: d.report ?? null,
          errorCode: d.errorCode ?? null,
          feedbackUseful: d.feedbackUseful ?? null,
          flaggedForReview: Boolean(d.flaggedForReview),
          flagReason: d.flagReason ?? null,
          createdAtMs: toMillis(d.createdAt),
          completedAtMs: typeof d.completedAtMs === 'number' ? d.completedAtMs : null,
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${uid}/evaluations`);
  }
}

export async function listCompetencyObservations(
  uid: string
): Promise<CompetencyObservation[]> {
  if (isLocalTestPreview()) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, 'users', uid, 'competencyObservations'),
        where('uid', '==', uid),
        limit(100)
      )
    );
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        uid: String(d.uid),
        competencyKey: String(d.competencyKey),
        sessionId: String(d.sessionId),
        evaluationId: String(d.evaluationId),
        rating: Number(d.rating),
        confidence: d.confidence as CompetencyObservation['confidence'],
        rubricVersion: Number(d.rubricVersion ?? 1),
        observedAtMs: toMillis(d.observedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${uid}/competencyObservations`);
  }
}

export async function submitEvaluationFeedback(params: {
  uid: string;
  evaluationId: string;
  feedbackUseful: 'useful' | 'mixed' | 'not_useful';
  flaggedForReview: boolean;
  flagReason: string | null;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', params.uid, 'evaluations', params.evaluationId), {
      feedbackUseful: params.feedbackUseful,
      flaggedForReview: params.flaggedForReview,
      flagReason: params.flagReason,
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `users/${params.uid}/evaluations/${params.evaluationId}`
    );
  }
}

export async function reportSessionContent(params: {
  reporterUid: string;
  targetUid: string;
  sessionId: string;
  messageId: string | null;
  category: ReportCategory;
  details: string;
}): Promise<void> {
  const parsed = CreateReportSchema.parse({
    targetUid: params.targetUid,
    sessionId: params.sessionId,
    messageId: params.messageId,
    category: params.category,
    details: params.details,
  });

  const reportId = makeId('rep');
  try {
    await setDoc(doc(db, 'userReports', reportId), {
      id: reportId,
      reporterUid: params.reporterUid,
      targetUid: parsed.targetUid,
      sessionId: parsed.sessionId,
      messageId: parsed.messageId,
      category: parsed.category,
      details: parsed.details,
      status: 'open',
      resolutionAction: null,
      resolutionNotes: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `userReports/${reportId}`);
  }
}

export async function blockPeerUser(ownerUid: string, blockedUid: string): Promise<void> {
  try {
    await setDoc(doc(db, 'userBlocks', ownerUid, 'blockedUsers', blockedUid), {
      ownerUid,
      blockedUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `userBlocks/${ownerUid}/blockedUsers/${blockedUid}`
    );
  }
}

export async function unblockPeerUser(ownerUid: string, blockedUid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'userBlocks', ownerUid, 'blockedUsers', blockedUid));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `userBlocks/${ownerUid}/blockedUsers/${blockedUid}`
    );
  }
}

export async function listBlockedUsers(ownerUid: string): Promise<string[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'userBlocks', ownerUid, 'blockedUsers'),
        where('ownerUid', '==', ownerUid),
        limit(50)
      )
    );
    return snap.docs.map((d) => String(d.data().blockedUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `userBlocks/${ownerUid}/blockedUsers`);
  }
}

export async function listModerationReports(): Promise<UserReportCase[]> {
  try {
    const snap = await getDocs(query(collection(db, 'userReports'), limit(50)));
    return snap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          reporterUid: String(d.reporterUid),
          targetUid: String(d.targetUid),
          sessionId: String(d.sessionId),
          messageId: typeof d.messageId === 'string' ? d.messageId : null,
          category: d.category as ReportCategory,
          details: String(d.details),
          status: d.status as ModerationStatus,
          resolutionAction: (d.resolutionAction as ModerationAction) ?? null,
          resolutionNotes:
            typeof d.resolutionNotes === 'string' ? d.resolutionNotes : null,
          createdAtMs: toMillis(d.createdAt),
          updatedAtMs: toMillis(d.updatedAt),
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'userReports');
  }
}

export async function resolveModerationReport(params: {
  actorUid: string;
  reportId: string;
  status: 'under_review' | 'resolved' | 'dismissed';
  resolutionAction: ModerationAction;
  resolutionNotes: string;
}): Promise<void> {
  const parsed = ResolveReportSchema.parse({
    reportId: params.reportId,
    status: params.status,
    resolutionAction: params.resolutionAction,
    resolutionNotes: params.resolutionNotes,
  });

  const auditId = makeId('aud');
  try {
    await updateDoc(doc(db, 'userReports', parsed.reportId), {
      status: parsed.status,
      resolutionAction: parsed.resolutionAction,
      resolutionNotes: parsed.resolutionNotes,
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'auditEvents', auditId), {
      id: auditId,
      actorUid: params.actorUid,
      action: `moderation_${parsed.resolutionAction}`,
      targetType: 'userReport',
      targetId: parsed.reportId,
      outcome: 'succeeded',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `userReports/${parsed.reportId}`);
  }
}

export async function listAuditEvents(): Promise<AuditEventRecord[]> {
  try {
    const snap = await getDocs(query(collection(db, 'auditEvents'), limit(50)));
    return snap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          actorUid: String(d.actorUid),
          action: String(d.action),
          targetType: String(d.targetType),
          targetId: String(d.targetId),
          outcome: (d.outcome as AuditEventRecord['outcome']) ?? 'succeeded',
          createdAtMs: toMillis(d.createdAt),
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'auditEvents');
  }
}

export async function createCustomScenario(params: {
  actorUid: string;
  scenario: Omit<ScenarioItem, 'id' | 'rubricVersion'>;
}): Promise<ScenarioItem> {
  const scenarioId = `scen_${params.scenario.slug.slice(0, 28)}_${Date.now().toString(36).slice(-4)}`;
  const auditId = makeId('aud');
  const fullScenario: ScenarioItem = {
    ...params.scenario,
    id: scenarioId,
    rubricVersion: 1,
  };

  try {
    await setDoc(doc(db, 'scenarios', scenarioId), {
      id: fullScenario.id,
      slug: fullScenario.slug,
      domainId: fullScenario.domainId,
      domainTitle: fullScenario.domainTitle,
      topicTitle: fullScenario.topicTitle,
      title: fullScenario.title,
      roomType: fullScenario.roomType,
      difficulty: fullScenario.difficulty,
      estimatedMinutes: fullScenario.estimatedMinutes,
      participationMode: fullScenario.participationMode,
      context: fullScenario.context,
      prompt: fullScenario.prompt,
      constraints: [...fullScenario.constraints],
      learningObjectives: [...fullScenario.learningObjectives],
      prerequisites: [...fullScenario.prerequisites],
      competencies: [...fullScenario.competencies],
      strongSignals: [...fullScenario.strongSignals],
      rubricVersion: 1,
      status: fullScenario.status,
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'auditEvents', auditId), {
      id: auditId,
      actorUid: params.actorUid,
      action: 'scenario_authored',
      targetType: 'scenario',
      targetId: scenarioId,
      outcome: 'succeeded',
      createdAt: serverTimestamp(),
    });

    return fullScenario;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `scenarios/${scenarioId}`);
  }
}

// ============================================================================
// Phase 9: AI Practice Arena Services (/users/{uid}/arenaSessions/{arenaId})
// ============================================================================

export async function createArenaSession(params: {
  uid: string;
  scenario: ScenarioItem;
  mode: AiArenaMode;
  activePersonas: AiPersonaRole[];
}): Promise<string> {
  const arenaId = makeId('arena');
  const arenaRef = doc(db, 'users', params.uid, 'arenaSessions', arenaId);
  const openingMsgId = makeId('amsg');
  const openingMsgRef = doc(
    db,
    'users',
    params.uid,
    'arenaSessions',
    arenaId,
    'messages',
    openingMsgId
  );

  const primaryPersona = params.activePersonas[0] ?? 'mentor_coach';
  const personaInfo = AI_PERSONA_INFO[primaryPersona];

  const openingPrompt =
    params.mode === 'multi_perspective'
      ? `Welcome to the Multi-Perspective Engineering Panel for "${params.scenario.title}". Start by stating your initial hypothesis, architecture proposal, or clarifying questions. Our AI panel (${params.activePersonas.map((p) => AI_PERSONA_INFO[p].displayName).join(', ')}) will probe your trade-offs.`
      : `Let's practice "${params.scenario.title}". Review the scenario constraints and share your initial approach, diagnostic steps, or clarifying questions whenever you are ready.`;

  try {
    await setDoc(arenaRef, {
      id: arenaId,
      uid: params.uid,
      scenarioId: params.scenario.id,
      scenarioSlug: params.scenario.slug,
      scenarioTitle: params.scenario.title,
      mode: params.mode,
      activePersonas: params.activePersonas,
      status: 'active',
      turnCount: 1,
      coachingNotes: `# Arena Scratchpad: ${params.scenario.title}\n\nCapture your assumptions and trade-off notes here.`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(openingMsgRef, {
      id: openingMsgId,
      arenaId,
      uid: params.uid,
      senderType: 'ai',
      personaRole: primaryPersona,
      senderDisplayName: personaInfo.displayName,
      body: openingPrompt,
      coachingHint:
        'Start by clarifying unknowns, stating your primary hypothesis, or outlining key constraints before jumping to a final fix.',
      createdAt: serverTimestamp(),
    });

    return arenaId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${params.uid}/arenaSessions/${arenaId}`);
  }
}

export async function listUserArenaSessions(uid: string): Promise<ArenaSessionSummary[]> {
  if (isLocalTestPreview()) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, 'users', uid, 'arenaSessions'),
        where('uid', '==', uid),
        limit(30)
      )
    );
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: String(data.uid),
          scenarioId: String(data.scenarioId),
          scenarioSlug: String(data.scenarioSlug ?? ''),
          scenarioTitle: String(data.scenarioTitle),
          mode: data.mode as AiArenaMode,
          activePersonas: (Array.isArray(data.activePersonas)
            ? data.activePersonas
            : ['mentor_coach']) as AiPersonaRole[],
          status: (data.status as 'active' | 'completed') ?? 'active',
          turnCount: Number(data.turnCount ?? 0),
          coachingNotes: typeof data.coachingNotes === 'string' ? data.coachingNotes : '',
          createdAtMs: toMillis(data.createdAt),
          updatedAtMs: toMillis(data.updatedAt),
        };
      })
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${uid}/arenaSessions`);
  }
}

export function subscribeArenaSession(params: {
  uid: string;
  arenaId: string;
  onArena: (arena: ArenaSessionSummary | null) => void;
  onMessages: (messages: ArenaMessage[]) => void;
  onError: (err: Error) => void;
}): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      doc(db, 'users', params.uid, 'arenaSessions', params.arenaId),
      (snap) => {
        if (!snap.exists()) {
          params.onArena(null);
          return;
        }
        const data = snap.data();
        params.onArena({
          id: snap.id,
          uid: String(data.uid),
          scenarioId: String(data.scenarioId),
          scenarioSlug: String(data.scenarioSlug ?? ''),
          scenarioTitle: String(data.scenarioTitle),
          mode: data.mode as AiArenaMode,
          activePersonas: Array.isArray(data.activePersonas)
            ? (data.activePersonas as AiPersonaRole[])
            : ['mentor_coach'],
          status: (data.status as 'active' | 'completed') ?? 'active',
          turnCount: Number(data.turnCount ?? 0),
          coachingNotes: typeof data.coachingNotes === 'string' ? data.coachingNotes : '',
          createdAtMs: toMillis(data.createdAt),
          updatedAtMs: toMillis(data.updatedAt),
        });
      },
      (err) => params.onError(err)
    )
  );

  unsubs.push(
    onSnapshot(
      query(
        collection(db, 'users', params.uid, 'arenaSessions', params.arenaId, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(100)
      ),
      (snap) => {
        const msgs: ArenaMessage[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            arenaId: String(data.arenaId),
            uid: String(data.uid),
            senderType: (data.senderType as 'learner' | 'ai') ?? 'ai',
            senderDisplayName: String(data.senderDisplayName),
            personaRole: (data.personaRole as AiPersonaRole) ?? null,
            body: String(data.body),
            coachingHint:
              typeof data.coachingHint === 'string' ? data.coachingHint : null,
            createdAtMs: toMillis(data.createdAt),
          };
        });
        params.onMessages(msgs);
      },
      (err) => params.onError(err)
    )
  );

  return () => {
    for (const u of unsubs) u();
  };
}

export async function sendArenaTurn(params: {
  uid: string;
  profile: UserProfile;
  arena: ArenaSessionSummary;
  scenario: ScenarioItem;
  history: ArenaMessage[];
  learnerMessage: string;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== params.uid) {
    throw new Error('Authentication required.');
  }

  const userMsgId = makeId('amsg');
  const userMsgRef = doc(
    db,
    'users',
    params.uid,
    'arenaSessions',
    params.arena.id,
    'messages',
    userMsgId
  );

  await setDoc(userMsgRef, {
    id: userMsgId,
    arenaId: params.arena.id,
    uid: params.uid,
    senderType: 'learner',
    personaRole: null,
    senderDisplayName: params.profile.displayName,
    body: params.learnerMessage.trim(),
    coachingHint: null,
    createdAt: serverTimestamp(),
  });

  const idToken = await currentUser.getIdToken();
  const res = await fetch('/api/v1/arena/respond', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      arenaId: params.arena.id,
      mode: params.arena.mode,
      activePersonas: params.arena.activePersonas,
      scenario: {
        id: params.scenario.id,
        title: params.scenario.title,
        context: params.scenario.context,
        prompt: params.scenario.prompt,
        constraints: params.scenario.constraints,
      },
      history: params.history.slice(-14).map((m) => ({
        senderType: m.senderType,
        senderDisplayName: m.senderDisplayName,
        personaRole: m.personaRole,
        body: m.body,
      })),
      learnerMessage: params.learnerMessage.trim(),
    }),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(errBody?.error?.message ?? 'AI persona could not respond right now.');
  }

  const json = (await res.json()) as ApiSuccessResponse<ArenaTurnResponseData>;
  let addedCount = 1;

  for (const reply of json.data.replies) {
    const aiMsgId = makeId('amsg');
    const aiMsgRef = doc(
      db,
      'users',
      params.uid,
      'arenaSessions',
      params.arena.id,
      'messages',
      aiMsgId
    );
    await setDoc(aiMsgRef, {
      id: aiMsgId,
      arenaId: params.arena.id,
      uid: params.uid,
      senderType: 'ai',
      personaRole: reply.personaRole,
      senderDisplayName: reply.senderDisplayName,
      body: reply.body,
      coachingHint: reply.coachingHint,
      createdAt: serverTimestamp(),
    });
    addedCount += 1;
  }

  await updateDoc(doc(db, 'users', params.uid, 'arenaSessions', params.arena.id), {
    turnCount: params.arena.turnCount + addedCount,
    updatedAt: serverTimestamp(),
  });
}

export async function saveArenaNotes(params: {
  uid: string;
  arenaId: string;
  coachingNotes: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', params.uid, 'arenaSessions', params.arenaId), {
      coachingNotes: params.coachingNotes.slice(0, 4000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `users/${params.uid}/arenaSessions/${params.arenaId}`
    );
  }
}

export async function completeArenaSessionAndEvaluate(params: {
  uid: string;
  profile: UserProfile;
  arena: ArenaSessionSummary;
  scenario: ScenarioItem;
  messages: ArenaMessage[];
}): Promise<UserEvaluationRecord> {
  await updateDoc(doc(db, 'users', params.uid, 'arenaSessions', params.arena.id), {
    status: 'completed',
    updatedAt: serverTimestamp(),
  });

  const syntheticSession: SessionSummary = {
    id: params.arena.id,
    scenarioId: params.scenario.id,
    scenarioSlug: params.scenario.slug,
    scenarioTitle: params.scenario.title,
    roomType: params.scenario.roomType,
    difficulty: params.scenario.difficulty,
    title: `AI Arena: ${params.scenario.title}`,
    hostUid: params.uid,
    hostDisplayName: params.profile.displayName,
    status: 'completed',
    participationMode: 'async',
    visibility: 'private',
    capacity: 2,
    participantCount: 1,
    participantUids: [params.uid],
    currentPhase: 'evaluation_complete',
    phaseVersion: 1,
    activeTurnUid: null,
    sharedNotes: params.arena.coachingNotes,
    roomCapabilities: {
      textEnabled: true,
      audioVideoPlanned: false,
      sharedWorkspacePlanned: true,
      mediaProvider: 'livekit',
      mediaMode: 'text_only_mvp',
    },
    startsAtMs: null,
    closesAtMs: null,
    completedAtMs: Date.now(),
    createdAtMs: params.arena.createdAtMs,
    updatedAtMs: Date.now(),
  };

  const mappedMessages: SessionMessage[] = params.messages.map((m) => ({
    id: m.id,
    sessionId: params.arena.id,
    senderUid: m.senderType === 'learner' ? params.uid : `ai_${m.personaRole ?? 'guide'}`,
    senderDisplayName: m.senderDisplayName,
    body: m.body,
    messageType: 'text',
    phase: 'open_discussion',
    replyToMessageId: null,
    clientMessageId: m.id,
    createdAtMs: m.createdAtMs,
    editedAtMs: null,
    deletedAtMs: null,
  }));

  return generateAndSaveEvaluation({
    uid: params.uid,
    profile: params.profile,
    session: syntheticSession,
    scenario: params.scenario,
    messages: mappedMessages,
  });
}

// ============================================================================
// Phase 12: Shareable Developer Skill Passport (/skillPassports/{uid})
// ============================================================================

export async function getSkillPassport(uid: string): Promise<SkillPassportRecord | null> {
  if (isLocalTestPreview()) return null;
  try {
    const snap = await getDoc(doc(db, 'skillPassports', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: String(d.uid),
      displayName: String(d.displayName),
      experienceBand: d.experienceBand as SkillPassportRecord['experienceBand'],
      headline: String(d.headline ?? ''),
      bio: String(d.bio ?? ''),
      visibility: (d.visibility as 'private' | 'community') ?? 'private',
      completedSessionsCount: Number(d.completedSessionsCount ?? 0),
      verifiedCompetencies: Array.isArray(d.verifiedCompetencies)
        ? (d.verifiedCompetencies as SkillPassportRecord['verifiedCompetencies'])
        : [],
      updatedAtMs: toMillis(d.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `skillPassports/${uid}`);
  }
}

export async function saveSkillPassport(params: {
  uid: string;
  displayName: string;
  experienceBand: SkillPassportRecord['experienceBand'];
  headline: string;
  bio: string;
  visibility: 'private' | 'community';
  completedSessionsCount: number;
  verifiedCompetencies: SkillPassportRecord['verifiedCompetencies'];
}): Promise<SkillPassportRecord> {
  const passportRef = doc(db, 'skillPassports', params.uid);
  try {
    await setDoc(passportRef, {
      uid: params.uid,
      displayName: params.displayName.trim().slice(0, 60),
      experienceBand: params.experienceBand,
      headline: params.headline.trim().slice(0, 120),
      bio: params.bio.trim().slice(0, 280),
      visibility: params.visibility,
      completedSessionsCount: params.completedSessionsCount,
      verifiedCompetencies: params.verifiedCompetencies.slice(0, 20),
      updatedAt: serverTimestamp(),
    });
    return {
      ...params,
      updatedAtMs: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `skillPassports/${params.uid}`);
  }
}
