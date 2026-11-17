import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Compass,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Scale,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { WorkspaceShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import { fetchPublishedCatalogue } from '../features/catalogue/catalogueService';
import {
  fetchRealLeaderboardStandings,
  listPublicSessions,
  listUserEvaluations,
  listUserJoinedSessions,
  reconcileStaleUserRooms,
  type RealLeaderboardStandingRow,
} from '../features/sessions/sessionService';
import { RUBRIC_DIMENSION_INFO } from '../../packages/domain/src/evaluation';
import {
  RUBRIC_DIMENSION_KEYS,
  type ScenarioItem,
  type SessionSummary,
  type UserEvaluationRecord,
} from '../../packages/domain/src/types';
import { Link } from '../lib/router';

export function LeaderboardPage() {
  const { firebaseUser, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<UserEvaluationRecord[]>([]);
  const [mySessions, setMySessions] = useState<SessionSummary[]>([]);
  const [publicSessions, setPublicSessions] = useState<SessionSummary[]>([]);
  const [realStandings, setRealStandings] = useState<RealLeaderboardStandingRow[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<
    'total' | 'approach' | 'question_back' | 'clarification'
  >('total');

  useEffect(() => {
    if (!firebaseUser) return;
    let active = true;

    async function loadData() {
      setLoading(true);
      try {
        const currentDisplayName =
          profile?.displayName ?? firebaseUser!.displayName ?? 'Learner';
        const currentRoleLabel = profile?.experienceBand
          ? profile.experienceBand.replace(/_/g, ' ')
          : 'Engineering Practitioner';

        await reconcileStaleUserRooms({
          uid: firebaseUser!.uid,
          displayName: currentDisplayName,
          activeSessionId: null,
          profile,
        });

        const [evals, joined, pub, standings, cat] = await Promise.all([
          listUserEvaluations(firebaseUser!.uid),
          listUserJoinedSessions(firebaseUser!.uid),
          listPublicSessions(),
          fetchRealLeaderboardStandings({
            currentUid: firebaseUser!.uid,
            currentDisplayName,
            currentRoleLabel,
          }),
          fetchPublishedCatalogue(),
        ]);
        if (!active) return;
        setEvaluations(evals);
        setMySessions(joined);
        setPublicSessions(pub);
        setRealStandings(standings);
        setScenarios(cat.scenarios);
      } catch {
        // non-fatal
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [firebaseUser, profile]);

  const myPointsSummary = useMemo(() => {
    const selfStanding = realStandings.find((r) => r.isCurrentUser);
    if (selfStanding) {
      return {
        bestApproachPoints: selfStanding.bestApproachPoints,
        questionBackPoints: selfStanding.questionBackPoints,
        clarificationPoints: selfStanding.clarificationPoints,
        defensePoints: selfStanding.defensePoints,
        totalPoints: selfStanding.totalPoints,
        badges: selfStanding.badges,
      };
    }
    return {
      bestApproachPoints: 0,
      questionBackPoints: 0,
      clarificationPoints: 0,
      defensePoints: 0,
      totalPoints: 0,
      badges: [] as string[],
    };
  }, [realStandings]);

  const leaderboardRows = useMemo(() => {
    return [...realStandings].sort((a, b) => {
      if (categoryFilter === 'approach') {
        return b.bestApproachPoints - a.bestApproachPoints;
      }
      if (categoryFilter === 'question_back') {
        return b.questionBackPoints - a.questionBackPoints;
      }
      if (categoryFilter === 'clarification') {
        return b.clarificationPoints - a.clarificationPoints;
      }
      return b.totalPoints - a.totalPoints;
    });
  }, [realStandings, categoryFilter]);

  const competencySnapshots = useMemo(() => {
    return RUBRIC_DIMENSION_KEYS.map((key) => {
      const ratings: number[] = [];
      for (const ev of evaluations) {
        const dim = ev.report?.dimensions.find((d) => d.key === key);
        if (dim && dim.status === 'scored' && dim.rating !== null) {
          ratings.push(dim.rating);
        }
      }
      const avg =
        ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : null;
      return {
        key,
        label: RUBRIC_DIMENSION_INFO[key]?.name ?? key.replace(/_/g, ' '),
        averageRating: avg,
        bandLabel:
          avg === null
            ? 'Needs session evidence'
            : avg >= 3
            ? 'Strong'
            : avg >= 2
            ? 'Developing'
            : 'Emerging',
      };
    });
  }, [evaluations]);

  const recommendedRoadmapScenarios = useMemo(() => {
    if (scenarios.length === 0) return [];
    const completedScenarioIds = new Set(mySessions.map((s) => s.scenarioId));
    const unvisited = scenarios.filter((s) => !completedScenarioIds.has(s.id));
    return (unvisited.length > 0 ? unvisited : scenarios).slice(0, 3);
  }, [scenarios, mySessions]);

  return (
    <WorkspaceShell
      title="Debate Points & Upskill Roadmap"
      breadcrumb="AI Review Points · Questioning Back · Clarification · Best Approach"
      action={
        <Link
          to="/sessions"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 whitespace-nowrap"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Join a 10-Seat Debate Room</span>
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-4">
          <div className="h-36 animate-pulse rounded-xl border border-slate-800 bg-[#111827]" />
          <div className="h-72 animate-pulse rounded-xl border border-slate-800 bg-[#111827]" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Your Personal Debate & GD Scorecards */}
          <section className="rounded-xl border border-amber-500/40 bg-[#111827] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    Your Engineering Debate &amp; GD Standing
                  </p>
                  <h2 className="font-display text-xl font-semibold text-white">
                    {profile?.displayName ?? 'Learner'} — {myPointsSummary.totalPoints}{' '}
                    Total Points
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {myPointsSummary.badges.length > 0 ? (
                  myPointsSummary.badges.map((badge) => (
                    <span
                      key={badge}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200"
                    >
                      <Award className="h-3.5 w-3.5" />
                      <span>{badge}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">
                    Join a room, speak on stage, and complete a debate to unlock recognition badges
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-[#0B0F17] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
                  <Lightbulb className="h-4 w-4" />
                  <span>Best Technical Approach</span>
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-white">
                  {myPointsSummary.bestApproachPoints}{' '}
                  <span className="text-xs font-normal text-slate-400">pts</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Earned by proposing concrete system design, rate limiting, and load balancing architectures.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#0B0F17] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <HelpCircle className="h-4 w-4" />
                  <span>Questioning Back</span>
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-white">
                  {myPointsSummary.questionBackPoints}{' '}
                  <span className="text-xs font-normal text-slate-400">pts</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Earned by listening to peers and asking sharp cross-questions on failure modes and bottlenecks.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#0B0F17] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-violet-400">
                  <Search className="h-4 w-4" />
                  <span>Best Clarification</span>
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-white">
                  {myPointsSummary.clarificationPoints}{' '}
                  <span className="text-xs font-normal text-slate-400">pts</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Earned by clarifying ambiguous constraints, SLAs, and explaining how code works clearly.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#0B0F17] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <Scale className="h-4 w-4" />
                  <span>Trade-Off Defense</span>
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-white">
                  {myPointsSummary.defensePoints}{' '}
                  <span className="text-xs font-normal text-slate-400">pts</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Earned by defending why you chose a technology over alternatives under peer questioning.
                </p>
              </div>
            </div>
          </section>

          {/* Leaderboard Table + Personalized Upskill Roadmap */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Leaderboard Table (7 cols) */}
            <section className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    Engineering Debate &amp; GD Leaderboard
                  </h2>
                  <p className="text-xs text-slate-400">
                    Ranked by AI-reviewed points from transcribed room discussions ({publicSessions.length} active/recent rooms).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-[#0B0F17] p-1">
                  {(
                    [
                      { id: 'total', label: 'Total Pts' },
                      { id: 'approach', label: 'Best Approach' },
                      { id: 'question_back', label: 'Question Back' },
                      { id: 'clarification', label: 'Clarification' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCategoryFilter(tab.id)}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                        categoryFilter === tab.id
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {leaderboardRows.map((row, index) => (
                  <div
                    key={row.uid}
                    className={`rounded-xl border p-4 transition-colors ${
                      row.isCurrentUser
                        ? 'border-blue-500/50 bg-blue-950/20'
                        : 'border-slate-800 bg-[#0B0F17]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                            index === 0
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : index === 1
                              ? 'bg-slate-700/50 text-slate-200'
                              : index === 2
                              ? 'bg-amber-900/30 text-amber-400'
                              : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          #{index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {row.displayName}{' '}
                            {row.isCurrentUser ? (
                              <span className="ml-1 rounded bg-blue-600/30 px-1.5 py-0.5 font-mono text-[10px] text-blue-300">
                                YOU
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-slate-400 capitalize">
                            {row.roleLabel} · {row.sessionsCompleted} sessions
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-mono text-lg font-bold text-amber-300">
                          {row.totalPoints} pts
                        </p>
                        <p className="font-mono text-[11px] text-slate-400">
                          💡 {row.bestApproachPoints} · ❓ {row.questionBackPoints} · 🔍{' '}
                          {row.clarificationPoints} · ⚖️ {row.defensePoints}
                        </p>
                      </div>
                    </div>

                    {row.badges.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-800/80 pt-2.5">
                        {row.badges.map((b) => (
                          <span
                            key={b}
                            className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200"
                          >
                            <Award className="h-3 w-3 text-amber-400" />
                            <span>{b}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            {/* Personalized Upskill Roadmap (5 cols) */}
            <aside className="lg:col-span-5 space-y-4">
              <div className="rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  <h2 className="font-display text-base font-semibold text-white">
                    Your Personalized Upskill Roadmap
                  </h2>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">
                  System-monitored per-user activity roadmap: based on your debate transcripts and questioning-back scores, practise these pre-decided engineering topics next.
                </p>

                <div className="space-y-3">
                  {recommendedRoadmapScenarios.map((sc, idx) => (
                    <div
                      key={sc.id}
                      className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-blue-400 font-semibold">
                          Step #{idx + 1} · {sc.roomType.replace(/_/g, ' ')}
                        </span>
                        <span className="capitalize text-slate-400">
                          {sc.difficulty}
                        </span>
                      </div>
                      <h3 className="font-display text-sm font-semibold text-white">
                        {sc.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {sc.context}
                      </p>
                      <div className="pt-1 flex items-center justify-between">
                        <Link
                          to={`/scenarios/${sc.slug}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300"
                        >
                          <span>Start Debate / GD on Topic</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-800 pt-4 space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Monitored Competency Dimensions
                  </p>
                  {competencySnapshots.map((snap) => (
                    <div
                      key={snap.key}
                      className="flex items-center justify-between rounded border border-slate-800 bg-[#0B0F17] px-3 py-2 text-xs"
                    >
                      <span className="text-slate-200">{snap.label}</span>
                      <span className="font-mono text-blue-400">
                        {snap.averageRating !== null
                          ? `${snap.averageRating.toFixed(1)}/4.0 (${snap.bandLabel})`
                          : snap.bandLabel}
                      </span>
                    </div>
                  ))}
                </div>

                <Link
                  to="/progress"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#0B0F17] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:border-blue-500"
                >
                  <Compass className="h-4 w-4 text-blue-400" />
                  <span>Open Full Competency Growth &amp; Roadmap</span>
                </Link>
              </div>
            </aside>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
