import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Compass,
  FileText,
  LineChart,
  ShieldCheck,
  X,
} from 'lucide-react';
import { WorkspaceShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import { fetchPublishedCatalogue } from '../features/catalogue/catalogueService';
import {
  listCompetencyObservations,
  listUserEvaluations,
  listUserJoinedSessions,
} from '../features/sessions/sessionService';
import {
  aggregateCompetencyProgress,
  recommendPracticeQueue,
  type CompetencyAggregate,
  type PracticeRecommendationQueue,
} from '../../packages/domain/src/evaluation';
import { PILOT_COMPETENCIES } from '../../packages/domain/src/catalogue';
import type {
  CompetencyObservation,
  SessionSummary,
  UserEvaluationRecord,
} from '../../packages/domain/src/types';
import { Link } from '../lib/router';

export function ProgressPage() {
  const { firebaseUser, preferences, dismissScenarioRecommendation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [observations, setObservations] = useState<CompetencyObservation[]>([]);
  const [competencies, setCompetencies] = useState<CompetencyAggregate[]>([]);
  const [evaluations, setEvaluations] = useState<UserEvaluationRecord[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [practiceQueue, setPracticeQueue] =
    useState<PracticeRecommendationQueue>({ primary: null, alternatives: [] });
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    let active = true;

    async function loadProgress() {
      setLoading(true);
      setError(null);
      try {
        const uid = firebaseUser!.uid;
        const [obs, evals, joined, cat] = await Promise.all([
          listCompetencyObservations(uid),
          listUserEvaluations(uid),
          listUserJoinedSessions(uid),
          fetchPublishedCatalogue(),
        ]);
        if (!active) return;

        const agg = aggregateCompetencyProgress(obs);
        const completedScenarioIds = new Set(
          joined.filter((s) => s.status === 'completed').map((s) => s.scenarioId)
        );
        const queue = recommendPracticeQueue({
          scenarios: cat.scenarios,
          completedScenarioIds,
          dismissedScenarioIds: new Set(preferences?.dismissedScenarioIds ?? []),
          competencyProgress: agg,
          userInterests: preferences?.interests ?? [],
        });

        setObservations(obs);
        setCompetencies(agg);
        setEvaluations(evals);
        setSessions(joined);
        setPracticeQueue(queue);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load competency progress.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProgress();
    return () => {
      active = false;
    };
  }, [firebaseUser, preferences]);

  const handleDismissRecommendation = async (scenarioId: string) => {
    setDismissingId(scenarioId);
    try {
      await dismissScenarioRecommendation(scenarioId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to dismiss recommendation.'
      );
    } finally {
      setDismissingId(null);
    }
  };

  const competencyMetaMap = new Map(
    PILOT_COMPETENCIES.flatMap((c) => [
      [c.id, c] as const,
      [c.slug, c] as const,
    ])
  );

  const evalBySessionId = new Map(
    evaluations.map((ev) => [ev.sessionId, ev] as const)
  );

  return (
    <WorkspaceShell
      title="Competency & Growth Roadmap"
      breadcrumb="Progress"
      action={
        <Link
          to="/explore"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 whitespace-nowrap"
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Browse Scenarios</span>
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-xl border border-slate-800 bg-[#111827]" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-xl border border-slate-800 bg-[#111827]"
              />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-200">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cautious Assessment Framing */}
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-5 flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div className="text-sm">
              <p className="font-medium text-white">
                Evidence-over-time competency tracking
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Single sessions can surface emerging habits, but only repeated, verified observations across multiple scenarios build high-confidence consistency. There are no public leaderboards.
              </p>
            </div>
          </div>

          {practiceQueue.primary ? (
            <section className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-[#111827] p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-blue-400">
                      Primary Suggested Next Practice
                    </span>
                    <span className="text-xs text-slate-500">·</span>
                    <span className="text-xs capitalize text-slate-400">
                      {practiceQueue.primary.scenario.difficulty} ·{' '}
                      {practiceQueue.primary.scenario.estimatedMinutes}m
                    </span>
                  </div>
                  <h2 className="mt-1 font-display text-lg font-semibold text-white">
                    {practiceQueue.primary.scenario.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-300">
                    {practiceQueue.primary.reason}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={dismissingId === practiceQueue.primary.scenario.id}
                    onClick={() =>
                      handleDismissRecommendation(practiceQueue.primary!.scenario.id)
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Dismiss</span>
                  </button>
                  <Link
                    to={`/arena?scenario=${practiceQueue.primary.scenario.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-600/15 px-3.5 py-2 text-xs font-medium text-blue-300 hover:bg-blue-600/25 whitespace-nowrap"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    <span>Practice with AI [AI]</span>
                  </Link>
                  <Link
                    to={`/scenarios/${practiceQueue.primary.scenario.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 whitespace-nowrap"
                  >
                    <span>Inspect Scenario</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {practiceQueue.alternatives.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {practiceQueue.alternatives.map((alt) => (
                    <div
                      key={alt.scenario.id}
                      className="rounded-xl border border-slate-800 bg-[#111827] p-5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium capitalize text-emerald-400">
                            {alt.tag} option · {alt.scenario.domainTitle}
                          </span>
                          <button
                            type="button"
                            disabled={dismissingId === alt.scenario.id}
                            onClick={() =>
                              handleDismissRecommendation(alt.scenario.id)
                            }
                            className="text-slate-500 hover:text-slate-300"
                          >
                            Dismiss
                          </button>
                        </div>
                        <h3 className="mt-1.5 font-display text-sm font-semibold text-white">
                          {alt.scenario.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                          {alt.reason}
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <Link
                          to={`/arena?scenario=${alt.scenario.id}`}
                          className="text-slate-300 hover:text-blue-400"
                        >
                          Practice with AI [AI]
                        </Link>
                        <Link
                          to={`/scenarios/${alt.scenario.slug}`}
                          className="inline-flex items-center gap-1 font-medium text-blue-400 hover:text-blue-300"
                        >
                          <span>Open Brief</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Competency Map */}
          <section className="rounded-xl border border-slate-800 bg-[#111827] p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4 text-emerald-400" />
                <h2 className="font-display text-base font-semibold text-white">
                  Observed Engineering Competencies
                </h2>
              </div>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {competencies.length} tracked
              </span>
            </div>

            {competencies.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-300">
                  No competency observations recorded yet.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Complete a discussion room or AI Arena session and generate your private evaluation to start tracking observed engineering skills.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {competencies.map((comp) => {
                  const meta = competencyMetaMap.get(comp.competencyKey);
                  const relatedObs = observations
                    .filter((o) => o.competencyKey === comp.competencyKey)
                    .slice(0, 3);

                  return (
                    <article
                      key={comp.competencyKey}
                      className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4 flex flex-col justify-between"
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-white capitalize">
                          {meta?.title ?? comp.competencyKey.replace(/_/g, ' ')}
                        </h3>
                        {meta?.description ? (
                          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                            {meta.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-4 border-t border-slate-800/80 pt-3 text-xs text-slate-400 space-y-1.5">
                        <p>
                          Status:{' '}
                          <span className="font-medium capitalize text-blue-400">
                            {comp.status.replace(/_/g, ' ')}
                          </span>
                        </p>
                        <p className="font-mono tabular-nums">
                          {comp.observationCount} session obs · avg{' '}
                          {comp.averageRating ?? '—'}/4 · {comp.confidence} confidence
                        </p>
                        {comp.lastObservedAtMs ? (
                          <p>
                            Last observed{' '}
                            {new Date(comp.lastObservedAtMs).toLocaleDateString()}
                          </p>
                        ) : null}

                        {relatedObs.length > 0 ? (
                          <div className="pt-2 border-t border-slate-800/60">
                            <p className="text-[11px] font-medium text-slate-500 mb-1">
                              Contributing Sessions:
                            </p>
                            <ul className="space-y-1">
                              {relatedObs.map((obs) => {
                                const ev = evalBySessionId.get(obs.sessionId);
                                return (
                                  <li
                                    key={obs.id}
                                    className="flex items-center justify-between gap-2 text-[11px]"
                                  >
                                    <Link
                                      to={`/sessions/${obs.sessionId}/report`}
                                      className="truncate text-blue-400 hover:text-blue-300"
                                    >
                                      {ev?.scenarioTitle ??
                                        `Session ${obs.sessionId.slice(0, 8)}`}
                                    </Link>
                                    <span className="font-mono text-slate-500 shrink-0">
                                      {obs.rating}/4
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Report History */}
          <section className="rounded-xl border border-slate-800 bg-[#111827] p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-400" />
                <h2 className="font-display text-base font-semibold text-white">
                  Evaluation &amp; Session History
                </h2>
              </div>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {evaluations.length} reports · {sessions.length} sessions
              </span>
            </div>

            {evaluations.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Your generated session reports will appear here for review over time.
              </p>
            ) : (
              <ul className="divide-y divide-slate-800/80">
                {evaluations.map((ev) => (
                  <li
                    key={ev.id}
                    className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {ev.scenarioTitle}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        <span>
                          {new Date(ev.createdAtMs).toLocaleDateString()}
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
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        to={
                          ev.sessionId.startsWith('arena_')
                            ? `/arena/${ev.sessionId}`
                            : `/sessions/${ev.sessionId}`
                        }
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500"
                      >
                        Room Log
                      </Link>
                      <Link
                        to={`/sessions/${ev.sessionId}/report`}
                        className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                      >
                        View Report
                      </Link>
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

