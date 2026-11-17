import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Award,
  Ban,
  ChevronRight,
  Clock,
  Code2,
  Cpu,
  Flag,
  Mic,
  MicOff,
  Pause,
  PhoneOff,
  Play,
  Plus,
  Radio,
  Send,
  SkipForward,
  Sparkles,
  Trash2,
  Trophy,
  Video,
  VideoOff,
} from 'lucide-react';
import { WorkspaceShell } from '../components/AppShell';
import { SafeMarkdown } from '../components/SafeMarkdown';
import { useAuth } from '../features/auth/AuthContext';
import { fetchPublishedCatalogue } from '../features/catalogue/catalogueService';
import {
  advanceSessionPhase,
  autoGenerateEvaluationForCompletedSession,
  blockPeerUser,
  joinSessionRoom,
  joinSessionWaitlist,
  leaveSessionRoom,
  leaveSessionWaitlist,
  listBlockedUsers,
  reconcileStaleUserRooms,
  removeParticipantFromSession,
  reportSessionContent,
  requestRoomMediaToken,
  saveSharedWorkspaceNotes,
  sendDiscussionMessage,
  setNextTurnParticipant,
  subscribeSessionRoom,
  transitionSessionLifecycle,
  updateParticipantMediaState,
} from '../features/sessions/sessionService';
import {
  computeRoomContributionDistribution,
  extractSharedNotesAndLab,
  getNextDiscussionPhase,
  MAX_MESSAGE_LENGTH,
  PHASE_METADATA,
  serializeSharedNotesAndLab,
} from '../../packages/domain/src/discussion';
import { computeRoomParticipantStandings } from '../../packages/domain/src/evaluation';
import {
  ARCHITECTURE_NODE_KINDS,
  type ArchitectureDiagramEdge,
  type ArchitectureDiagramNode,
  type ArchitectureNodeKind,
  type CodeReviewAnnotation,
  type EngineeringLabData,
  type ReportCategory,
  type ScenarioItem,
  type SessionEvent,
  type SessionMessage,
  type SessionParticipant,
  type SessionSummary,
  type SessionWaitlistEntry,
} from '../../packages/domain/src/types';
import { Link, useRouter } from '../lib/router';
import { ThreeArchitectureStage } from '../components/ThreeArchitectureStage';

