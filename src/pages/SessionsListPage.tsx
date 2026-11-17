import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Box,
  Clock,
  FileText,
  Mic,
  Plus,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { WorkspaceShell } from '../components/AppShell';
import { ThreeArchitectureStage } from '../components/ThreeArchitectureStage';
import { useAuth } from '../features/auth/AuthContext';
import { fetchPublishedCatalogue } from '../features/catalogue/catalogueService';
import {
  createSessionRoom,
  joinSessionRoom,
  listPublicSessions,
  listUserJoinedSessions,
  reconcileStaleUserRooms,
} from '../features/sessions/sessionService';
import { Link, useRouter } from '../lib/router';
import {
  DISCUSSION_PHASES,
  ROOM_TYPES,
  type RoomType,
  type ScenarioItem,
  type SessionStatus,
  type SessionSummary,
} from '../../packages/domain/src/types';
import heroDebateImg from '../assets/images/hero_engineering_debate_stage_1794544516148.jpg';

export function SessionsListPage() {
  const { firebaseUser, profile } = useAuth();
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [publicSessions, setPublicSessions] = useState<SessionSummary[]>([]);
  const [mySessions, setMySessions] = useState<SessionSummary[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | SessionStatus>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [show3DTopology, setShow3DTopology] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [quickLaunchingId, setQuickLaunchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('system_design');
  const [capacity, setCapacity] = useState(10);
  const [participationMode, setParticipationMode] = useState<'async' | 'scheduled'>('async');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [creating, setCreating] = useState(false);

  const refreshSessions = async () => {
    if (!firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      await reconcileStaleUserRooms({
        uid: firebaseUser.uid,
        displayName:
          profile?.displayName ?? firebaseUser.displayName ?? 'Participant',
        activeSessionId: null,
        profile,
      });

      const [pub, mine, cat] = await Promise.all([
        listPublicSessions(),
        listUserJoinedSessions(firebaseUser.uid),
        fetchPublishedCatalogue(),
      ]);
      setPublicSessions(pub);
      setMySessions(mine);
      setScenarios(cat.scenarios);
      if (cat.scenarios.length > 0 && !selectedScenarioId) {
        setSelectedScenarioId(cat.scenarios[0].id);
        setCustomTitle(cat.scenarios[0].title);
        setRoomType(cat.scenarios[0].roomType);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshSessions();
  }, [firebaseUser, profile?.displayName]);

  const mergedSessions = Array.from(
    new Map([...mySessions, ...publicSessions].map((s) => [s.id, s])).values()
  ).filter((s) => statusFilter === 'all' || s.status === statusFilter);

  const handleJoin = async (session: SessionSummary) => {
    if (!firebaseUser || !profile) return;
    if (session.participantCount >= session.capacity) {
      navigate(`/sessions/${session.id}`);
      return;
    }
    setError(null);
    setJoiningId(session.id);
    try {
      if (!session.participantUids.includes(firebaseUser.uid)) {
        await joinSessionRoom({
          sessionId: session.id,
          uid: firebaseUser.uid,
          displayName: profile.displayName,
        });
      }
      navigate(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join session.');
    } finally {
      setJoiningId(null);
    }
  };

  const handleQuickLaunchScenario = async (scenario: ScenarioItem) => {
    if (!firebaseUser || !profile) return;
    setQuickLaunchingId(scenario.id);
    setError(null);
    try {
      const sessionId = await createSessionRoom({
        scenario,
        hostUid: firebaseUser.uid,
        hostDisplayName: profile.displayName,
        title: scenario.title,
        roomType: scenario.roomType,
        participationMode: 'async',
        visibility: 'public',
        capacity: 10,
        startsAtMs: null,
      });
      navigate(`/sessions/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not launch room.');
      setQuickLaunchingId(null);
    }
  };

  const handleCreateSession = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile) return;
    const scenario = scenarios.find((s) => s.id === selectedScenarioId);
    if (!scenario) return;

    const parsedStartMs =
      participationMode === 'scheduled' && scheduledDateTime
        ? new Date(scheduledDateTime).getTime()
        : null;

    setCreating(true);
    setError(null);
    try {
      const sessionId = await createSessionRoom({
        scenario,
        hostUid: firebaseUser.uid,
        hostDisplayName: profile.displayName,
        title: customTitle.trim() || scenario.title,
        roomType,
        participationMode,
        visibility,
        capacity,
        startsAtMs:
          parsedStartMs && !Number.isNaN(parsedStartMs) ? parsedStartMs : null,
      });
      setShowCreate(false);
      navigate(`/sessions/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create session.');
    } finally {
      setCreating(false);
    }
  };

  const activeCount = mergedSessions.filter(
    (s) => s.status === 'open' || s.status === 'active' || s.status === 'scheduled'
  ).length;
  const completedCount = mergedSessions.filter(
    (s) => s.status === 'completed'
  ).length;

  return (
    <WorkspaceShell
      title="10-Seat Engineering Debate Rooms"
      breadcrumb="Live Audio/Video Stage · Named Voice Transcription · Auto-Ending & AI Scoring"
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShow3DTopology((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3.5 py-2 text-xs font-medium text-sky-300 hover:bg-sky-500/20 whitespace-nowrap"
          >
            <Box className="h-3.5 w-3.5" />
            <span>{show3DTopology ? 'Hide 3D Ring' : '3D 10-Seat Ring'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="studio-cta inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Create Custom Room</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {error}
          </div>
        ) : null}

        {/* Interactive 3D 10-Seat Ring Toggle */}
        {show3DTopology ? (
          <ThreeArchitectureStage compact activePreset="debate_ring" />
        ) : null}

        {/* Studio War-Room Hero & Instant Pre-Decided Topic Launcher */}
        <section className="studio-panel relative overflow-hidden rounded-2xl">
          <img
            src={heroDebateImg}
            alt="10-Seat Engineering Debate Studio"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#06090F]/95 via-[#06090F]/85 to-[#06090F]/70" />

          <div className="relative z-10 p-6 space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-sky-400">
                  Pre-Decided System Topics · Live Voice-to-Text Attribution
                </p>
                <h2 className="mt-1 font-display text-xl font-bold text-white sm:text-2xl">
                  Launch a 10-seat debate room or join an active engineering stage
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  Everyone gets a dedicated turn to answer, question back, or clarify constraints. Everything spoken on stage is transcribed with your name, and rooms automatically close and generate your AI evaluation report &amp; leaderboard points as soon as the last participant leaves.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="rounded-xl border border-slate-800/90 bg-[#080C16]/90 px-4 py-2.5 text-right">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    Active / Open
                  </p>
                  <p className="font-mono text-lg font-bold text-sky-400 tabular-nums">
                    {activeCount} rooms
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800/90 bg-[#080C16]/90 px-4 py-2.5 text-right">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    Evaluated
                  </p>
                  <p className="font-mono text-lg font-bold text-emerald-400 tabular-nums">
                    {completedCount} completed
                  </p>
                </div>
              </div>
            </div>

            {/* 1-Click Pre-Decided Scenario Quick-Launch Strip */}
            {scenarios.length > 0 ? (
              <div className="border-t border-slate-800/80 pt-4">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                    Instant 1-Click Room Launch (Pre-Decided System Topics · 10 Seats)
                  </span>
                  <Link
                    to="/leaderboard"
                    className="inline-flex items-center gap-1 font-mono text-xs text-amber-300 hover:text-amber-200"
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    <span>View Live Points Leaderboard →</span>
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {scenarios.slice(0, 4).map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      disabled={quickLaunchingId === sc.id}
                      onClick={() => handleQuickLaunchScenario(sc)}
                      className="group flex flex-col justify-between rounded-xl border border-slate-800/90 bg-[#080C16]/85 p-3.5 text-left hover:border-sky-500/50 hover:bg-[#0D1424] transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-sky-400 font-mono">
                          <span className="uppercase">
                            {sc.roomType.replace(/_/g, ' ')}
                          </span>
                          <span>10 seats</span>
                        </div>
                        <p className="mt-1 line-clamp-2 font-display text-xs font-semibold text-white group-hover:text-sky-300">
                          {sc.title}
                        </p>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/70 pt-2 text-[11px] text-slate-400">
                        <span className="capitalize">{sc.difficulty}</span>
                        <span className="inline-flex items-center gap-1 font-medium text-sky-400">
                          <span>
                            {quickLaunchingId === sc.id
                              ? 'Launching...'
                              : 'Launch Room'}
                          </span>
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-[#0C121E] p-1">
            {(['all', 'open', 'scheduled', 'active', 'paused', 'completed'] as const).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                    statusFilter === st
                      ? 'studio-cta text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              )
            )}
          </div>
          <p className="font-mono text-xs text-slate-400">
            Showing {mergedSessions.length} discussion room
            {mergedSessions.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Rooms Grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-2xl border border-slate-800 bg-[#0C121E]"
              />
            ))}
          </div>
        ) : mergedSessions.length === 0 ? (
          <div className="studio-panel rounded-2xl p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-sky-400" />
            <h2 className="mt-3 font-display text-base font-semibold text-white">
              No sessions match this filter yet
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Click any pre-decided topic card above or create a custom 10-seat room to begin.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="studio-cta mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              <span>Create Session Room</span>
            </button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {mergedSessions.map((session) => {
              const isCurrentlyInside = Boolean(
                firebaseUser && session.participantUids.includes(firebaseUser.uid)
              );
              const wasParticipantOrHost = Boolean(
                firebaseUser &&
                  (session.participantUids.includes(firebaseUser.uid) ||
                    session.hostUid === firebaseUser.uid ||
                    mySessions.some((m) => m.id === session.id))
              );
              const isFull = session.participantCount >= session.capacity;
              const phaseIndex = Math.max(
                0,
                DISCUSSION_PHASES.indexOf(session.currentPhase)
              );
              const occupancyPct = Math.min(
                100,
                Math.round(
                  (session.participantCount / Math.max(1, session.capacity)) * 100
                )
              );

              return (
                <article
                  key={session.id}
                  className="studio-panel-interactive flex flex-col justify-between rounded-2xl p-5 space-y-4"
                >
                  <div className="space-y-3">
                    {/* Top Metadata Row */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5 text-slate-400">
                        <span
                          className={`font-mono font-semibold uppercase tracking-wider ${
                            session.status === 'completed'
                              ? 'text-emerald-400'
                              : session.status === 'active'
                              ? 'text-amber-300'
                              : 'text-sky-400'
                          }`}
                        >
                          {session.status}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize text-slate-200 font-medium">
                          {session.roomType.replace(/_/g, ' ')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{session.difficulty}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        Host: {session.hostDisplayName}
                      </span>
                    </div>

                    {/* Room Title */}
                    <h2 className="font-display text-lg font-bold text-white leading-snug">
                      {session.title}
                    </h2>

                    {/* Seat Occupancy & Phase Progress Visual Bar */}
                    <div className="rounded-xl border border-slate-800/90 bg-[#070B14]/85 p-3 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1.5 text-slate-300">
                          <Mic className="h-3.5 w-3.5 text-sky-400" />
                          <span>
                            Phase:{' '}
                            <strong className="capitalize text-white">
                              {session.currentPhase.replace(/_/g, ' ')}
                            </strong>
                          </span>
                        </span>
                        <span className="font-mono text-xs font-semibold text-sky-300 tabular-nums">
                          {session.participantCount}/{session.capacity} seats
                        </span>
                      </div>

                      {/* Occupancy Progress Bar */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full transition-all ${
                            session.status === 'completed'
                              ? 'bg-emerald-500'
                              : 'bg-gradient-to-r from-sky-500 to-indigo-500'
                          }`}
                          style={{
                            width: `${
                              session.status === 'completed' ? 100 : occupancyPct
                            }%`,
                          }}
                        />
                      </div>

                      {/* 6-Step Phase Progress Dots */}
                      <div className="grid grid-cols-6 gap-1 pt-0.5">
                        {DISCUSSION_PHASES.map((ph, idx) => (
                          <div
                            key={ph}
                            title={ph.replace(/_/g, ' ')}
                            className={`h-1 rounded-full ${
                              idx <= phaseIndex
                                ? session.status === 'completed'
                                  ? 'bg-emerald-400/80'
                                  : 'bg-sky-400'
                                : 'bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Actions Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      {session.status === 'completed' ? (
                        <span className="text-emerald-400 font-medium">
                          Room ended · AI Report &amp; points ready
                        </span>
                      ) : (
                        <span>
                          Live voice transcription · Auto-ends when empty
                        </span>
                      )}
                      {session.startsAtMs ? (
                        <span className="inline-flex items-center gap-1 text-sky-300">
                          <Clock className="h-3 w-3" />
                          {new Date(session.startsAtMs).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {session.status === 'completed' ? (
                        <>
                          {wasParticipantOrHost ? (
                            <Link
                              to={`/sessions/${session.id}/report?autogen=1`}
                              className="studio-cta inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>View AI Report &amp; Points</span>
                            </Link>
                          ) : null}
                          <Link
                            to={`/sessions/${session.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#080C16] px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-500"
                          >
                            <FileText className="h-3.5 w-3.5 text-sky-400" />
                            <span>Transcript</span>
                          </Link>
                        </>
                      ) : isCurrentlyInside ? (
                        <Link
                          to={`/sessions/${session.id}`}
                          className="studio-cta inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
                        >
                          <span>Enter Live Stage</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            joiningId === session.id ||
                            session.status === 'cancelled'
                          }
                          onClick={() => handleJoin(session)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:bg-slate-800 disabled:text-slate-500 ${
                            isFull
                              ? 'bg-amber-600 hover:bg-amber-500'
                              : 'studio-cta'
                          }`}
                        >
                          <span>
                            {joiningId === session.id
                              ? 'Joining...'
                              : isFull
                              ? 'Join Waitlist'
                              : 'Join Room'}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="studio-panel w-full max-w-lg rounded-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="font-display text-lg font-semibold text-white">
                Create 10-Seat Engineering Debate Room
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setShowCreate(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="scenarioSelect"
                  className="block text-xs font-medium text-slate-300"
                >
                  Pre-Decided System Scenario
                </label>
                <select
                  id="scenarioSelect"
                  value={selectedScenarioId}
                  onChange={(e) => {
                    const s = scenarios.find((item) => item.id === e.target.value);
                    setSelectedScenarioId(e.target.value);
                    if (s) {
                      setCustomTitle(s.title);
                      setRoomType(s.roomType);
                    }
                  }}
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#080C16] px-3 py-2.5 text-sm text-white"
                >
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.difficulty})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="sessionTitle"
                  className="block text-xs font-medium text-slate-300"
                >
                  Room Title
                </label>
                <input
                  id="sessionTitle"
                  type="text"
                  required
                  minLength={4}
                  maxLength={120}
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#080C16] px-3 py-2.5 text-sm text-white"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="roomTypeSelect"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Room Format
                  </label>
                  <select
                    id="roomTypeSelect"
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value as RoomType)}
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#080C16] px-3 py-2.5 text-sm text-white capitalize"
                  >
                    {ROOM_TYPES.map((rt) => (
                      <option key={rt} value={rt}>
                        {rt.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="capacitySelect"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Capacity (Up to 10 Seats)
                  </label>
                  <select
                    id="capacitySelect"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#080C16] px-3 py-2.5 text-sm text-white"
                  >
                    {[2, 4, 6, 8, 10].map((n) => (
                      <option key={n} value={n}>
                        {n} seats
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="modeSelect"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Participation Mode
                  </label>
                  <select
                    id="modeSelect"
                    value={participationMode}
                    onChange={(e) =>
                      setParticipationMode(e.target.value as 'async' | 'scheduled')
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#080C16] px-3 py-2.5 text-sm text-white"
                  >
                    <option value="async">Live / Async window</option>
                    <option value="scheduled">Scheduled live</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="visSelect"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Visibility
                  </label>
                  <select
                    id="visSelect"
                    value={visibility}
                    onChange={(e) =>
                      setVisibility(e.target.value as 'public' | 'private')
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#080C16] px-3 py-2.5 text-sm text-white"
                  >
                    <option value="public">Public (discoverable)</option>
                    <option value="private">Private (direct link)</option>
                  </select>
                </div>
              </div>

              {participationMode === 'scheduled' ? (
                <div>
                  <label
                    htmlFor="scheduledStart"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Scheduled Start Time (Optional)
                  </label>
                  <input
                    id="scheduledStart"
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#080C16] px-3 py-2.5 text-sm text-white"
                  />
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="studio-cta rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {creating ? 'Opening Room...' : 'Open 10-Seat Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
