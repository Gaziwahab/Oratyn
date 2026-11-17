import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  Bot,
  Box,
  Compass,
  FileText,
  LineChart,
  MessageSquare,
  Trophy,
  X,
} from 'lucide-react';
import { WorkspaceShell } from '../components/AppShell';
import { ThreeArchitectureStage } from '../components/ThreeArchitectureStage';
import { useAuth } from '../features/auth/AuthContext';
import { fetchPublishedCatalogue } from '../features/catalogue/catalogueService';
import {
  listCompetencyObservations,
  listUserEvaluations,
  listUserJoinedSessions,
  reconcileStaleUserRooms,
} from '../features/sessions/sessionService';
import {
  aggregateCompetencyProgress,
  recommendNextPractice,
  type CompetencyAggregate,
  type PracticeRecommendation,
} from '../../packages/domain/src/evaluation';
import type {
  SessionSummary,
  UserEvaluationRecord,
} from '../../packages/domain/src/types';
import { Link } from '../lib/router';
import heroDebateImg from '../assets/images/hero_engineering_debate_stage_1794544516148.jpg';

export function DashboardPage() {
  const {
    firebaseUser,
    profile,
    preferences,
    dismissScenarioRecommendation,
  } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [evaluations, setEvaluations] = useState<UserEvaluationRecord[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyAggregate[]>([]);
  const [recommendation, setRecommendation] =
    useState<PracticeRecommendation | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [show3DStage, setShow3DStage] = useState(true);
  const [bannerImgErr, setBannerImgErr] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const uid = firebaseUser!.uid;
        await reconcileStaleUserRooms({
          uid,
          displayName:
            profile?.displayName ?? firebaseUser!.displayName ?? 'Participant',
          activeSessionId: null,
          profile,
        });

        const [cat, joinedSessions, evals, obs] = await Promise.all([
          fetchPublishedCatalogue(),
          listUserJoinedSessions(uid),
          listUserEvaluations(uid),
          listCompetencyObservations(uid),
        ]);
        if (!active) return;

        const agg = aggregateCompetencyProgress(obs);
        const completedScenarioIds = new Set(
          joinedSessions
            .filter((s) => s.status === 'completed')
            .map((s) => s.scenarioId)
        );
        const dismissedSet = new Set(preferences?.dismissedScenarioIds ?? []);
        const rec = recommendNextPractice({
          scenarios: cat.scenarios,
          completedScenarioIds,
          dismissedScenarioIds: dismissedSet,
          competencyProgress: agg,
          userInterests: preferences?.interests ?? [],
        });

        setSessions(joinedSessions);
        setEvaluations(evals);
        setCompetencies(agg);
        setRecommendation(rec);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Unable to load dashboard data.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      active = false;
    };
  }, [firebaseUser, profile, preferences]);

  const handleDismissRecommendation = async () => {
    if (!recommendation) return;
    setDismissing(true);
    try {
      await dismissScenarioRecommendation(recommendation.scenario.id);
    } finally {
      setDismissing(false);
    }
  };

  return (
    <WorkspaceShell
      title={`Welcome back, ${profile?.displayName ?? 'Engineer'}`}
      breadcrumb="Command Studio · 3D System Stage & Monitored Upskill Roadmap"
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShow3DStage((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3.5 py-2 text-xs font-medium text-sky-300 hover:bg-sky-500/20 whitespace-nowrap"
          >
            <Box className="h-3.5 w-3.5" />
            <span>{show3DStage ? 'Hide 3D Stage' : 'Show 3D Stage'}</span>
          </button>
          <Link
            to="/leaderboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20 whitespace-nowrap"
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>Leaderboard</span>
          </Link>
          <Link
            to="/sessions"
            className="studio-cta inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white whitespace-nowrap"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Enter 10-Seat Rooms</span>
          </Link>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-4">
          <div className="h-64 animate-pulse rounded-2xl border border-slate-800 bg-[#0C121E]" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-56 animate-pulse rounded-2xl border border-slate-800 bg-[#0C121E]" />
            <div className="h-56 animate-pulse rounded-2xl border border-slate-800 bg-[#0C121E]" />
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Quantitative Studio Strip */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="studio-panel rounded-2xl p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-sky-400">
                Room Participation
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
                {sessions.length}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Joined &amp; hosted 10-seat debate rooms
              </p>
            </div>
            <div className="studio-panel rounded-2xl p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-emerald-400">
                AI Reports &amp; Reviews
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
                {evaluations.length}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Evidence-verified transcript evaluations
              </p>
            </div>
            <div className="studio-panel rounded-2xl p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-amber-300">
                Monitored Competencies
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
                {competencies.filter((c) => c.observationCount > 0).length} / 6
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Active dimensions on your upskill roadmap
              </p>
            </div>
            <div className="studio-panel rounded-2xl p-4 flex flex-col justify-between">
              <p className="font-mono text-[11px] uppercase tracking-wider text-violet-400">
                Next Mode
              </p>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-display text-sm font-semibold text-white">
                  Live Audio/Video Stage
                </span>
                <Link
                  to="/sessions"
                  className="font-mono text-xs text-sky-400 hover:text-sky-300"
                >
                  Launch →
                </Link>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Named voice transcription &amp; points
              </p>
            </div>
          </div>

          {/* Interactive 3D System Stage Open by Default */}
          {show3DStage ? (
            <section className="space-y-2">
              <ThreeArchitectureStage compact activePreset="overview" />
            </section>
          ) : null}

          {/* Primary Recommendation with High-Contrast Visual Backdrop & Dismiss control */}
          {recommendation ? (
            <section className="studio-panel relative overflow-hidden rounded-2xl">
              {!bannerImgErr ? (
                <img
                  src={heroDebateImg}
                  alt="Engineering debate room stage"
                  referrerPolicy="no-referrer"
                  onError={() => setBannerImgErr(true)}
                  className="absolute inset-0 h-full w-full object-cover opacity-35"
                />
              ) : null}
              <div className="relative z-10 bg-gradient-to-r from-[#06090F]/95 via-[#06090F]/85 to-[#06090F]/65 p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-3">
                      <p className="font-mono text-xs font-semibold uppercase tracking-wider text-sky-400">
                        Recommended Next Practice Topic
                      </p>
                      <button
                        type="button"
                        disabled={dismissing}
                        onClick={handleDismissRecommendation}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
                      >
                        <X className="h-3 w-3" />
                        <span>{dismissing ? 'Dismissing...' : 'Dismiss suggestion'}</span>
                      </button>
                    </div>
                    <h2 className="mt-1.5 font-display text-xl font-bold text-white">
                      {recommendation.scenario.title}
                    </h2>
                    <p className="mt-2 text-sm text-slate-300">
                      {recommendation.reason}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="text-sky-300 font-medium">
                        {recommendation.scenario.domainTitle}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">
                        {recommendation.scenario.difficulty}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {recommendation.scenario.estimatedMinutes}m
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <Link
                      to="/arena"
                      className="studio-panel-interactive inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-200 hover:text-white whitespace-nowrap"
                    >
                      <Bot className="h-3.5 w-3.5 text-sky-400" />
                      <span>Practice in AI Arena</span>
                    </Link>
                    <Link
                      to={`/scenarios/${recommendation.scenario.slug}`}
                      className="studio-cta inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white whitespace-nowrap"
                    >
                      <span>Review Scenario</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Joined & Hosted Sessions */}
            <section className="studio-panel rounded-2xl p-6">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-sky-400" />
                  <h2 className="font-display text-base font-semibold text-white">
                    Your Sessions ({sessions.length})
                  </h2>
                </div>
                <Link
                  to="/sessions"
                  className="text-xs font-medium text-sky-400 hover:text-sky-300"
                >
                  View all →
                </Link>
              </div>

              {sessions.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-400">
                    You have not joined a discussion session yet.
                  </p>
                  <Link
                    to="/sessions"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-sky-400 hover:text-sky-300"
                  >
                    <span>Browse or start a 10-seat room</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-slate-800/70">
                  {sessions.slice(0, 4).map((sess) => (
                    <li
                      key={sess.id}
                      className="py-3.5 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/sessions/${sess.id}`}
                          className="block truncate text-sm font-semibold text-slate-100 hover:text-sky-400"
                        >
                          {sess.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-400">
                          <span
                            className={`capitalize font-medium ${
                              sess.status === 'completed'
                                ? 'text-emerald-400'
                                : 'text-sky-400'
                            }`}
                          >
                            {sess.status}
                          </span>
                          <span className="mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span className="capitalize">
                            {sess.currentPhase.replace(/_/g, ' ')}
                          </span>
                          <span className="mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono tabular-nums">
                            {sess.participantCount}/{sess.capacity} seats
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {sess.status === 'completed' ? (
                          <Link
                            to={`/sessions/${sess.id}/report?autogen=1`}
                            className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/25 whitespace-nowrap"
                          >
                            View AI Report
                          </Link>
                        ) : (
                          <Link
                            to={`/sessions/${sess.id}`}
                            className="studio-cta rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white whitespace-nowrap"
                          >
                            Enter Room
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Recent Evaluations */}
            <section className="studio-panel rounded-2xl p-6">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-400" />
                  <h2 className="font-display text-base font-semibold text-white">
                    Recent Private Feedback
                  </h2>
                </div>
                <Link
                  to="/progress"
                  className="text-xs font-medium text-sky-400 hover:text-sky-300"
                >
                  Competencies →
                </Link>
              </div>

              {evaluations.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-400">
                    Complete a discussion session or an AI Practice Arena run to generate your first private, evidence-linked report.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-800/70">
                  {evaluations.slice(0, 4).map((ev) => (
                    <li
                      key={ev.id}
                      className="py-3.5 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {ev.scenarioTitle}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          <span className="capitalize text-emerald-400">
                            {ev.status}
                          </span>
                          <span className="mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span>Rubric v{ev.rubricVersion}</span>
                          {ev.report ? (
                            <>
                              <span className="mx-1.5" aria-hidden="true">
                                ·
                              </span>
                              <span className="capitalize">
                                {ev.report.confidence} confidence
                              </span>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <Link
                        to={`/sessions/${ev.sessionId}/report`}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-500/50 whitespace-nowrap shrink-0"
                      >
                        Read Report
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Competency Snapshot & Skill Passport CTA */}
          <section className="studio-panel rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4 text-emerald-400" />
                <h2 className="font-display text-base font-semibold text-white">
                  Observed Competencies
                </h2>
              </div>
              <Link
                to="/passport"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300"
              >
                <Award className="h-3.5 w-3.5" />
                <span>Open Developer Skill Passport →</span>
              </Link>
            </div>

            {competencies.length === 0 ? (
              <p className="py-6 text-sm text-slate-400">
                No competency observations recorded yet. Repeated sessions build confidence over time.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {competencies.slice(0, 6).map((comp) => (
                  <div
                    key={comp.competencyKey}
                    className="rounded-xl border border-slate-800/90 bg-[#080C16]/80 p-4"
                  >
                    <p className="text-sm font-semibold text-white capitalize">
                      {comp.competencyKey.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      <span className="capitalize text-sky-400">
                        {comp.status.replace(/_/g, ' ')}
                      </span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono tabular-nums">
                        {comp.observationCount} obs
                      </span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span className="capitalize">
                        {comp.confidence} confidence
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </WorkspaceShell>
  );
}