function makeClientId(prefix = 'msg'): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`
    : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

type SpokenTurnIntent =
  | 'approach'
  | 'question_back'
  | 'clarification'
  | 'tradeoff_defense';

const SPOKEN_INTENT_LABELS: Record<SpokenTurnIntent, string> = {
  approach: 'Best Approach Proposal',
  question_back: 'Questioning Back',
  clarification: 'Clarification',
  tradeoff_defense: 'Trade-Off Defense',
};

export function SessionRoomPage({ sessionId }: { sessionId: string }) {
  const { firebaseUser, profile, isAdmin } = useAuth();
  const { navigate } = useRouter();
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [scenario, setScenario] = useState<ScenarioItem | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [waitlist, setWaitlist] = useState<SessionWaitlistEntry[]>([]);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rightTab, setRightTab] = useState<
    'brief' | 'arch_lab' | 'code_lab' | 'scratchpad' | 'timeline'
  >('timeline');
  const [notesDraft, setNotesDraft] = useState('');
  const [labData, setLabData] = useState<EngineeringLabData>({
    diagramNodes: [],
    diagramEdges: [],
    annotations: [],
  });
  const [notesInitialized, setNotesInitialized] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Architecture Lab form state
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [newNodeKind, setNewNodeKind] = useState<ArchitectureNodeKind>('service');
  const [newEdgeFrom, setNewEdgeFrom] = useState('');
  const [newEdgeTo, setNewEdgeTo] = useState('');
  const [newEdgeProtocol, setNewEdgeProtocol] = useState('HTTPS / JSON');

  // Code Review Lab form state
  const [selectedCodeLine, setSelectedCodeLine] = useState(1);
  const [annotationSeverity, setAnnotationSeverity] = useState<
    'question' | 'suggestion' | 'risk'
  >('suggestion');
  const [annotationComment, setAnnotationComment] = useState('');

  // Audio/Video Stage & Live Voice Transcription state
  const [stageExpanded, setStageExpanded] = useState(true);
  const [mediaConsentChecked, setMediaConsentChecked] = useState(true);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaTokenInfo, setMediaTokenInfo] = useState<{
    provider: string;
    roomName: string;
    mediaMode: 'audio' | 'audio_video';
  } | null>(null);
  const [localMediaNote, setLocalMediaNote] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Live Voice-to-Text SpeechRecognition + Stage Dictation state
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const [spokenDraft, setSpokenDraft] = useState('');
  const [interimSpeech, setInterimSpeech] = useState('');
  const [spokenIntent, setSpokenIntent] = useState<SpokenTurnIntent>('approach');
  const speechRecRef = useRef<{ stop: () => void } | null>(null);

  const [composerBody, setComposerBody] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.sessionStorage.getItem(`ep_draft_session_${sessionId}`) ?? '';
    }
    return '';
  });
  const [messageMode, setMessageMode] = useState<'text' | 'code'>('text');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (composerBody) {
        window.sessionStorage.setItem(`ep_draft_session_${sessionId}`, composerBody);
      } else {
        window.sessionStorage.removeItem(`ep_draft_session_${sessionId}`);
      }
    }
  }, [sessionId, composerBody]);

  const [reportTarget, setReportTarget] = useState<{
    targetUid: string;
    messageId: string | null;
    displayName: string;
  } | null>(null);
  const [reportCategory, setReportCategory] = useState<ReportCategory>('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [reportStatusMsg, setReportStatusMsg] = useState<string | null>(null);

  const isCurrentlyJoined = useMemo(() => {
    if (!firebaseUser || !session) return false;
    return session.participantUids.includes(firebaseUser.uid);
  }, [firebaseUser, session]);

  const isMember = useMemo(() => {
    if (!firebaseUser || !session) return false;
    if (session.participantUids.includes(firebaseUser.uid)) return true;
    if (session.hostUid === firebaseUser.uid) return true;
    return participants.some((p) => p.uid === firebaseUser.uid);
  }, [firebaseUser, session, participants]);

  useEffect(() => {
    if (!firebaseUser) return;
    listBlockedUsers(firebaseUser.uid)
      .then(setBlockedUids)
      .catch(() => {});
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    setLoading(true);
    const unsub = subscribeSessionRoom({
      sessionId,
      isMember,
      onSession: (sess) => {
        setSession(sess);
        if (sess) {
          const parsed = extractSharedNotesAndLab(sess.sharedNotes);
          setLabData(parsed.labData);
          if (!notesInitialized) {
            setNotesDraft(parsed.markdownNotes);
            setNotesInitialized(true);
          }
        }
        setLoading(false);
      },
      onParticipants: setParticipants,
      onMessages: setMessages,
      onEvents: setEvents,
      onWaitlist: setWaitlist,
      onError: (err) => {
        setError(err.message);
        setLoading(false);
      },
    });
    return () => unsub();
  }, [sessionId, firebaseUser, isMember, notesInitialized]);

  useEffect(() => {
    if (!session?.scenarioId) return;
    fetchPublishedCatalogue()
      .then((res) => {
        setScenario(
          res.scenarios.find((s) => s.id === session.scenarioId) ?? null
        );
      })
      .catch(() => {});
  }, [session?.scenarioId]);

  const hasLeftRef = useRef(false);
  const isJoinedRef = useRef(false);
  const authSnapshotRef = useRef<{
    uid: string;
    displayName: string;
    profile: typeof profile;
  } | null>(null);

  useEffect(() => {
    isJoinedRef.current = isCurrentlyJoined;
    if (isCurrentlyJoined) {
      hasLeftRef.current = false;
    }
  }, [isCurrentlyJoined]);

  useEffect(() => {
    if (firebaseUser) {
      authSnapshotRef.current = {
        uid: firebaseUser.uid,
        displayName: profile?.displayName ?? firebaseUser.displayName ?? 'Participant',
        profile,
      };
    }
  }, [firebaseUser, profile]);

  // Reconcile any other stale rooms when entering this room
  useEffect(() => {
    if (!firebaseUser) return;
    void reconcileStaleUserRooms({
      uid: firebaseUser.uid,
      displayName: profile?.displayName ?? firebaseUser.displayName ?? 'Participant',
      activeSessionId: sessionId,
      profile,
    });
  }, [sessionId, firebaseUser, profile]);

  // Clean up local camera/mic tracks, speech recognition, and auto-leave room on unmount / tab close
  useEffect(() => {
    const performAutoLeave = () => {
      const snap = authSnapshotRef.current;
      if (!snap || !isJoinedRef.current || hasLeftRef.current) return;
      hasLeftRef.current = true;
      isJoinedRef.current = false;
      void leaveSessionRoom({
        sessionId,
        uid: snap.uid,
        displayName: snap.displayName,
      })
        .then((res) => {
          if (res.roomEnded && snap.profile) {
            void autoGenerateEvaluationForCompletedSession({
              uid: snap.uid,
              profile: snap.profile,
              sessionId,
            });
          }
        })
        .catch(() => {});
    };

    window.addEventListener('pagehide', performAutoLeave);
    return () => {
      window.removeEventListener('pagehide', performAutoLeave);
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
        localStreamRef.current = null;
      }
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch {
          // ignore
        }
        speechRecRef.current = null;
      }
      performAutoLeave();
    };
  }, [sessionId]);

  const isHost = Boolean(
    firebaseUser && session && (session.hostUid === firebaseUser.uid || isAdmin)
  );
  const activeParticipants = participants.filter((p) => p.status === 'joined');
  const selfParticipant = activeParticipants.find((p) => p.uid === firebaseUser?.uid);
  const isWaitlisted = Boolean(
    firebaseUser && waitlist.some((w) => w.uid === firebaseUser.uid)
  );
  const phaseInfo = session ? PHASE_METADATA[session.currentPhase] : null;
  const nextPhase = session ? getNextDiscussionPhase(session.currentPhase) : null;
  const activeTurnParticipant =
    activeParticipants.find((p) => p.uid === session?.activeTurnUid) ??
    activeParticipants[0] ??
    null;
  const canPost = Boolean(
    session &&
      isCurrentlyJoined &&
      (session.status === 'active' ||
        session.status === 'open' ||
        session.status === 'scheduled')
  );

  const persistWorkspacePayload = async (
    nextNotes: string,
    nextLab: EngineeringLabData
  ) => {
    if (!session) return;
    setSavingNotes(true);
    try {
      const combined = serializeSharedNotesAndLab(nextNotes, nextLab);
      await saveSharedWorkspaceNotes({
        sessionId: session.id,
        sharedNotes: combined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sync workspace lab.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleToggleSpeechRecognition = () => {
    if (isTranscribingVoice) {
      if (speechRecRef.current) {
        try {
          speechRecRef.current.stop();
        } catch {
          // ignore
        }
        speechRecRef.current = null;
      }
      setIsTranscribingVoice(false);
      setInterimSpeech('');
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: (event: {
          resultIndex: number;
          results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
        }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: (event: {
          resultIndex: number;
          results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
        }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
    };

    const SpeechRecCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecCtor) {
      setLocalMediaNote(
        'Browser live speech recognition is unavailable on this device — type or dictate your spoken turn in the Live Voice Transcript bar below and click "Speak & Transcribe Turn".'
      );
      return;
    }

    try {
      const rec = new SpeechRecCtor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const item = event.results[i];
          if (item.isFinal) {
            finalChunk += item[0].transcript + ' ';
          } else {
            interimChunk += item[0].transcript;
          }
        }
        if (finalChunk.trim()) {
          setSpokenDraft((prev) =>
            `${prev} ${finalChunk.trim()}`.trim().slice(0, MAX_MESSAGE_LENGTH - 120)
          );
        }
        setInterimSpeech(interimChunk);
      };
      rec.onerror = () => {
        setIsTranscribingVoice(false);
        setInterimSpeech('');
      };
      rec.onend = () => {
        setIsTranscribingVoice(false);
        setInterimSpeech('');
      };
      rec.start();
      speechRecRef.current = rec;
      setIsTranscribingVoice(true);
    } catch {
      setIsTranscribingVoice(false);
    }
  };

  const handlePublishSpokenTranscript = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile || !session) return;
    const rawSpeech = `${spokenDraft} ${interimSpeech}`.trim();
    if (!rawSpeech) return;

    const intentBadge = SPOKEN_INTENT_LABELS[spokenIntent];
    const formattedTranscript = `🎙️ **[Live Voice Transcript — ${profile.displayName} · ${intentBadge}]**\n${rawSpeech}`;

    setSending(true);
    setError(null);
    try {
      await sendDiscussionMessage({
        sessionId,
        senderUid: firebaseUser.uid,
        senderDisplayName: profile.displayName,
        phase: session.currentPhase,
        body: formattedTranscript,
        messageType: 'text',
        replyToMessageId: replyToId,
        clientMessageId: makeClientId('voice'),
        participants,
        currentTurnUid: session.activeTurnUid,
      });
      setSpokenDraft('');
      setInterimSpeech('');
      setReplyToId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to transcribe spoken turn.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleJoinStage = async (mode: 'audio' | 'audio_video') => {
    if (!firebaseUser || !profile || !session) return;
    if (!mediaConsentChecked) {
      setError('Please confirm explicit audio/video stage consent first.');
      return;
    }
    setMediaBusy(true);
    setError(null);
    setLocalMediaNote(null);

    try {
      const tokenData = await requestRoomMediaToken({
        sessionId: session.id,
        mediaMode: mode,
        consentAccepted: true,
      });
      setMediaTokenInfo({
        provider: tokenData.provider,
        roomName: `eng-room-${tokenData.sessionId}`,
        mediaMode: tokenData.mediaMode,
      });

      const hasMic = true;
      let hasCam = mode === 'audio_video';

      if (
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'
      ) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: mode === 'audio_video',
          });
          localStreamRef.current = stream;
          if (localVideoRef.current && mode === 'audio_video') {
            localVideoRef.current.srcObject = stream;
          }
        } catch {
          hasCam = false;
          setLocalMediaNote(
            'Connected in simulated stage mode (no physical camera/microphone detected on this device). Use the Live Voice Transcript bar below to speak/transcribe your turn with your name.'
          );
        }
      } else {
        hasCam = false;
        setLocalMediaNote(
          'Connected in stage signalling mode. Use the Live Voice Transcript bar below to speak/transcribe your turn with your name.'
        );
      }

      await updateParticipantMediaState({
        sessionId: session.id,
        uid: firebaseUser.uid,
        micEnabled: hasMic,
        camEnabled: hasCam,
        mediaMode: mode,
        mediaConsentGranted: true,
      });
      setStageExpanded(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to join Audio/Video stage.'
      );
    } finally {
      setMediaBusy(false);
    }
  };

  const handleToggleMic = async () => {
    if (!firebaseUser || !session || !selfParticipant) return;
    const nextMic = !selfParticipant.micEnabled;
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getAudioTracks()) {
        track.enabled = nextMic;
      }
    }
    await updateParticipantMediaState({
      sessionId: session.id,
      uid: firebaseUser.uid,
      micEnabled: nextMic,
      camEnabled: Boolean(selfParticipant.camEnabled),
      mediaMode:
        selfParticipant.mediaMode && selfParticipant.mediaMode !== 'text'
          ? selfParticipant.mediaMode
          : 'audio',
      mediaConsentGranted: true,
    });
  };

  const handleToggleCam = async () => {
    if (!firebaseUser || !session || !selfParticipant) return;
    const nextCam = !selfParticipant.camEnabled;
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getVideoTracks()) {
        track.enabled = nextCam;
      }
    }
    await updateParticipantMediaState({
      sessionId: session.id,
      uid: firebaseUser.uid,
      micEnabled: Boolean(selfParticipant.micEnabled),
      camEnabled: nextCam,
      mediaMode: nextCam ? 'audio_video' : 'audio',
      mediaConsentGranted: true,
    });
  };

  const handleLeaveStage = async () => {
    if (!firebaseUser || !session) return;
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {
        // ignore
      }
      speechRecRef.current = null;
    }
    setIsTranscribingVoice(false);
    setMediaTokenInfo(null);
    setLocalMediaNote(null);
    await updateParticipantMediaState({
      sessionId: session.id,
      uid: firebaseUser.uid,
      micEnabled: false,
      camEnabled: false,
      mediaMode: 'text',
      mediaConsentGranted: false,
    });
  };

  const handleJoin = async () => {
    if (!firebaseUser || !profile) return;
    setError(null);
    try {
      await joinSessionRoom({
        sessionId,
        uid: firebaseUser.uid,
        displayName: profile.displayName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join room.');
    }
  };

  const handleJoinWaitlist = async () => {
    if (!firebaseUser || !profile || !session) return;
    setError(null);
    try {
      await joinSessionWaitlist({
        session,
        uid: firebaseUser.uid,
        displayName: profile.displayName,
        existingWaitlist: waitlist,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join waitlist.');
    }
  };

  const handleLeaveWaitlist = async () => {
    if (!firebaseUser || !session) return;
    setError(null);
    try {
      await leaveSessionWaitlist({
        sessionId: session.id,
        uid: firebaseUser.uid,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to leave waitlist.');
    }
  };

  const handleLeave = async () => {
    if (!firebaseUser || !profile) return;
    setError(null);
    setLifecycleBusy(true);
    hasLeftRef.current = true;
    isJoinedRef.current = false;
    try {
      await handleLeaveStage().catch(() => {});
      const result = await leaveSessionRoom({
        sessionId,
        uid: firebaseUser.uid,
        displayName: profile.displayName,
      });
      if (result.roomEnded) {
        void autoGenerateEvaluationForCompletedSession({
          uid: firebaseUser.uid,
          profile,
          sessionId,
        });
        navigate(`/sessions/${sessionId}/report?autogen=1`);
      } else {
        navigate('/sessions');
      }
    } catch (err) {
      hasLeftRef.current = false;
      setError(err instanceof Error ? err.message : 'Unable to leave room.');
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleLifecycle = async (targetStatus: SessionSummary['status']) => {
    if (!firebaseUser) return;
    setLifecycleBusy(true);
    setError(null);
    try {
      await transitionSessionLifecycle({
        sessionId,
        actorUid: firebaseUser.uid,
        targetStatus,
      });
      if (targetStatus === 'completed') {
        navigate(`/sessions/${sessionId}/report?autogen=1`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'State change failed.');
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleAdvancePhase = async () => {
    if (!firebaseUser) return;
    setLifecycleBusy(true);
    setError(null);
    try {
      await advanceSessionPhase({
        sessionId,
        actorUid: firebaseUser.uid,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not advance phase.');
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile || !session || !composerBody.trim()) return;

    const finalBody =
      messageMode === 'code' && !composerBody.trim().startsWith('```')
        ? `\`\`\`\n${composerBody.trim()}\n\`\`\``
        : composerBody.trim();

    setSending(true);
    setError(null);
    try {
      await sendDiscussionMessage({
        sessionId,
        senderUid: firebaseUser.uid,
        senderDisplayName: profile.displayName,
        phase: session.currentPhase,
        body: finalBody,
        messageType: messageMode,
        replyToMessageId: replyToId,
        clientMessageId: makeClientId('msg'),
        participants,
        currentTurnUid: session.activeTurnUid,
      });
      setComposerBody('');
      setReplyToId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send contribution.');
    } finally {
      setSending(false);
    }
  };

  const handlePassTurn = async () => {
    if (!firebaseUser || !profile || !session) return;
    setSending(true);
    setError(null);
    try {
      await sendDiscussionMessage({
        sessionId,
        senderUid: firebaseUser.uid,
        senderDisplayName: profile.displayName,
        phase: session.currentPhase,
        body: `${profile.displayName} passed this turn to the next listener.`,
        messageType: 'pass',
        replyToMessageId: null,
        clientMessageId: makeClientId('msg'),
        participants,
        currentTurnUid: session.activeTurnUid,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to pass turn.');
    } finally {
      setSending(false);
    }
  };

  const handleSaveNotes = async () => {
    await persistWorkspacePayload(notesDraft, labData);
  };

  const handleAddDiagramNode = async (e: FormEvent) => {
    e.preventDefault();
    if (!newNodeLabel.trim()) return;
    const node: ArchitectureDiagramNode = {
      id: makeClientId('node'),
      label: newNodeLabel.trim().slice(0, 40),
      kind: newNodeKind,
      notes: '',
    };
    const nextLab: EngineeringLabData = {
      ...labData,
      diagramNodes: [...labData.diagramNodes, node].slice(-14),
    };
    setLabData(nextLab);
    setNewNodeLabel('');
    if (!newEdgeFrom) setNewEdgeFrom(node.id);
    else if (!newEdgeTo) setNewEdgeTo(node.id);
    await persistWorkspacePayload(notesDraft, nextLab);
  };

  const handleAddDiagramEdge = async (e: FormEvent) => {
    e.preventDefault();
    if (!newEdgeFrom || !newEdgeTo || newEdgeFrom === newEdgeTo) return;
    const edge: ArchitectureDiagramEdge = {
      id: makeClientId('edge'),
      fromId: newEdgeFrom,
      toId: newEdgeTo,
      protocol: newEdgeProtocol.trim().slice(0, 30) || 'HTTPS',
    };
    const nextLab: EngineeringLabData = {
      ...labData,
      diagramEdges: [...labData.diagramEdges, edge].slice(-18),
    };
    setLabData(nextLab);
    await persistWorkspacePayload(notesDraft, nextLab);
  };

  const handleDeleteNode = async (nodeId: string) => {
    const nextLab: EngineeringLabData = {
      ...labData,
      diagramNodes: labData.diagramNodes.filter((n) => n.id !== nodeId),
      diagramEdges: labData.diagramEdges.filter(
        (e) => e.fromId !== nodeId && e.toId !== nodeId
      ),
    };
    setLabData(nextLab);
    await persistWorkspacePayload(notesDraft, nextLab);
  };

  const handleAddCodeAnnotation = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile || !annotationComment.trim()) return;
    const item: CodeReviewAnnotation = {
      id: makeClientId('ann'),
      authorUid: firebaseUser.uid,
      authorName: profile.displayName,
      lineNumber: selectedCodeLine,
      severity: annotationSeverity,
      comment: annotationComment.trim().slice(0, 220),
      createdAtMs: Date.now(),
    };
    const nextLab: EngineeringLabData = {
      ...labData,
      annotations: [...labData.annotations, item].slice(-20),
    };
    setLabData(nextLab);
    setAnnotationComment('');
    await persistWorkspacePayload(notesDraft, nextLab);
  };

  const handleSubmitReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !reportTarget) return;
    try {
      await reportSessionContent({
        reporterUid: firebaseUser.uid,
        targetUid: reportTarget.targetUid,
        sessionId,
        messageId: reportTarget.messageId,
        category: reportCategory,
        details: reportDetails,
      });
      setReportTarget(null);
      setReportDetails('');
      setReportStatusMsg('Report submitted for moderator review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report.');
    }
  };

  const handleBlockPeer = async (peerUid: string) => {
    if (!firebaseUser || peerUid === firebaseUser.uid) return;
    try {
      await blockPeerUser(firebaseUser.uid, peerUid);
      setBlockedUids((prev) => (prev.includes(peerUid) ? prev : [...prev, peerUid]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not block user.');
    }
  };

  const handleInviteTurn = async (targetUid: string, targetDisplayName: string) => {
    if (!firebaseUser || !session) return;
    try {
      await setNextTurnParticipant({
        sessionId: session.id,
        actorUid: firebaseUser.uid,
        targetUid,
        targetDisplayName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not invite participant turn.');
    }
  };

  const handleRemoveParticipant = async (
    targetUid: string,
    targetDisplayName: string
  ) => {
    if (!firebaseUser || !session) return;
    try {
      await removeParticipantFromSession({
        sessionId: session.id,
        actorUid: firebaseUser.uid,
        targetUid,
        targetDisplayName,
        reason: 'Host/Moderator safety or room management action',
        recordAdminAudit: isAdmin,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not remove participant.'
      );
    }
  };

  const contributionDistribution = useMemo(
    () => computeRoomContributionDistribution(participants, messages),
    [participants, messages]
  );

  const roomStandings = useMemo(
    () => computeRoomParticipantStandings(participants, messages),
    [participants, messages]
  );

  const messageById = useMemo(
    () => new Map(messages.map((m) => [m.id, m] as const)),
    [messages]
  );

  const codeArtifactLines = useMemo(() => {
    const raw =
      scenario?.codeArtifact ||
      `// Scenario artifact for ${session?.scenarioTitle ?? 'Engineering Discussion'}\n// Add line-level annotations below to flag bottlenecks, race conditions, or trade-offs.`;
    return raw.split('\n');
  }, [scenario?.codeArtifact, session?.scenarioTitle]);

  const stageParticipants = activeParticipants.filter(
    (p) => p.mediaMode && p.mediaMode !== 'text'
  );

  return (
    <WorkspaceShell
      title={session?.title ?? 'Session Room'}
      breadcrumb={`Rooms / ${session?.roomType?.replace(/_/g, ' ') ?? 'Discussion'} · Live Voice Transcription & AI Points`}
      action={
        <div className="flex items-center gap-2">
          <Link
            to="/leaderboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-1.5 text-xs font-medium text-amber-300 hover:border-amber-500/50"
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>Leaderboard</span>
          </Link>
          {isCurrentlyJoined && session && session.status !== 'completed' ? (
            <button
              type="button"
              disabled={lifecycleBusy}
              onClick={handleLeave}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-950/50"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              <span>
                {session.participantCount <= 1
                  ? 'Leave & Auto-Generate Report'
                  : 'Leave Room'}
              </span>
            </button>
          ) : null}
        </div>
      }
    >
      {loading ? (
        <div className="h-96 animate-pulse rounded-xl border border-slate-800 bg-[#111827]" />
      ) : !session ? (
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-8 text-center">
          <p className="text-sm text-slate-300">
            This session does not exist or you do not have permission to view it.
          </p>
          <Link to="/sessions" className="mt-3 inline-block text-sm text-blue-400">
            Back to Sessions
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
            >
              {error}
            </div>
          ) : null}

          {reportStatusMsg ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              {reportStatusMsg}
            </div>
          ) : null}

          {/* Room Header & Controls */}
          <div className="studio-panel rounded-2xl p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="font-mono font-semibold uppercase tracking-wider text-sky-400">
                  Status: {session.status}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-white">
                  Phase: {phaseInfo?.label}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-sky-300 tabular-nums">
                  {session.participantCount}/{session.capacity} seats active (up to 10)
                </span>
                {waitlist.length > 0 ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-amber-400">
                      {waitlist.length} waitlisted
                    </span>
                  </>
                ) : null}
                {session.startsAtMs ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-slate-300">
                      <Clock className="h-3 w-3 text-sky-400" />
                      {new Date(session.startsAtMs).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </>
                ) : null}
              </div>
              <p className="mt-1.5 text-xs text-slate-300">
                {phaseInfo?.guidance} · Room stays live while 1+ participants are joined; when everyone leaves, it automatically ends and generates the AI Report &amp; Leaderboard points.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isCurrentlyJoined && session.status !== 'completed' ? (
                <button
                  type="button"
                  onClick={() => setStageExpanded((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
                    selfParticipant?.mediaMode && selfParticipant.mediaMode !== 'text'
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                      : 'border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20'
                  }`}
                >
                  <Radio className="h-3.5 w-3.5 text-sky-400" />
                  <span>
                    {selfParticipant?.mediaMode && selfParticipant.mediaMode !== 'text'
                      ? `On 3D & Voice Stage (${stageParticipants.length})`
                      : `3D & Voice Stage (${stageParticipants.length})`}
                  </span>
                </button>
              ) : null}

              {isHost &&
              session.status !== 'completed' &&
              session.status !== 'cancelled' ? (
                <>
                  {session.status === 'open' || session.status === 'scheduled' ? (
                    <button
                      type="button"
                      disabled={lifecycleBusy}
                      onClick={() => handleLifecycle('active')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Start Session</span>
                    </button>
                  ) : null}

                  {session.status === 'active' ? (
                    <button
                      type="button"
                      disabled={lifecycleBusy}
                      onClick={() => handleLifecycle('paused')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
                    >
                      <Pause className="h-3.5 w-3.5" />
                      <span>Pause</span>
                    </button>
                  ) : null}

                  {session.status === 'paused' ? (
                    <button
                      type="button"
                      disabled={lifecycleBusy}
                      onClick={() => handleLifecycle('active')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Resume</span>
                    </button>
                  ) : null}

                  {session.status === 'active' && nextPhase ? (
                    <button
                      type="button"
                      disabled={lifecycleBusy}
                      onClick={handleAdvancePhase}
                      className="studio-cta inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white"
                    >
                      <span>Next: {PHASE_METADATA[nextPhase].label}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  ) : null}

                  {session.status === 'active' || session.status === 'paused' ? (
                    <button
                      type="button"
                      disabled={lifecycleBusy}
                      onClick={() => handleLifecycle('completed')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/50 bg-violet-600/20 px-3.5 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-600/30"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>End &amp; Generate AI Report</span>
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          {/* Interactive 3D & Audio/Video Room Stage + Live Named Voice Transcription */}
          {isCurrentlyJoined && stageExpanded && session.status !== 'completed' ? (
            <section
              aria-label="Audio and Video Room Stage"
              className="studio-panel rounded-2xl p-5 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-sky-400">
                    3D Orbital Debate Ring · Attributed Voice-to-Text Stage
                  </p>
                  <h2 className="mt-0.5 font-display text-base font-bold text-white">
                    Live Audio / Video Room Stage &amp; Real-Time Voice Transcription
                  </h2>
                  <p className="text-xs text-slate-400">
                    {mediaTokenInfo
                      ? `Connected to ${mediaTokenInfo.roomName} (${mediaTokenInfo.provider}) · Everything spoken is transcribed with your name for the AI Review & Leaderboard`
                      : 'Speak on stage: your voice turn is transcribed live with your name so listeners can question back and AI can score your reasoning.'}
                  </p>
                </div>

                {selfParticipant?.mediaMode && selfParticipant.mediaMode !== 'text' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleMic}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium ${
                        selfParticipant.micEnabled
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                          : 'border-slate-700 bg-[#080C16] text-slate-300'
                      }`}
                    >
                      {selfParticipant.micEnabled ? (
                        <Mic className="h-3.5 w-3.5" />
                      ) : (
                        <MicOff className="h-3.5 w-3.5" />
                      )}
                      <span>{selfParticipant.micEnabled ? 'Mic On' : 'Mic Muted'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleCam}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium ${
                        selfParticipant.camEnabled
                          ? 'border-sky-500/40 bg-sky-500/15 text-sky-200'
                          : 'border-slate-700 bg-[#080C16] text-slate-300'
                      }`}
                    >
                      {selfParticipant.camEnabled ? (
                        <Video className="h-3.5 w-3.5" />
                      ) : (
                        <VideoOff className="h-3.5 w-3.5" />
                      )}
                      <span>{selfParticipant.camEnabled ? 'Camera On' : 'Camera Off'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleLeaveStage}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#080C16] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
                    >
                      <PhoneOff className="h-3.5 w-3.5" />
                      <span>Step Off Stage</span>
                    </button>

                    <button
                      type="button"
                      disabled={lifecycleBusy}
                      onClick={handleLeave}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-950/50"
                    >
                      <PhoneOff className="h-3.5 w-3.5" />
                      <span>
                        {session.participantCount <= 1
                          ? 'Leave Room (End & Generate Report)'
                          : 'Leave Room'}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mediaConsentChecked}
                        onChange={(e) => setMediaConsentChecked(e.target.checked)}
                        className="rounded border-slate-700 bg-[#080C16] text-sky-500"
                      />
                      <span>I consent to share microphone/camera in this room</span>
                    </label>
                    <button
                      type="button"
                      disabled={mediaBusy}
                      onClick={() => handleJoinStage('audio')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#080C16] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-sky-500"
                    >
                      <Mic className="h-3.5 w-3.5 text-sky-400" />
                      <span>Join Audio Stage</span>
                    </button>
                    <button
                      type="button"
                      disabled={mediaBusy}
                      onClick={() => handleJoinStage('audio_video')}
                      className="studio-cta inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white"
                    >
                      <Video className="h-3.5 w-3.5" />
                      <span>Join Audio + Video Stage</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Split Stage: Left 7 Cols = Interactive 3D 10-Seat Orbital Stage, Right 5 Cols = Active Speaker & Listener Queue */}
              <div className="grid gap-5 lg:grid-cols-12 lg:items-stretch">
                <div className="lg:col-span-7">
                  <ThreeArchitectureStage
                    compact
                    activePreset="debate_ring"
                    customNodes={labData.diagramNodes}
                  />
                </div>

                <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#070B14]/90 p-4 space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-800/80 pb-3">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                        <Radio className="h-3.5 w-3.5" />
                        <span>
                          Floor Speaker:{' '}
                          {activeTurnParticipant?.displayName ?? 'Open Floor'}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] text-sky-400">
                        {activeParticipants.length}/{session.capacity} seats active
                      </span>
                    </div>

                    {localMediaNote ? (
                      <p className="mt-2 rounded-lg border border-sky-500/25 bg-sky-950/20 px-2.5 py-1.5 text-[11px] text-sky-200">
                        3D Spatial Stage Active: Use Live Mic Dictation or type your spoken turn below.
                      </p>
                    ) : null}

                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                      {activeParticipants.map((p, idx) => {
                        const isSelf = p.uid === firebaseUser?.uid;
                        const onStage = p.mediaMode && p.mediaMode !== 'text';
                        const hasFloor = activeTurnParticipant?.uid === p.uid;
                        const standing = roomStandings.find((s) => s.uid === p.uid);
                        const hasLiveVideoStream = Boolean(
                          isSelf && p.camEnabled && localStreamRef.current
                        );

                        return (
                          <div
                            key={p.uid}
                            className={`relative rounded-xl border p-3 ${
                              hasFloor
                                ? 'border-emerald-500/60 bg-gradient-to-b from-emerald-950/35 to-[#0B101D]'
                                : onStage
                                ? 'border-sky-500/45 bg-[#0C1322]'
                                : 'border-slate-800 bg-[#0A0F1C]/80'
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between text-[10px]">
                              <span
                                className={`font-mono uppercase font-semibold ${
                                  hasFloor ? 'text-emerald-400' : 'text-sky-400'
                                }`}
                              >
                                {hasFloor ? '🎙️ Floor Turn' : `Seat #${idx + 1}`}
                              </span>
                              <span className="font-mono font-semibold text-amber-300">
                                {standing?.totalPoints ?? 0} pts
                              </span>
                            </div>

                            {hasLiveVideoStream ? (
                              <video
                                ref={localVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className="mb-2 h-20 w-full rounded-lg bg-slate-950 object-cover"
                              />
                            ) : (
                              <div className="mb-2 flex h-16 items-center justify-between rounded-lg border border-slate-800/80 bg-gradient-to-br from-slate-900 via-[#0E1729] to-slate-950 px-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-500/40 bg-sky-500/15 font-display text-sm font-bold text-white">
                                  {p.displayName.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex items-end gap-1 h-6">
                                  <span className="w-1 h-2.5 rounded-full bg-sky-400/70" />
                                  <span className="w-1 h-5 rounded-full bg-emerald-400/85" />
                                  <span className="w-1 h-3.5 rounded-full bg-sky-400/80" />
                                  <span className="w-1 h-6 rounded-full bg-indigo-400/90" />
                                  <span className="w-1 h-3 rounded-full bg-sky-400/70" />
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-white truncate">
                                {p.displayName} {isSelf ? '(You)' : ''}
                              </span>
                              <div className="flex items-center gap-1">
                                {p.micEnabled ? (
                                  <Mic className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <MicOff className="h-3.5 w-3.5 text-slate-500" />
                                )}
                                {p.camEnabled ? (
                                  <Video className="h-3.5 w-3.5 text-sky-400" />
                                ) : (
                                  <VideoOff className="h-3.5 w-3.5 text-slate-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5">
                    Tip: Select your turn intent below (*Propose Approach*, *Question Back*, *Clarify Constraint*, or *Defend Trade-Off*) to earn AI debate points.
                  </p>
                </div>
              </div>

              {/* Live Voice-to-Text Transcription & Spoken Turn Bar */}
              <form
                onSubmit={handlePublishSpokenTranscript}
                className="rounded-xl border border-sky-500/35 bg-[#070B14] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-white">
                      Live Stage Voice Transcription — Speaking as{' '}
                      <span className="text-sky-400">
                        {profile?.displayName ?? 'You'}
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'approach', label: 'Propose Approach (+40)' },
                        { id: 'question_back', label: 'Question Back (+35)' },
                        { id: 'clarification', label: 'Clarify Constraint (+30)' },
                        { id: 'tradeoff_defense', label: 'Defend Trade-Off (+35)' },
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setSpokenIntent(mode.id)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          spokenIntent === mode.id
                            ? 'border-sky-500 bg-sky-500/20 text-sky-200'
                            : 'border-slate-800 bg-[#0C121E] text-slate-400 hover:text-white'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={
                      interimSpeech
                        ? `${spokenDraft} ${interimSpeech}`.trim()
                        : spokenDraft
                    }
                    onChange={(e) => {
                      setInterimSpeech('');
                      setSpokenDraft(e.target.value);
                    }}
                    placeholder={`Speak via mic or type what ${profile?.displayName ?? 'you'} is saying on stage (e.g., "To improve rate limiting and load balancing, I propose a Redis token bucket...")`}
                    className="flex-1 rounded-xl border border-slate-700 bg-[#0C121E] px-3.5 py-2.5 text-xs text-white placeholder-slate-500"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleToggleSpeechRecognition}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                        isTranscribingVoice
                          ? 'border-red-500/50 bg-red-500/20 text-red-200 animate-pulse'
                          : 'border-slate-700 bg-[#0C121E] text-slate-200 hover:border-emerald-500/50'
                      }`}
                    >
                      <Mic className="h-3.5 w-3.5 text-emerald-400" />
                      <span>
                        {isTranscribingVoice ? 'Stop Mic Dictation' : 'Live Mic Dictation'}
                      </span>
                    </button>
                    <button
                      type="submit"
                      disabled={
                        sending || !`${spokenDraft} ${interimSpeech}`.trim()
                      }
                      className="studio-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Speak &amp; Transcribe Turn</span>
                    </button>
                  </div>
                </div>
              </form>
            </section>
          ) : null}

          {/* Post-Completion AI Evaluation Banner */}
          {session.status === 'completed' && isMember ? (
            <div className="rounded-xl border border-blue-500/40 bg-blue-600/10 p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-white">
                  Session Completed — AI Review, Points &amp; Formative Report Ready
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Inspect your AI review points (Best Approach, Questioning Back, Best Clarification, Trade-Off Defense) and personalized upskill roadmap.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/leaderboard"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
                >
                  <Trophy className="h-4 w-4" />
                  <span>Leaderboard</span>
                </Link>
                <Link
                  to={`/sessions/${session.id}/report?autogen=1`}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 whitespace-nowrap"
                >
                  Open AI Review &amp; Points
                </Link>
              </div>
            </div>
          ) : null}

          {!isMember ? (
            <div className="rounded-xl border border-slate-800 bg-[#111827] p-8 text-center">
              <h2 className="font-display text-lg font-semibold text-white">
                {session.participantCount >= session.capacity
                  ? `This room is currently at capacity (${session.capacity} seats)`
                  : 'Join this session to speak on stage, view live transcripts, and earn debate points'}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {session.participantCount >= session.capacity
                  ? 'Join the FIFO waitlist to reserve your spot if a seat opens up.'
                  : 'Up to 10 developers/students can join a room, answer in turn, question back, and receive AI review points.'}
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {session.participantCount < session.capacity &&
                session.status !== 'completed' ? (
                  <button
                    type="button"
                    onClick={handleJoin}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
                  >
                    Join Session
                  </button>
                ) : null}

                {session.participantCount >= session.capacity &&
                session.status !== 'completed' ? (
                  isWaitlisted ? (
                    <button
                      type="button"
                      onClick={handleLeaveWaitlist}
                      className="rounded-lg border border-amber-500/50 bg-amber-950/30 px-5 py-2.5 text-sm font-medium text-amber-200 hover:bg-amber-950/50"
                    >
                      On Waitlist (#
                      {waitlist.findIndex((w) => w.uid === firebaseUser?.uid) + 1}) · Leave Waitlist
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleJoinWaitlist}
                      className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-500"
                    >
                      Join Room Waitlist ({waitlist.length} waiting)
                    </button>
                  )
                ) : null}
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Main Discussion Stream + Composer */}
              <div className="lg:col-span-7 flex flex-col rounded-xl border border-slate-800 bg-[#111827] overflow-hidden">
                {/* Turn Guidance Strip */}
                <div className="border-b border-slate-800 bg-[#0E131D] px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300">
                    Next expected action:{' '}
                    <strong className="text-white">
                      {phaseInfo?.participantAction}
                    </strong>
                  </span>
                  {activeTurnParticipant ? (
                    <span className="font-mono text-emerald-400">
                      🎙️ Floor Turn: {activeTurnParticipant.displayName}
                    </span>
                  ) : null}
                </div>

                {/* Messages */}
                <div className="flex-1 space-y-4 p-5 max-h-[540px] overflow-y-auto">
                  {messages.length === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-400">
                      No spoken turns or contributions transcribed yet. Use the Live Stage Voice Transcription bar above or the composer below to share your opening approach!
                    </div>
                  ) : (
                    messages
                      .filter((m) => !blockedUids.includes(m.senderUid))
                      .map((msg) => {
                        const isSelf = msg.senderUid === firebaseUser?.uid;
                        if (msg.messageType === 'pass') {
                          return (
                            <div
                              key={msg.id}
                              className="rounded-lg border border-slate-800/80 bg-[#0B0F17] px-4 py-2.5 text-xs text-slate-400 flex items-center justify-between"
                            >
                              <span>{msg.body}</span>
                              <span className="font-mono tabular-nums">
                                {new Date(msg.createdAtMs).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={msg.id}
                            className={`rounded-xl border p-4 ${
                              isSelf
                                ? 'border-blue-500/30 bg-blue-950/15'
                                : 'border-slate-800 bg-[#0B0F17]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-200">
                                  {msg.senderDisplayName}
                                  {isSelf ? ' (You)' : ''}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="capitalize">
                                  {msg.phase.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono tabular-nums">
                                  {new Date(msg.createdAtMs).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                {canPost ? (
                                  <button
                                    type="button"
                                    onClick={() => setReplyToId(msg.id)}
                                    className="text-blue-400 hover:text-blue-300"
                                  >
                                    Question Back / Reply
                                  </button>
                                ) : null}
                                {!isSelf ? (
                                  <>
                                    <button
                                      type="button"
                                      aria-label={`Report message from ${msg.senderDisplayName}`}
                                      onClick={() =>
                                        setReportTarget({
                                          targetUid: msg.senderUid,
                                          messageId: msg.id,
                                          displayName: msg.senderDisplayName,
                                        })
                                      }
                                      className="text-slate-500 hover:text-amber-400"
                                    >
                                      <Flag className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Block ${msg.senderDisplayName}`}
                                      onClick={() => handleBlockPeer(msg.senderUid)}
                                      className="text-slate-500 hover:text-red-400"
                                    >
                                      <Ban className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </div>

                            {msg.replyToMessageId ? (
                              <div className="mt-2 rounded border-l-2 border-blue-500/60 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-400">
                                <span className="font-medium text-blue-300">
                                  Replying to{' '}
                                  {messageById.get(msg.replyToMessageId)
                                    ?.senderDisplayName ??
                                    msg.replyToMessageId.slice(0, 10)}
                                  :
                                </span>{' '}
                                <span className="italic">
                                  {messageById
                                    .get(msg.replyToMessageId)
                                    ?.body.slice(0, 100) ?? 'earlier contribution'}
                                </span>
                              </div>
                            ) : null}

                            <div className="mt-2.5">
                              <SafeMarkdown content={msg.body} />
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>

                {/* Composer */}
                <form
                  onSubmit={handleSendMessage}
                  className="border-t border-slate-800 bg-[#0E131D] p-4 space-y-3"
                >
                  {replyToId ? (
                    <div className="flex items-center justify-between text-xs text-blue-300">
                      <span>Replying to message {replyToId.slice(0, 12)}</span>
                      <button
                        type="button"
                        onClick={() => setReplyToId(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        Cancel reply
                      </button>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-[#0B0F17] p-0.5">
                      <button
                        type="button"
                        onClick={() => setMessageMode('text')}
                        className={`rounded px-2.5 py-1 text-xs font-medium ${
                          messageMode === 'text'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Markdown
                      </button>
                      <button
                        type="button"
                        onClick={() => setMessageMode('code')}
                        className={`rounded px-2.5 py-1 text-xs font-medium ${
                          messageMode === 'code'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Code Snippet
                      </button>
                    </div>
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      {composerBody.length}/{MAX_MESSAGE_LENGTH}
                    </span>
                  </div>

                  <textarea
                    rows={3}
                    maxLength={MAX_MESSAGE_LENGTH}
                    disabled={!canPost || sending}
                    value={composerBody}
                    onChange={(e) => setComposerBody(e.target.value)}
                    placeholder={
                      canPost
                        ? messageMode === 'code'
                          ? 'Paste a snippet or schema (code is safely escaped, never executed)...'
                          : 'Explain your reasoning, challenge an approach, or ask a clarifying question...'
                        : `Posting is disabled while session is ${session.status}.`
                    }
                    className={`w-full rounded-lg border border-slate-700 bg-[#0B0F17] p-3 text-sm text-white placeholder-slate-500 disabled:opacity-50 ${
                      messageMode === 'code' ? 'font-mono text-[13px]' : ''
                    }`}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={!canPost || sending}
                      onClick={handlePassTurn}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      <span>Pass Turn</span>
                    </button>

                    <button
                      type="submit"
                      disabled={!canPost || sending || !composerBody.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{sending ? 'Sending...' : 'Send Contribution'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Context & Shared Engineering Labs Sidebar (5 columns) */}
              <aside className="lg:col-span-5 space-y-4">
                <div className="rounded-xl border border-slate-800 bg-[#111827] overflow-hidden">
                  <div className="flex flex-wrap border-b border-slate-800">
                    {(
                      [
                        { id: 'timeline', label: 'Points & Roster' },
                        { id: 'brief', label: 'Brief' },
                        { id: 'arch_lab', label: 'Arch Lab' },
                        { id: 'code_lab', label: 'Code Lab' },
                        { id: 'scratchpad', label: 'Notes' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setRightTab(tab.id)}
                        className={`flex-1 py-3 px-2 text-xs font-medium transition-colors whitespace-nowrap ${
                          rightTab === tab.id
                            ? 'border-b-2 border-blue-500 text-blue-400 bg-[#0E131D]'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-5">
                    {rightTab === 'brief' ? (
                      scenario ? (
                        <div className="space-y-4 text-sm">
                          <div>
                            <p className="text-xs font-medium text-blue-400">Context</p>
                            <p className="mt-1 text-slate-300 leading-relaxed">
                              {scenario.context}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-blue-400">Prompt</p>
                            <p className="mt-1 text-slate-200 leading-relaxed">
                              {scenario.prompt}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-400">
                              Constraints
                            </p>
                            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-300">
                              {scenario.constraints.map((c, idx) => (
                                <li key={idx}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Loading scenario brief...
                        </p>
                      )
                    ) : null}

                    {rightTab === 'arch_lab' ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-blue-400" />
                            <h3 className="text-xs font-semibold text-slate-200">
                              Collaborative 3D &amp; 2D System Topology Lab
                            </h3>
                          </div>
                          <span className="font-mono text-[10px] text-blue-400 tabular-nums">
                            Live 3D Stage
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Model components and protocol boundaries together. Changes sync across all room participants and update the 3D topology stage.
                        </p>

                        <ThreeArchitectureStage
                          compact
                          activePreset="load_balancer"
                          customNodes={labData.diagramNodes}
                        />

                        <form
                          onSubmit={handleAddDiagramNode}
                          className="grid gap-2 sm:grid-cols-12"
                        >
                          <input
                            type="text"
                            value={newNodeLabel}
                            onChange={(e) => setNewNodeLabel(e.target.value)}
                            placeholder="Component name (e.g., Redis Cache)"
                            className="sm:col-span-6 rounded-lg border border-slate-700 bg-[#0B0F17] px-2.5 py-1.5 text-xs text-white"
                          />
                          <select
                            aria-label="Component kind"
                            value={newNodeKind}
                            onChange={(e) =>
                              setNewNodeKind(e.target.value as ArchitectureNodeKind)
                            }
                            className="sm:col-span-4 rounded-lg border border-slate-700 bg-[#0B0F17] px-2 py-1.5 text-xs text-white capitalize"
                          >
                            {ARCHITECTURE_NODE_KINDS.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="sm:col-span-2 inline-flex items-center justify-center rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </form>

                        {labData.diagramNodes.length >= 2 ? (
                          <form
                            onSubmit={handleAddDiagramEdge}
                            className="grid gap-2 sm:grid-cols-12 pt-1"
                          >
                            <select
                              aria-label="Source component"
                              value={newEdgeFrom}
                              onChange={(e) => setNewEdgeFrom(e.target.value)}
                              className="sm:col-span-4 rounded-lg border border-slate-700 bg-[#0B0F17] px-2 py-1.5 text-xs text-white"
                            >
                              <option value="">From...</option>
                              {labData.diagramNodes.map((n) => (
                                <option key={n.id} value={n.id}>
                                  {n.label}
                                </option>
                              ))}
                            </select>
                            <select
                              aria-label="Target component"
                              value={newEdgeTo}
                              onChange={(e) => setNewEdgeTo(e.target.value)}
                              className="sm:col-span-4 rounded-lg border border-slate-700 bg-[#0B0F17] px-2 py-1.5 text-xs text-white"
                            >
                              <option value="">To...</option>
                              {labData.diagramNodes.map((n) => (
                                <option key={n.id} value={n.id}>
                                  {n.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={newEdgeProtocol}
                              onChange={(e) => setNewEdgeProtocol(e.target.value)}
                              placeholder="gRPC / SQL"
                              className="sm:col-span-3 rounded-lg border border-slate-700 bg-[#0B0F17] px-2 py-1.5 text-xs text-white"
                            />
                            <button
                              type="submit"
                              className="sm:col-span-1 inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white hover:bg-slate-700"
                            >
                              Link
                            </button>
                          </form>
                        ) : null}

                        <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 space-y-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Components ({labData.diagramNodes.length})
                          </p>
                          {labData.diagramNodes.length === 0 ? (
                            <p className="text-xs text-slate-500">
                              No architecture components added yet. Add services, caches, queues, or databases above.
                            </p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {labData.diagramNodes.map((node) => (
                                <div
                                  key={node.id}
                                  className="flex items-center justify-between rounded border border-slate-800 bg-[#111827] px-2.5 py-1.5 text-xs"
                                >
                                  <div className="truncate">
                                    <span className="font-mono text-[10px] uppercase text-blue-400 mr-1.5">
                                      [{node.kind}]
                                    </span>
                                    <span className="font-medium text-slate-200">
                                      {node.label}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    aria-label={`Remove ${node.label}`}
                                    onClick={() => handleDeleteNode(node.id)}
                                    className="text-slate-500 hover:text-red-400 ml-2"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {labData.diagramEdges.length > 0 ? (
                            <div className="border-t border-slate-800 pt-2.5">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                                Data &amp; Call Flows ({labData.diagramEdges.length})
                              </p>
                              <ul className="space-y-1 font-mono text-xs text-slate-300">
                                {labData.diagramEdges.map((edge) => {
                                  const from =
                                    labData.diagramNodes.find(
                                      (n) => n.id === edge.fromId
                                    )?.label ?? edge.fromId;
                                  const to =
                                    labData.diagramNodes.find(
                                      (n) => n.id === edge.toId
                                    )?.label ?? edge.toId;
                                  return (
                                    <li key={edge.id}>
                                      {from} <span className="text-blue-400">──({edge.protocol})──▶</span> {to}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {rightTab === 'code_lab' ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Code2 className="h-4 w-4 text-blue-400" />
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                            Code &amp; Telemetry Review Lab
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400">
                          Click any line number below to pin a constructive review finding or incident hypothesis.
                        </p>

                        <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-800 bg-[#0B0F17] p-2 font-mono text-[11px] leading-relaxed">
                          {codeArtifactLines.map((lineText, idx) => {
                            const lineNum = idx + 1;
                            const isSelected = selectedCodeLine === lineNum;
                            const hasAnnotation = labData.annotations.some(
                              (a) => a.lineNumber === lineNum
                            );
                            return (
                              <button
                                key={lineNum}
                                type="button"
                                onClick={() => setSelectedCodeLine(lineNum)}
                                className={`flex w-full items-start gap-2.5 rounded px-2 py-0.5 text-left ${
                                  isSelected
                                    ? 'bg-blue-600/20 text-white'
                                    : hasAnnotation
                                    ? 'bg-amber-500/10 text-amber-200'
                                    : 'text-slate-300 hover:bg-slate-900'
                                }`}
                              >
                                <span className="w-6 shrink-0 select-none text-right text-slate-500">
                                  {lineNum}
                                </span>
                                <span className="whitespace-pre-wrap break-all">
                                  {lineText || ' '}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <form
                          onSubmit={handleAddCodeAnnotation}
                          className="space-y-2 rounded-lg border border-slate-800 bg-[#0B0F17] p-3"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-mono text-blue-400">
                              Annotating Line #{selectedCodeLine}
                            </span>
                            <select
                              aria-label="Annotation severity"
                              value={annotationSeverity}
                              onChange={(e) =>
                                setAnnotationSeverity(
                                  e.target.value as 'question' | 'suggestion' | 'risk'
                                )
                              }
                              className="rounded border border-slate-700 bg-[#111827] px-2 py-1 text-xs text-white"
                            >
                              <option value="question">Info / Question</option>
                              <option value="suggestion">Suggestion / Improvement</option>
                              <option value="risk">Trade-off / Blocking Risk</option>
                            </select>
                          </div>
                          <input
                            type="text"
                            value={annotationComment}
                            onChange={(e) => setAnnotationComment(e.target.value)}
                            placeholder="Explain the defect, failure mode, or suggested fix..."
                            className="w-full rounded border border-slate-700 bg-[#111827] px-2.5 py-1.5 text-xs text-white"
                          />
                          <button
                            type="submit"
                            className="w-full rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                          >
                            Pin Line Annotation
                          </button>
                        </form>

                        {labData.annotations.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                              Pinned Findings ({labData.annotations.length})
                            </p>
                            {labData.annotations.map((ann) => (
                              <div
                                key={ann.id}
                                className="rounded-lg border border-slate-800 bg-[#0B0F17] p-2.5 text-xs"
                              >
                                <div className="flex items-center justify-between text-[11px] text-slate-400">
                                  <span className="font-mono text-blue-400">
                                    Line {ann.lineNumber} · {ann.severity.toUpperCase()}
                                  </span>
                                  <span>{ann.authorName}</span>
                                </div>
                                <p className="mt-1 text-slate-200">{ann.comment}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {rightTab === 'scratchpad' ? (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-400">
                          Collaborative technical notes &amp; architecture scratchpad shared by room members.
                        </p>
                        <textarea
                          rows={12}
                          disabled={
                            session.status === 'completed' ||
                            session.status === 'cancelled'
                          }
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-[#0B0F17] p-3 font-mono text-xs leading-relaxed text-slate-200"
                        />
                        <button
                          type="button"
                          disabled={savingNotes || session.status === 'completed'}
                          onClick={handleSaveNotes}
                          className="w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-xs font-medium text-slate-200 hover:border-blue-500 disabled:opacity-50"
                        >
                          {savingNotes ? 'Saving notes...' : 'Save Shared Notes'}
                        </button>
                      </div>
                    ) : null}

                    {rightTab === 'timeline' ? (
                      <div className="space-y-5">
                        {/* Live AI Debate & GD Points Leaderboard inside Room */}
                        <div className="rounded-lg border border-amber-500/30 bg-[#0B0F17] p-3 text-xs space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                              <Trophy className="h-4 w-4" />
                              <span>Live Room Debate Points</span>
                            </div>
                            <Link
                              to="/leaderboard"
                              className="text-[11px] font-medium text-blue-400 hover:text-blue-300"
                            >
                              Full Leaderboard →
                            </Link>
                          </div>
                          <p className="text-[11px] leading-relaxed text-slate-400">
                            AI scores points for Best Approach, Questioning Back, Best Clarification, and Trade-Off Defense.
                          </p>
                          <div className="space-y-2 pt-1">
                            {roomStandings.map((st, idx) => (
                              <div
                                key={st.uid}
                                className="rounded border border-slate-800 bg-[#111827] p-2.5 space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-white">
                                    #{idx + 1} {st.displayName}
                                  </span>
                                  <span className="font-mono font-bold text-amber-300">
                                    {st.totalPoints} pts
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-300">
                                  <span>💡 Approach: {st.bestApproachPts}</span>
                                  <span>❓ Question Back: {st.questionBackPts}</span>
                                  <span>🔍 Clarification: {st.clarificationPts}</span>
                                  <span>⚖️ Defense: {st.tradeoffDefensePts}</span>
                                </div>
                                {st.badges.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {st.badges.map((b) => (
                                      <span
                                        key={b}
                                        className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-200"
                                      >
                                        <Award className="h-2.5 w-2.5" />
                                        {b}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Participation Balance Diagnostic (Non-Scored Fairness Check) */}
                        <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-200">
                              Participation Balance
                            </span>
                            <span
                              className={`font-mono uppercase text-[11px] ${
                                contributionDistribution.balanceStatus === 'balanced'
                                  ? 'text-emerald-400'
                                  : contributionDistribution.balanceStatus === 'skewed'
                                  ? 'text-amber-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {contributionDistribution.balanceStatus.replace(
                                /_/g,
                                ' '
                              )}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-slate-400">
                            Fairness diagnostic only — message count is never scored as engineering skill.
                            {contributionDistribution.quieterParticipants.length > 0
                              ? ` Quieter member(s): ${contributionDistribution.quieterParticipants
                                  .map((q) => q.displayName)
                                  .join(', ')}.`
                              : ''}
                          </p>
                        </div>

                        <div>
                          <h3 className="text-xs font-medium text-slate-400">
                            Participants ({activeParticipants.length}/{session.capacity})
                          </h3>
                          <ul className="mt-2 space-y-2.5">
                            {contributionDistribution.perParticipant.map((p) => {
                              const isNextTurn = session.activeTurnUid === p.uid;
                              return (
                                <li
                                  key={p.uid}
                                  className="rounded-lg border border-slate-800/80 bg-[#0B0F17] p-2.5 text-xs space-y-1.5"
                                >
                                  <div className="flex items-center justify-between text-slate-200">
                                    <span className="font-medium">
                                      {p.displayName}{' '}
                                      {isNextTurn ? (
                                        <span className="font-mono text-[10px] text-blue-400">
                                          (Next Turn)
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className="capitalize text-slate-400">
                                      {p.role}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                                    <span className="font-mono tabular-nums">
                                      {p.messageCount} contrib · {p.passCount} pass (
                                      {p.sharePct}%)
                                    </span>
                                    {isHost && canPost ? (
                                      <div className="flex items-center gap-2">
                                        {!isNextTurn ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleInviteTurn(p.uid, p.displayName)
                                            }
                                            className="text-blue-400 hover:text-blue-300 font-medium"
                                          >
                                            Invite Turn
                                          </button>
                                        ) : null}
                                        {p.uid !== session.hostUid ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveParticipant(
                                                p.uid,
                                                p.displayName
                                              )
                                            }
                                            className="text-red-400 hover:text-red-300"
                                          >
                                            Remove
                                          </button>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        {waitlist.length > 0 ? (
                          <div className="border-t border-slate-800 pt-4">
                            <h3 className="text-xs font-medium text-amber-400">
                              FIFO Waitlist ({waitlist.length})
                            </h3>
                            <ul className="mt-2 space-y-1.5 text-xs text-slate-300">
                              {waitlist.map((w, idx) => (
                                <li
                                  key={w.uid}
                                  className="flex items-center justify-between"
                                >
                                  <span>
                                    #{idx + 1} {w.displayName}
                                  </span>
                                  <span className="font-mono text-[11px] text-slate-500">
                                    waiting
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="border-t border-slate-800 pt-4">
                          <h3 className="text-xs font-medium text-slate-400">
                            Session Events
                          </h3>
                          <ul className="mt-2 space-y-2 text-xs text-slate-400">
                            {events.slice(0, 12).map((evt) => (
                              <li key={evt.id}>{evt.summary}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      )}

      {/* Moderation Report Modal */}
      {reportTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#111827] p-6">
            <h2 className="font-display text-base font-semibold text-white">
              Report content from {reportTarget.displayName}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Reports enter the moderator review queue. Your identity is kept confidential from the reported participant.
            </p>
            <form onSubmit={handleSubmitReport} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="repCat"
                  className="block text-xs font-medium text-slate-300"
                >
                  Category
                </label>
                <select
                  id="repCat"
                  value={reportCategory}
                  onChange={(e) =>
                    setReportCategory(e.target.value as ReportCategory)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white capitalize"
                >
                  <option value="harassment">Harassment or personal attack</option>
                  <option value="spam">Spam or flooding</option>
                  <option value="pii_exposure">
                    Personal / confidential data exposure
                  </option>
                  <option value="malicious_content">
                    Malicious link or unsafe payload
                  </option>
                  <option value="off_topic">Disruptive / off-topic</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="repDetails"
                  className="block text-xs font-medium text-slate-300"
                >
                  Details
                </label>
                <textarea
                  id="repDetails"
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={3}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Describe what happened..."
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F17] p-2.5 text-sm text-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-500"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
