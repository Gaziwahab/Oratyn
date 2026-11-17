import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  BarChart3,
  Database,
  FilePlus2,
  RefreshCw,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import { WorkspaceShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import { seedPilotCatalogueToFirestore } from '../features/catalogue/catalogueService';
import {
  createCustomScenario,
  listAuditEvents,
  listDiscoverableSessions,
  listModerationReports,
  resolveModerationReport,
  transitionSessionLifecycle,
} from '../features/sessions/sessionService';
import {
  DIFFICULTIES,
  MODERATION_ACTIONS,
  ROOM_TYPES,
  type AuditEventRecord,
  type Difficulty,
  type ModerationAction,
  type RoomType,
  type SessionSummary,
  type UserReportCase,
} from '../../packages/domain/src/types';
import { PILOT_DOMAINS } from '../../packages/domain/src/catalogue';
import { computeOperationalAnalytics } from '../../packages/domain/src/discussion';
import { Link } from '../lib/router';

interface RuntimeFlagsState {
  aiEvaluationEnabled: boolean;
  aiArenaEnabled: boolean;
  mediaStageEnabled: boolean;
}

export type AdminSectionTab = 'overview' | 'content' | 'sessions' | 'moderation';

export function AdminPage({
  initialSection = 'overview',
}: {
  initialSection?: AdminSectionTab;
}) {
  const { firebaseUser, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminSectionTab>(initialSection);
  const [reports, setReports] = useState<UserReportCase[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);
  const [flags, setFlags] = useState<RuntimeFlagsState>({
    aiEvaluationEnabled: true,
    aiArenaEnabled: true,
    mediaStageEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  // Author new scenario state
  const [showAuthorForm, setShowAuthorForm] = useState(false);
  const [scenTitle, setScenTitle] = useState('');
  const [scenSlug, setScenSlug] = useState('');
  const [scenDomainId, setScenDomainId] = useState(PILOT_DOMAINS[0].id);
  const [scenRoomType, setScenRoomType] = useState<RoomType>('system_design');
  const [scenDifficulty, setScenDifficulty] = useState<Difficulty>('intermediate');
  const [scenContext, setScenContext] = useState('');
  const [scenPrompt, setScenPrompt] = useState('');
  const [scenStatus, setScenStatus] = useState<'draft' | 'published'>('published');
  const [authoringBusy, setAuthoringBusy] = useState(false);
  const [sessionBusyId, setSessionBusyId] = useState<string | null>(null);

  const [selectedAction, setSelectedAction] = useState<
    Record<string, ModerationAction>
  >({});
  const [selectedStatus, setSelectedStatus] = useState<
    Record<string, 'under_review' | 'resolved' | 'dismissed'>
  >({});
  const [notesByReport, setNotesByReport] = useState<Record<string, string>>({});
  const [savingReportId, setSavingReportId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialSection);
  }, [initialSection]);

  const loadAdminConsole = async () => {
    setLoading(true);
    setError(null);
    try {
      const [repList, sessList, audList, healthRes] = await Promise.all([
        listModerationReports(),
        listDiscoverableSessions().catch(() => [] as SessionSummary[]),
        listAuditEvents().catch(() => [] as AuditEventRecord[]),
        fetch('/api/v1/health')
          .then((r) => r.json())
          .catch(() => null),
      ]);
      setReports(repList);
      setSessions(sessList);
      setAuditEvents(audList);
      if (healthRes?.data?.flags) {
        setFlags(healthRes.data.flags as RuntimeFlagsState);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load admin console.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void loadAdminConsole();
  }, [isAdmin]);

  const analytics = useMemo(
    () => computeOperationalAnalytics(sessions, reports),
    [sessions, reports]
  );

  const handleSeedCatalogue = async () => {
    setSeeding(true);
    setSeedMessage(null);
    setError(null);
    try {
      const written = await seedPilotCatalogueToFirestore();
      setSeedMessage(
        `Synced ${written} published pilot domains and scenarios to Firestore.`
      );
      await loadAdminConsole();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to seed pilot catalogue.'
      );
    } finally {
      setSeeding(false);
    }
  };

  const handleToggleFlag = async (key: keyof RuntimeFlagsState) => {
    if (!firebaseUser) return;
    const nextValue = !flags[key];
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/v1/admin/flags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [key]: nextValue }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.flags) {
          setFlags(json.data.flags as RuntimeFlagsState);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update feature switch.'
      );
    }
  };

  const handleCreateScenario = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const domain =
      PILOT_DOMAINS.find((d) => d.id === scenDomainId) ?? PILOT_DOMAINS[0];
    const cleanSlug =
      scenSlug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-') ||
      scenTitle
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-');

    setAuthoringBusy(true);
    setError(null);
    try {
      await createCustomScenario({
        actorUid: firebaseUser.uid,
        scenario: {
          slug: cleanSlug,
          domainId: domain.id,
          domainTitle: domain.title,
          topicTitle: domain.title,
          title: scenTitle.trim(),
          roomType: scenRoomType,
          difficulty: scenDifficulty,
          estimatedMinutes: 25,
          participationMode: 'scheduled',
          context: scenContext.trim(),
          prompt: scenPrompt.trim(),
          constraints: [
            'Defend trade-offs with concrete operational metrics.',
            'Address failure modes and graceful degradation.',
          ],
          learningObjectives: [
            'Formulate clear engineering hypotheses.',
            'Respond constructively to peer counterarguments.',
          ],
          prerequisites: ['Core software engineering fundamentals'],
          competencies: ['systematic_debugging', 'scalability_architecture'],
          strongSignals: ['Clear assumption framing', 'Explicit trade-off analysis'],
          status: scenStatus,
        },
      });
      setSeedMessage(`Authored scenario "${scenTitle.trim()}" (${scenStatus}).`);
      setShowAuthorForm(false);
      setScenTitle('');
      setScenSlug('');
      setScenContext('');
      setScenPrompt('');
      await loadAdminConsole();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to author scenario.'
      );
    } finally {
      setAuthoringBusy(false);
    }
  };

  const handleAdminSessionLifecycle = async (
    sessionId: string,
    targetStatus: SessionSummary['status']
  ) => {
    if (!firebaseUser) return;
    setSessionBusyId(sessionId);
    setError(null);
    try {
      await transitionSessionLifecycle({
        sessionId,
        actorUid: firebaseUser.uid,
        targetStatus,
      });
      await loadAdminConsole();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update session state.'
      );
    } finally {
      setSessionBusyId(null);
    }
  };

  const handleResolve = async (reportId: string) => {
    if (!firebaseUser) return;
    setSavingReportId(reportId);
    setError(null);
    try {
      await resolveModerationReport({
        actorUid: firebaseUser.uid,
        reportId,
        status: selectedStatus[reportId] ?? 'resolved',
        resolutionAction: selectedAction[reportId] ?? 'no_action',
        resolutionNotes:
          notesByReport[reportId]?.trim() || 'Reviewed by moderator.',
      });
      await loadAdminConsole();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update report resolution.'
      );
    } finally {
      setSavingReportId(null);
    }
  };

  return (
    <WorkspaceShell
      title="Administration, Governance & Moderation"
      breadcrumb="Admin Console"
    >
      {!isAdmin ? (
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-10 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-amber-400" />
          <h2 className="mt-3 font-display text-lg font-semibold text-white">
            Administrator access required
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            This workspace section is restricted to verified platform moderators and administrators.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
            >
              {error}
            </div>
          ) : null}

          {seedMessage ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {seedMessage}
            </div>
          ) : null}

          {/* Admin Sub-Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#111827] p-3">
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  { id: 'overview', label: 'All & Analytics', to: '/admin' },
                  { id: 'content', label: 'Content & Catalogue', to: '/admin/content' },
                  { id: 'sessions', label: `Sessions (${sessions.length})`, to: '/admin/sessions' },
                  {
                    id: 'moderation',
                    label: `Moderation (${analytics.openModerationReportsCount})`,
                    to: '/admin/moderation',
                  },
                ] as const
              ).map((tab) => (
                <Link
                  key={tab.id}
                  to={tab.to}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={loadAdminConsole}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 px-2"
            >
              Refresh Console
            </button>
          </div>

          {/* Operational Analytics Summary (ANALYTICS_SUCCESS_METRICS.md Section 6) */}
          {activeTab === 'overview' ? (
            <section className="rounded-xl border border-slate-800 bg-[#111827] p-6">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                <BarChart3 className="h-4 w-4 text-blue-400" />
                <h2 className="font-display text-base font-semibold text-white">
                  Operator Cohort &amp; Session Health Metrics
                </h2>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4">
                  <p className="text-xs text-slate-400">Active Cohort Learners</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
                    {analytics.uniqueParticipantsCount}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4">
                  <p className="text-xs text-slate-400">Open / Scheduled Rooms</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-amber-300 tabular-nums">
                    {analytics.openOrScheduledCount}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4">
                  <p className="text-xs text-slate-400">Active / Completed</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-blue-400 tabular-nums">
                    {analytics.activeOrPausedCount} / {analytics.completedCount}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4">
                  <p className="text-xs text-slate-400">Session Completion Rate</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                    {analytics.completionRatePct}%
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4">
                  <p className="text-xs text-slate-400">Open Safety Cases</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
                    {analytics.openModerationReportsCount}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {/* Pilot Catalogue & Scenario Authoring Operations */}
          {activeTab === 'overview' || activeTab === 'content' ? (
            <section className="rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-blue-400">
                    <Database className="h-4 w-4" />
                    <h2 className="font-display text-base font-semibold text-white">
                      Curated Catalogue &amp; Scenario Authoring
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Sync the 6 starter scenarios or author new scenarios in draft or published state.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAuthorForm((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0B0F17] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-blue-500"
                  >
                    <FilePlus2 className="h-3.5 w-3.5 text-blue-400" />
                    <span>
                      {showAuthorForm ? 'Close Author Form' : 'Author Scenario'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={seeding}
                    onClick={handleSeedCatalogue}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60 whitespace-nowrap"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>{seeding ? 'Syncing...' : 'Sync Pilot Catalogue'}</span>
                  </button>
                </div>
              </div>

              {showAuthorForm ? (
                <form
                  onSubmit={handleCreateScenario}
                  className="border-t border-slate-800 pt-4 space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label
                        htmlFor="scenTitle"
                        className="block text-xs font-medium text-slate-300"
                      >
                        Scenario Title
                      </label>
                      <input
                        id="scenTitle"
                        type="text"
                        required
                        minLength={5}
                        value={scenTitle}
                        onChange={(e) => setScenTitle(e.target.value)}
                        placeholder="Design a multi-region rate limiter"
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="scenDomain"
                        className="block text-xs font-medium text-slate-300"
                      >
                        Domain
                      </label>
                      <select
                        id="scenDomain"
                        value={scenDomainId}
                        onChange={(e) => setScenDomainId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-xs text-white"
                      >
                        {PILOT_DOMAINS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          htmlFor="scenType"
                          className="block text-xs font-medium text-slate-300"
                        >
                          Room Type
                        </label>
                        <select
                          id="scenType"
                          value={scenRoomType}
                          onChange={(e) =>
                            setScenRoomType(e.target.value as RoomType)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-2 py-2 text-xs text-white capitalize"
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
                          htmlFor="scenDiff"
                          className="block text-xs font-medium text-slate-300"
                        >
                          Difficulty
                        </label>
                        <select
                          id="scenDiff"
                          value={scenDifficulty}
                          onChange={(e) =>
                            setScenDifficulty(e.target.value as Difficulty)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-2 py-2 text-xs text-white capitalize"
                        >
                          {DIFFICULTIES.map((df) => (
                            <option key={df} value={df}>
                              {df}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="scenContext"
                        className="block text-xs font-medium text-slate-300"
                      >
                        Engineering Context
                      </label>
                      <textarea
                        id="scenContext"
                        required
                        rows={2}
                        value={scenContext}
                        onChange={(e) => setScenContext(e.target.value)}
                        placeholder="Describe the system state, symptoms, and scale..."
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F17] p-2.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="scenPrompt"
                        className="block text-xs font-medium text-slate-300"
                      >
                        Discussion Prompt
                      </label>
                      <textarea
                        id="scenPrompt"
                        required
                        rows={2}
                        value={scenPrompt}
                        onChange={(e) => setScenPrompt(e.target.value)}
                        placeholder="What decisions or trade-offs must participants defend?"
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0B0F17] p-2.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-400">Publication status:</span>
                      <button
                        type="button"
                        onClick={() => setScenStatus('published')}
                        className={`rounded px-2.5 py-1 font-medium ${
                          scenStatus === 'published'
                            ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                            : 'text-slate-400'
                        }`}
                      >
                        Published
                      </button>
                      <button
                        type="button"
                        onClick={() => setScenStatus('draft')}
                        className={`rounded px-2.5 py-1 font-medium ${
                          scenStatus === 'draft'
                            ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40'
                            : 'text-slate-400'
                        }`}
                      >
                        Draft
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={authoringBusy}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {authoringBusy ? 'Saving...' : 'Save Scenario'}
                    </button>
                  </div>
                </form>
              ) : null}
            </section>
          ) : null}

          {/* Runtime Feature Kill-Switches */}
          {activeTab === 'overview' ? (
            <section className="rounded-xl border border-slate-800 bg-[#111827] p-6">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                <Sliders className="h-4 w-4 text-blue-400" />
                <h2 className="font-display text-base font-semibold text-white">
                  Platform Runtime Feature Switches
                </h2>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {(
                  [
                    {
                      key: 'aiEvaluationEnabled',
                      label: 'AI Rubric Evaluation',
                      desc: 'Controls /api/v1/evaluations/generate post-session reports.',
                    },
                    {
                      key: 'aiArenaEnabled',
                      label: 'AI Practice Arena',
                      desc: 'Controls /api/v1/arena/respond interactive AI personas.',
                    },
                    {
                      key: 'mediaStageEnabled',
                      label: 'Audio/Video Room Stage',
                      desc: 'Controls /api/v1/media/token real-time room stage tokens.',
                    },
                  ] as const
                ).map((item) => {
                  const active = flags[item.key];
                  return (
                    <div
                      key={item.key}
                      className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-white">
                            {item.label}
                          </span>
                          <span
                            className={`font-mono text-xs ${
                              active ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {active ? 'ENABLED' : 'PAUSED'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{item.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleFlag(item.key)}
                        className="rounded-lg border border-slate-700 bg-[#111827] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-blue-500"
                      >
                        {active ? 'Pause Capability' : 'Enable Capability'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Session Operations & Management (/admin/sessions) */}
          {activeTab === 'overview' || activeTab === 'sessions' ? (
            <section className="rounded-xl border border-slate-800 bg-[#111827] p-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h2 className="font-display text-base font-semibold text-white">
                  Session Operations ({sessions.length})
                </h2>
                <Link
                  to="/sessions"
                  className="text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  Open Room Directory →
                </Link>
              </div>
              {sessions.length === 0 ? (
                <p className="py-6 text-xs text-slate-400">
                  No peer discussion rooms created yet.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-slate-800/80">
                  {sessions.slice(0, 12).map((s) => (
                    <div
                      key={s.id}
                      className="py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-white">{s.title}</p>
                        <p className="mt-0.5 text-slate-400 font-mono tabular-nums">
                          {s.status} · {s.participantCount}/{s.capacity} seats ·
                          Host: {s.hostDisplayName}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Link
                          to={`/sessions/${s.id}`}
                          className="rounded border border-slate-700 px-2.5 py-1 text-slate-200 hover:border-blue-500"
                        >
                          Inspect Room
                        </Link>
                        {s.status !== 'completed' && s.status !== 'cancelled' ? (
                          <>
                            <button
                              type="button"
                              disabled={sessionBusyId === s.id}
                              onClick={() =>
                                handleAdminSessionLifecycle(s.id, 'completed')
                              }
                              className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-emerald-300 hover:bg-emerald-500/20"
                            >
                              Mark Completed
                            </button>
                            <button
                              type="button"
                              disabled={sessionBusyId === s.id}
                              onClick={() =>
                                handleAdminSessionLifecycle(s.id, 'cancelled')
                              }
                              className="rounded border border-red-500/40 bg-red-950/30 px-2.5 py-1 text-red-200 hover:bg-red-950/50"
                            >
                              Cancel
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {/* Moderation Queue */}
          {activeTab === 'overview' || activeTab === 'moderation' ? (
            <section className="rounded-xl border border-slate-800 bg-[#111827] p-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h2 className="font-display text-base font-semibold text-white">
                  Moderation Reports Queue
                </h2>
                <button
                  type="button"
                  onClick={loadAdminConsole}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  Refresh Queue
                </button>
              </div>

              {loading ? (
                <div className="py-8 text-sm text-slate-400">
                  Loading moderation cases...
                </div>
              ) : reports.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  No user reports in the queue.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {reports.map((rep) => (
                    <article
                      key={rep.id}
                      className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                        <span>
                          <strong className="capitalize text-amber-300">
                            {rep.category.replace(/_/g, ' ')}
                          </strong>
                          <span className="mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span className="capitalize text-slate-200">
                            Status: {rep.status.replace(/_/g, ' ')}
                          </span>
                        </span>
                        <span className="font-mono">
                          Session {rep.sessionId}
                          {rep.messageId ? ` · Msg ${rep.messageId}` : ''}
                        </span>
                      </div>

                      <p className="text-sm text-slate-200">{rep.details}</p>

                      <div className="grid gap-3 pt-2 sm:grid-cols-4">
                        <select
                          aria-label={`Status for report ${rep.id}`}
                          value={
                            selectedStatus[rep.id] ??
                            (rep.status === 'open' ? 'resolved' : rep.status)
                          }
                          onChange={(e) =>
                            setSelectedStatus((prev) => ({
                              ...prev,
                              [rep.id]: e.target.value as
                                | 'under_review'
                                | 'resolved'
                                | 'dismissed',
                            }))
                          }
                          className="rounded-lg border border-slate-700 bg-[#111827] px-3 py-1.5 text-xs text-white capitalize"
                        >
                          <option value="under_review">Under review</option>
                          <option value="resolved">Resolved</option>
                          <option value="dismissed">Dismissed</option>
                        </select>

                        <select
                          aria-label={`Action for report ${rep.id}`}
                          value={
                            selectedAction[rep.id] ??
                            rep.resolutionAction ??
                            'no_action'
                          }
                          onChange={(e) =>
                            setSelectedAction((prev) => ({
                              ...prev,
                              [rep.id]: e.target.value as ModerationAction,
                            }))
                          }
                          className="rounded-lg border border-slate-700 bg-[#111827] px-3 py-1.5 text-xs text-white capitalize"
                        >
                          {MODERATION_ACTIONS.map((act) => (
                            <option key={act} value={act}>
                              {act.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          placeholder="Resolution notes..."
                          value={
                            notesByReport[rep.id] ?? rep.resolutionNotes ?? ''
                          }
                          onChange={(e) =>
                            setNotesByReport((prev) => ({
                              ...prev,
                              [rep.id]: e.target.value,
                            }))
                          }
                          className="rounded-lg border border-slate-700 bg-[#111827] px-3 py-1.5 text-xs text-white"
                        />

                        <button
                          type="button"
                          disabled={savingReportId === rep.id}
                          onClick={() => handleResolve(rep.id)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                        >
                          {savingReportId === rep.id
                            ? 'Saving...'
                            : 'Apply Decision'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {/* Immutable Admin & Moderation Audit Log Trail */}
          <section className="rounded-xl border border-slate-800 bg-[#111827] p-6">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
              <Activity className="h-4 w-4 text-emerald-400" />
              <h2 className="font-display text-base font-semibold text-white">
                Platform Audit Trail ({auditEvents.length})
              </h2>
            </div>
            {auditEvents.length === 0 ? (
              <p className="py-6 text-xs text-slate-400">
                No administrative or moderation audit events recorded yet.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-800/80 text-xs">
                {auditEvents.slice(0, 15).map((evt) => (
                  <li
                    key={evt.id}
                    className="py-2.5 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-400">{evt.action}</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-300">
                        {evt.targetType}: {evt.targetId}
                      </span>
                    </div>
                    <div className="font-mono text-slate-400">
                      {evt.outcome} ·{' '}
                      {new Date(evt.createdAtMs).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </WorkspaceShell>
  );
}
