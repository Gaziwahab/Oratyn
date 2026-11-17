import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Lightbulb,
  Mic,
  MicOff,
  Play,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import { WorkspaceShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import {
  completeArenaSessionAndEvaluate,
  createArenaSession,
  listUserArenaSessions,
  saveArenaNotes,
  sendArenaTurn,
  subscribeArenaSession,
} from '../features/sessions/sessionService';
import { Link, useRouter } from '../lib/router';
import {
  AI_ARENA_MODES,
  type AiArenaMode,
  type AiPersonaRole,
  type ArenaMessage,
  type ArenaSessionSummary,
} from '../../packages/domain/src/types';
import {
  AI_ARENA_MODE_INFO,
  AI_PERSONA_INFO,
} from '../../packages/domain/src/discussion';
import { PILOT_SCENARIOS } from '../../packages/domain/src/catalogue';
import arenaAiStudioImg from '../assets/images/arena_ai_interviewer_studio_1794544516684.jpg';

const MULTI_PANEL_ROLES: AiPersonaRole[] = [
  'system_architect',
  'security_engineer',
  'performance_engineer',
  'pragmatic_engineer',
];

export function ArenaHubPage() {
  const { firebaseUser } = useAuth();
  const { navigate } = useRouter();

  const [selectedScenarioId, setSelectedScenarioId] = useState(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('scenario');
      if (param && PILOT_SCENARIOS.some((s) => s.id === param || s.slug === param)) {
        const match = PILOT_SCENARIOS.find((s) => s.id === param || s.slug === param);
        if (match) return match.id;
      }
    }
    return PILOT_SCENARIOS[0].id;
  });
  const [selectedMode, setSelectedMode] = useState<AiArenaMode>('challenger');
  const [panelRoles, setPanelRoles] = useState<AiPersonaRole[]>([
    'system_architect',
    'security_engineer',
    'performance_engineer',
  ]);
  const [recentSessions, setRecentSessions] = useState<ArenaSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    let active = true;
    listUserArenaSessions(firebaseUser.uid)
      .then((list) => {
        if (!active) return;
        setRecentSessions(list);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [firebaseUser]);

  const togglePanelRole = (role: AiPersonaRole) => {
    setPanelRoles((prev) => {
      if (prev.includes(role)) {
        return prev.length > 1 ? prev.filter((r) => r !== role) : prev;
      }
      return [...prev, role].slice(0, 4);
    });
  };

  const handleStartArena = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const scenario =
      PILOT_SCENARIOS.find((s) => s.id === selectedScenarioId) ?? PILOT_SCENARIOS[0];
    const modeInfo = AI_ARENA_MODE_INFO[selectedMode];
    const activePersonas =
      selectedMode === 'multi_perspective'
        ? panelRoles
        : [...modeInfo.defaultPersonas];

    setStarting(true);
    setErrorMsg(null);
    try {
      const arenaId = await createArenaSession({
        uid: firebaseUser.uid,
        scenario,
        mode: selectedMode,
        activePersonas,
      });
      navigate(`/arena/${arenaId}`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to start AI Practice Arena.'
      );
      setStarting(false);
    }
  };

  const currentScenario =
    PILOT_SCENARIOS.find((s) => s.id === selectedScenarioId) ?? PILOT_SCENARIOS[0];

  return (
    <WorkspaceShell
      title="AI Practice Arena"
      breadcrumb="On-demand engineering simulation · Explicit [AI] persona disclosure"
    >
      <div className="space-y-8">
        {errorMsg ? (
          <div
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200"
          >
            {errorMsg}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left 7 columns: Configure & Launch Arena */}
          <form
            onSubmit={handleStartArena}
            className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#111827] overflow-hidden"
          >
            <div className="relative border-b border-slate-800/80 p-6">
              <img
                src={arenaAiStudioImg}
                alt="AI Engineering Practice Arena Studio"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#111827] via-[#111827]/90 to-[#111827]/65" />
              <div className="relative">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-blue-400">
                  Configure Simulation · Multi-Role AI Scrutiny
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-white">
                  Select Practice Format &amp; Engineering Scenario
                </h2>
                <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                  Practice explaining decisions, defending trade-offs, or handling multi-role engineering scrutiny before joining live peer rooms. All AI participants carry explicit <span className="font-mono text-blue-300">[AI]</span> disclosure badges.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-6">

            <div>
              <label
                htmlFor="arena-scenario"
                className="block text-xs font-medium text-slate-300"
              >
                Engineering Scenario
              </label>
              <select
                id="arena-scenario"
                value={selectedScenarioId}
                onChange={(e) => setSelectedScenarioId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3.5 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                {PILOT_SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.difficulty} · {s.domainTitle})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                {currentScenario.context}
              </p>
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-300 mb-2">
                Arena Practice Format
              </span>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {AI_ARENA_MODES.map((mode) => {
                  const info = AI_ARENA_MODE_INFO[mode];
                  const active = selectedMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSelectedMode(mode)}
                      className={`rounded-lg border p-3.5 text-left transition-colors ${
                        active
                          ? 'border-blue-500 bg-blue-600/15 text-white'
                          : 'border-slate-800 bg-[#0B0F17]/70 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white">
                          {info.title}
                        </span>
                        <span className="font-mono text-[11px] text-blue-400">
                          [AI]
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                        {info.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedMode === 'multi_perspective' ? (
              <div className="rounded-lg border border-slate-800 bg-[#0B0F17]/80 p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Active AI Engineering Perspectives (Select 2–4)
                  </h3>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {MULTI_PANEL_ROLES.map((role) => {
                    const info = AI_PERSONA_INFO[role];
                    const checked = panelRoles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => togglePanelRole(role)}
                        className={`rounded-lg border p-2.5 text-left text-xs transition-colors ${
                          checked
                            ? 'border-blue-500/60 bg-blue-950/30 text-slate-100'
                            : 'border-slate-800 bg-[#111827] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <p className="font-semibold">
                          {info.displayName}{' '}
                          <span className="font-mono text-blue-400">
                            {info.badge}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {info.focus}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between border-t border-slate-800/80 pt-4">
              <p className="text-xs text-slate-400">
                Includes real-time coaching hints + private 6-dimension evaluation
              </p>
              <button
                type="submit"
                disabled={starting}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                <span>{starting ? 'Starting Arena...' : 'Launch Arena Session'}</span>
              </button>
            </div>
            </div>
          </form>

          {/* Right 5 columns: Recent Arena Sessions & Persona Directory */}
          <div className="lg:col-span-5 space-y-6">
            <section className="rounded-xl border border-slate-800 bg-[#111827] p-5">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-slate-300">
                Your Recent Arena Practice ({recentSessions.length})
              </h2>
              {loading ? (
                <div className="mt-4 space-y-2">
                  <div className="h-14 animate-pulse rounded-lg bg-slate-900/70" />
                  <div className="h-14 animate-pulse rounded-lg bg-slate-900/70" />
                </div>
              ) : recentSessions.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                  No AI Practice Arena sessions yet. Launch a 1-on-1 Challenger or Multi-Perspective Panel on the left to start practicing.
                </p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {recentSessions.slice(0, 6).map((sess) => {
                    const modeInfo = AI_ARENA_MODE_INFO[sess.mode];
                    return (
                      <Link
                        key={sess.id}
                        to={`/arena/${sess.id}`}
                        className="block rounded-lg border border-slate-800 bg-[#0B0F17]/70 p-3.5 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                          <span className="text-blue-400 font-medium">
                            {modeInfo?.title ?? sess.mode}
                          </span>
                          <span className="font-mono">
                            {sess.status} · {sess.turnCount} turns
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-white truncate">
                          {sess.scenarioTitle}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-800 bg-[#111827] p-5">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-400" />
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-slate-300">
                  AI Engineering Perspectives
                </h2>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Each AI persona challenges your solution from a realistic engineering angle:
              </p>
              <ul className="mt-3 space-y-2.5 text-xs">
                {MULTI_PANEL_ROLES.map((role) => {
                  const info = AI_PERSONA_INFO[role];
                  return (
                    <li
                      key={role}
                      className="rounded-lg border border-slate-800/80 bg-[#0B0F17]/60 p-3"
                    >
                      <p className="font-medium text-slate-200">
                        {info.displayName}{' '}
                        <span className="font-mono text-blue-400">
                          {info.badge}
                        </span>
                      </p>
                      <p className="mt-0.5 text-slate-400">{info.focus}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}

export function ArenaRoomPage({ arenaId }: { arenaId: string }) {
  const { firebaseUser, profile } = useAuth();
  const { navigate } = useRouter();

  const [arena, setArena] = useState<ArenaSessionSummary | null>(null);
  const [messages, setMessages] = useState<ArenaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftMessage, setDraftMessage] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.sessionStorage.getItem(`ep_draft_arena_${arenaId}`) ?? '';
    }
    return '';
  });
  const [sending, setSending] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [showHints, setShowHints] = useState(true);
  const [dictating, setDictating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleVoiceDictation = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      setErrorMsg('Browser speech recognition is not supported on this device. Please type your engineering explanation below.');
      return;
    }
    if (dictating) {
      setDictating(false);
      return;
    }
    try {
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      setDictating(true);
      rec.onresult = (event) => {
        const lastIdx = event.results.length - 1;
        const transcript = event.results[lastIdx]?.[0]?.transcript?.trim();
        if (transcript) {
          setDraftMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      rec.onerror = () => setDictating(false);
      rec.onend = () => setDictating(false);
      rec.start();
    } catch {
      setDictating(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (draftMessage) {
        window.sessionStorage.setItem(`ep_draft_arena_${arenaId}`, draftMessage);
      } else {
        window.sessionStorage.removeItem(`ep_draft_arena_${arenaId}`);
      }
    }
  }, [arenaId, draftMessage]);

  useEffect(() => {
    if (!firebaseUser) return;
    setLoading(true);
    const unsub = subscribeArenaSession({
      uid: firebaseUser.uid,
      arenaId,
      onArena: (s) => {
        setArena(s);
        if (s && !notesDirty) {
          setNotesDraft(s.coachingNotes);
        }
        setLoading(false);
      },
      onMessages: (m) => setMessages(m),
      onError: (err) => {
        setErrorMsg(err.message);
        setLoading(false);
      },
    });
    return () => unsub();
  }, [firebaseUser, arenaId, notesDirty]);

  const scenario =
    PILOT_SCENARIOS.find((s) => s.id === arena?.scenarioId) ?? PILOT_SCENARIOS[0];

  const handleSendTurn = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile || !arena || !draftMessage.trim()) return;
    setSending(true);
    setErrorMsg(null);
    const text = draftMessage;
    setDraftMessage('');
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(`ep_draft_arena_${arenaId}`);
    }
    try {
      await sendArenaTurn({
        uid: firebaseUser.uid,
        profile,
        arena,
        scenario,
        history: messages,
        learnerMessage: text,
      });
    } catch (err) {
      setDraftMessage(text);
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to send Arena turn.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleSaveScratchpad = async () => {
    if (!firebaseUser || !arena) return;
    setSavingNotes(true);
    try {
      await saveArenaNotes({
        uid: firebaseUser.uid,
        arenaId: arena.id,
        coachingNotes: notesDraft,
      });
      setNotesDirty(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleCompleteAndEvaluate = async () => {
    if (!firebaseUser || !profile || !arena) return;
    setEvaluating(true);
    setErrorMsg(null);
    try {
      await completeArenaSessionAndEvaluate({
        uid: firebaseUser.uid,
        profile,
        arena,
        scenario,
        messages,
      });
      navigate(`/sessions/${arena.id}/report`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not generate evaluation report right now.'
      );
      setEvaluating(false);
    }
  };

  if (loading) {
    return (
      <WorkspaceShell title="Loading AI Arena..." breadcrumb="AI Practice Arena">
        <div className="h-96 animate-pulse rounded-xl border border-slate-800 bg-[#111827]" />
      </WorkspaceShell>
    );
  }

  if (!arena) {
    return (
      <WorkspaceShell title="Arena Session Not Found" breadcrumb="AI Practice Arena">
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-8 text-center">
          <p className="text-sm text-slate-300">
            This AI Practice Arena session could not be found.
          </p>
          <Link
            to="/arena"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to AI Practice Arena</span>
          </Link>
        </div>
      </WorkspaceShell>
    );
  }

  const modeInfo = AI_ARENA_MODE_INFO[arena.mode];

  return (
    <WorkspaceShell
      title={arena.scenarioTitle}
      breadcrumb={`AI Practice Arena · ${modeInfo?.title ?? arena.mode} · ${arena.status.toUpperCase()}`}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHints((v) => !v)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            {showHints ? 'Hide Coaching Hints' : 'Show Coaching Hints'}
          </button>
          {arena.status === 'active' ? (
            <button
              type="button"
              disabled={evaluating || messages.length < 2}
              onClick={handleCompleteAndEvaluate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                {evaluating
                  ? 'Evaluating...'
                  : 'Complete & Generate Report'}
              </span>
            </button>
          ) : (
            <Link
              to={`/sessions/${arena.id}/report`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>View Evaluation Report</span>
            </Link>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {errorMsg ? (
          <div
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200"
          >
            {errorMsg}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left 3 Columns: Scenario Brief & Active AI Personas */}
          <aside className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 space-y-3">
              <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-blue-400">
                Scenario Prompt
              </h2>
              <p className="text-xs leading-relaxed text-slate-300">
                {scenario.context}
              </p>
              <div className="rounded-lg border border-slate-800/90 bg-[#0B0F17] p-3">
                <p className="text-xs font-medium text-slate-200">
                  {scenario.prompt}
                </p>
              </div>
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Constraints
                </h3>
                <ul className="mt-1.5 space-y-1 text-xs text-slate-300">
                  {scenario.constraints.map((c) => (
                    <li key={c} className="flex gap-1.5">
                      <span className="text-blue-400">·</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
              <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-slate-300">
                Active AI Panelists
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Simulated AI engineering roles in this room:
              </p>
              <ul className="mt-2.5 space-y-2">
                {arena.activePersonas.map((role) => {
                  const info = AI_PERSONA_INFO[role];
                  return (
                    <li
                      key={role}
                      className="rounded-lg border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-200">
                          {info?.displayName ?? role}
                        </span>
                        <span className="font-mono text-[11px] text-blue-400">
                          {info?.badge ?? 'AI'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {info?.focus}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* Center 6 Columns: AI Practice Arena Dialogue */}
          <section className="lg:col-span-6 flex flex-col rounded-xl border border-slate-800 bg-[#111827] min-h-[540px]">
            <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between text-xs text-slate-400">
              <span>
                Format: <strong className="text-slate-200">{modeInfo?.title}</strong>
              </span>
              <span className="font-mono">{messages.length} messages</span>
            </div>

            <div
              role="log"
              aria-live="polite"
              className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[460px]"
            >
              {messages.map((m) => {
                const isAi = m.senderType === 'ai';
                const personaMeta = m.personaRole
                  ? AI_PERSONA_INFO[m.personaRole]
                  : null;
                return (
                  <article
                    key={m.id}
                    className={`rounded-lg border p-3.5 text-sm ${
                      isAi
                        ? 'border-blue-500/30 bg-[#0B0F17]'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200">
                          {m.senderDisplayName}
                        </span>
                        <span
                          className={`font-mono text-[11px] ${
                            isAi ? 'text-blue-400 font-semibold' : 'text-emerald-400'
                          }`}
                        >
                          {isAi ? personaMeta?.badge ?? '[AI]' : 'Engineer'}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-slate-200 leading-relaxed">
                      {m.body}
                    </p>
                    {isAi && showHints && m.coachingHint ? (
                      <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
                        <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
                        <span>
                          <strong>What this probes:</strong> {m.coachingHint}
                        </span>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            {arena.status === 'active' ? (
              <form
                onSubmit={handleSendTurn}
                className="border-t border-slate-800 p-3.5 space-y-2.5"
              >
                <label htmlFor="arena-composer" className="sr-only">
                  Your engineering response
                </label>
                <textarea
                  id="arena-composer"
                  rows={3}
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  placeholder="State your hypothesis, propose a trade-off, or defend your architecture decision..."
                  className="w-full rounded-lg border border-slate-700 bg-[#0B0F17] p-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleVoiceDictation}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        dictating
                          ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {dictating ? (
                        <>
                          <Mic className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Listening...</span>
                        </>
                      ) : (
                        <>
                          <MicOff className="h-3.5 w-3.5 text-slate-400" />
                          <span>Dictate by Voice</span>
                        </>
                      )}
                    </button>
                    <span className="text-xs text-slate-400">
                      {sending
                        ? 'AI engineering panel is analyzing your reasoning...'
                        : 'State failure modes, metrics, and trade-offs.'}
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={sending || !draftMessage.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{sending ? 'Responding...' : 'Send Response'}</span>
                  </button>
                </div>
              </form>
            ) : null}
          </section>

          {/* Right 3 Columns: Arena Scratchpad */}
          <aside className="lg:col-span-3 rounded-xl border border-slate-800 bg-[#111827] p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-slate-300">
                Private Scratchpad
              </h2>
              {notesDirty ? (
                <button
                  type="button"
                  disabled={savingNotes}
                  onClick={handleSaveScratchpad}
                  className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-500"
                >
                  {savingNotes ? 'Saving...' : 'Save'}
                </button>
              ) : (
                <span className="text-[11px] text-slate-500">Saved</span>
              )}
            </div>
            <label htmlFor="arena-scratchpad" className="sr-only">
              Private Arena Scratchpad
            </label>
            <textarea
              id="arena-scratchpad"
              value={notesDraft}
              onChange={(e) => {
                setNotesDraft(e.target.value);
                setNotesDirty(true);
              }}
              className="flex-1 min-h-[360px] w-full rounded-lg border border-slate-800 bg-[#0B0F17] p-3 font-mono text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </aside>
        </div>
      </div>
    </WorkspaceShell>
  );
}
