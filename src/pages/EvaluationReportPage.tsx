import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Flag,
  Lock,
  Quote,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { WorkspaceShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import { fetchPublishedCatalogue } from '../features/catalogue/catalogueService';
import {
  generateAndSaveEvaluation,
  getSessionWithMessages,
  getUserEvaluationForSession,
  submitEvaluationFeedback,
} from '../features/sessions/sessionService';
import {
  computeRoomParticipantStandings,
  computeUserDebatePoints,
  RATING_BAND_LABELS,
  RUBRIC_DIMENSION_INFO,
} from '../../packages/domain/src/evaluation';
import type {
  ScenarioItem,
  SessionMessage,
  SessionSummary,
  UserEvaluationRecord,
} from '../../packages/domain/src/types';
import { Link } from '../lib/router';

export function EvaluationReportPage({ sessionId }: { sessionId: string }) {
  const { firebaseUser, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [scenario, setScenario] = useState<ScenarioItem | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [evaluation, setEvaluation] = useState<UserEvaluationRecord | null>(null);
  const autoGenTriggeredRef = useRef(false);

  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    let active = true;

    async function loadReportContext() {
      setLoading(true);
      setError(null);
      try {
        const uid = firebaseUser!.uid;
        const [existingEval, roomData, cat] = await Promise.all([
          getUserEvaluationForSession(uid, sessionId),
          getSessionWithMessages(sessionId, uid),
          fetchPublishedCatalogue(),
        ]);

        if (!active) return;
        setEvaluation(existingEval);
        setSession(roomData.session);
        setMessages(roomData.messages);
        if (roomData.session) {
          setScenario(
            cat.scenarios.find((s) => s.id === roomData.session!.scenarioId) ?? null
          );
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load evaluation context.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadReportContext();
    return () => {
      active = false;
    };
  }, [firebaseUser, sessionId]);

  const handleGenerate = async () => {
    if (!firebaseUser || !profile || !session || !scenario) return;
    setGenerating(true);
    setError(null);
    try {
      const record = await generateAndSaveEvaluation({
        uid: firebaseUser.uid,
        profile,
        session,
        scenario,
        messages,
      });
      setEvaluation(record);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not generate evaluation report right now.'
      );
    } finally {
      setGenerating(false);
    }
  };

  // Auto-generate report when room ends (e.g. last participant left or ?autogen=1)
  useEffect(() => {
    if (
      loading ||
      generating ||
      evaluation ||
      autoGenTriggeredRef.current ||
      !firebaseUser ||
      !profile ||
      !session ||
      !scenario ||
      session.status !== 'completed'
    ) {
      return;
    }
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (search.includes('autogen=1') || messages.length > 0) {
      autoGenTriggeredRef.current = true;
      void handleGenerate();
    }
  }, [
    loading,
    generating,
    evaluation,
    firebaseUser,
    profile,
    session,
    scenario,
    messages.length,
  ]);

  const handleFeedback = async (useful: 'useful' | 'mixed' | 'not_useful') => {
    if (!firebaseUser || !evaluation) return;
    setSubmittingFeedback(true);
    try {
      await submitEvaluationFeedback({
        uid: firebaseUser.uid,
        evaluationId: evaluation.id,
        feedbackUseful: useful,
        flaggedForReview: evaluation.flaggedForReview,
        flagReason: evaluation.flagReason,
      });
      setEvaluation({ ...evaluation, feedbackUseful: useful });
      setFeedbackSaved(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save feedback rating.'
      );
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleFlagSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !evaluation || !flagReason.trim()) return;
    setSubmittingFeedback(true);
    try {
      await submitEvaluationFeedback({
        uid: firebaseUser.uid,
        evaluationId: evaluation.id,
        feedbackUseful: evaluation.feedbackUseful ?? 'not_useful',
        flaggedForReview: true,
        flagReason: flagReason.trim(),
      });
      setEvaluation({
        ...evaluation,
        flaggedForReview: true,
        flagReason: flagReason.trim(),
      });
      setShowFlagForm(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to flag report for review.'
      );
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const report = evaluation?.report ?? null;

  const userMessages = useMemo(
    () =>
      messages.filter(
        (m) => m.senderUid === firebaseUser?.uid && m.messageType !== 'pass'
      ),
    [messages, firebaseUser?.uid]
  );

  const debatePoints = useMemo(
    () => (report ? computeUserDebatePoints(report, userMessages) : null),
    [report, userMessages]
  );

  const roomStandings = useMemo(
    () => computeRoomParticipantStandings([], messages),
    [messages]
  );

  return (
    <WorkspaceShell
      title="AI Review, Points & Formative Report"
      breadcrumb={`Sessions / ${session?.title ?? sessionId} / AI Review & Points`}
      action={
        <div className="flex items-center gap-2">
          <Link
            to="/leaderboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 whitespace-nowrap"
          >
            <Trophy className="h-3.5 w-3.5" />
            <span>Leaderboard</span>
          </Link>
          <Link
            to={
              sessionId.startsWith('arena_')
                ? `/arena/${sessionId}`
                : `/sessions/${sessionId}`
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>
              {sessionId.startsWith('arena_') ? 'Back to AI Arena' : 'Back to Room'}
            </span>
          </Link>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-4">
          <div className="h-36 animate-pulse rounded-xl border border-slate-800 bg-[#111827]" />
          <div className="h-72 animate-pulse rounded-xl border border-slate-800 bg-[#111827]" />
        </div>
      ) : !session ? (
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-8 text-center">
          <p className="text-sm text-slate-300">
            Session not found or unavailable to your account.
          </p>
          <Link to="/sessions" className="mt-3 inline-block text-sm text-blue-400">
            Return to Sessions
          </Link>
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

          {/* Privacy & AI Disclosure Banner */}
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Lock className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="text-xs leading-relaxed text-slate-300">
                <p className="font-medium text-white">
                  AI Review &amp; Debate Points for {profile?.displayName ?? 'you'} · Grounded in Live Room Transcripts
                </p>
                <p className="mt-0.5 text-slate-400">
                  Evaluations cite verified excerpts from your transcribed contributions and award points for Best Approach, Questioning Back, Clarification, and Trade-Off Defense.
                </p>
              </div>
            </div>
            {evaluation ? (
              <span className="font-mono text-xs text-slate-400 whitespace-nowrap shrink-0">
                Rubric v{evaluation.rubricVersion} · {evaluation.model}
              </span>
            ) : null}
          </div>

          {!report ? (
            <div className="rounded-xl border border-slate-800 bg-[#111827] p-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-blue-400" />
              <h2 className="mt-3 font-display text-lg font-semibold text-white">
                {generating
                  ? 'Auto-Generating AI Review, Debate Points & Personalized Roadmap...'
                  : session.status === 'completed'
                  ? 'Ready to generate your session evaluation & debate points'
                  : 'Complete the session before generating evaluation'}
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
                {session.status === 'completed'
                  ? 'Your report evaluates six engineering dimensions and computes points for Best Approach, Questioning Back, and Best Clarification from your room transcript.'
                  : `This room is currently "${session.status}". When everyone leaves the room or the host completes it, the AI report generates automatically.`}
              </p>
              <button
                type="button"
                disabled={
                  generating || session.status !== 'completed' || !scenario
                }
                onClick={handleGenerate}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {generating
                    ? 'Verifying transcript & generating AI review...'
                    : 'Generate AI Review & Points'}
                </span>
              </button>
            </div>
          ) : (
            <>
              {/* AI Debate & GD Points Scorecard */}
              {debatePoints ? (
                <section className="rounded-xl border border-amber-500/40 bg-[#111827] p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <Trophy className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                          AI Review &amp; Leaderboard Points Awarded
                        </p>
                        <h2 className="font-display text-lg font-semibold text-white">
                          {profile?.displayName ?? 'Learner'} — Debate &amp; GD Scorecard
                        </h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Total Session Score</p>
                        <p className="font-mono text-2xl font-bold text-amber-300">
                          {debatePoints.totalPoints}{' '}
                          <span className="text-sm font-normal text-slate-400">
                            / 100 pts
                          </span>
                        </p>
                      </div>
                      <Link
                        to="/leaderboard"
                        className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                      >
                        View Leaderboard
                      </Link>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4">
                      <p className="text-xs font-medium text-blue-400">
                        💡 Best Technical Approach
                      </p>
                      <p className="mt-1 font-mono text-xl font-bold text-white">
                        {debatePoints.bestApproachPts}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          / 30 pts
                        </span>
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Architecture design, load balancing, rate limiting &amp; concrete mechanisms.
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4">
                      <p className="text-xs font-medium text-emerald-400">
                        ❓ Questioning Back
                      </p>
                      <p className="mt-1 font-mono text-xl font-bold text-white">
                        {debatePoints.questionBackPts}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          / 25 pts
                        </span>
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Listening to peers and challenging assumptions or edge cases constructively.
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4">
                      <p className="text-xs font-medium text-violet-400">
                        🔍 Best Clarification
                      </p>
                      <p className="mt-1 font-mono text-xl font-bold text-white">
                        {debatePoints.clarificationPts}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          / 25 pts
                        </span>
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Framing bottlenecks, SLAs, constraints, and explaining why clearly.
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4">
                      <p className="text-xs font-medium text-amber-400">
                        ⚖️ Trade-Off Defense
                      </p>
                      <p className="mt-1 font-mono text-xl font-bold text-white">
                        {debatePoints.tradeoffDefensePts}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          / 20 pts
                        </span>
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Defending latency, consistency, cost, and failure recovery under pressure.
                      </p>
                    </div>
                  </div>

                  {debatePoints.badges.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs font-medium text-slate-400">
                        Earned Recognition Badges:
                      </span>
                      {debatePoints.badges.map((badge: string) => (
                        <span
                          key={badge}
                          className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200"
                        >
                          <Award className="h-3.5 w-3.5" />
                          <span>{badge}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {roomStandings.length > 0 ? (
                    <div className="border-t border-slate-800 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                        Room Participant Standings (From Named Voice &amp; Text Transcript)
                      </p>
                      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {roomStandings.map((st, idx) => (
                          <div
                            key={st.uid}
                            className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">
                                #{idx + 1} {st.displayName}
                              </span>
                              <span className="font-mono font-bold text-amber-300">
                                {st.totalPoints} pts
                              </span>
                            </div>
                            <p className="font-mono text-[11px] text-slate-400">
                              Approach {st.bestApproachPts} · Question Back{' '}
                              {st.questionBackPts} · Clarify {st.clarificationPts}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {/* Overall Summary */}
              <section className="rounded-xl border border-slate-800 bg-[#111827] p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
                  <div>
                    <p className="text-xs font-medium text-blue-400">
                      Session Summary
                    </p>
                    <h2 className="mt-1 font-display text-xl font-semibold text-white">
                      {session.title}
                    </h2>
                  </div>
                  <span className="text-xs font-medium capitalize text-slate-300">
                    Overall confidence: {report.confidence}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-200">
                  {report.summary}
                </p>

                {report.strengths.length > 0 ? (
                  <div className="mt-5 rounded-lg border border-slate-800 bg-[#0B0F17] p-4">
                    <p className="text-xs font-medium text-emerald-400">
                      Observed Strengths
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
                      {report.strengths.map((st, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                          <span>{st}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              {/* 6 Engineering Rubric Dimensions */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Engineering Dimensions &amp; Verified Evidence
                  </h2>
                  <span className="text-xs text-slate-400">
                    0–4 formative rubric
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {report.dimensions.map((dim) => {
                    const info = RUBRIC_DIMENSION_INFO[dim.key];
                    const ratingLabel =
                      dim.status === 'scored' && dim.rating !== null
                        ? RATING_BAND_LABELS[dim.rating] ?? `${dim.rating}/4`
                        : dim.status === 'insufficient_evidence'
                        ? 'Insufficient evidence'
                        : 'Not applicable';

                    return (
                      <article
                        key={dim.key}
                        className="rounded-xl border border-slate-800 bg-[#111827] p-5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-display text-base font-semibold text-white">
                                {info?.name ?? dim.key.replace(/_/g, ' ')}
                              </h3>
                              <p className="mt-0.5 text-xs text-slate-400">
                                {info?.description}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <span
                              className={`font-semibold ${
                                dim.status === 'scored'
                                  ? 'text-blue-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {ratingLabel}
                            </span>
                            <span aria-hidden="true" className="text-slate-600">
                              ·
                            </span>
                            <span className="capitalize text-slate-400">
                              {dim.confidence} confidence
                            </span>
                          </div>

                          <p className="mt-3 text-sm leading-relaxed text-slate-300">
                            {dim.summary}
                          </p>
                        </div>

                        {dim.evidence.length > 0 ? (
                          <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">
                            <p className="text-xs font-medium text-slate-400">
                              Cited Evidence
                            </p>
                            {dim.evidence.map((ev, idx) => (
                              <div
                                key={`${ev.message_id}_${idx}`}
                                className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 text-xs"
                              >
                                <div className="flex items-start gap-2 text-slate-200">
                                  <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                                  <span className="italic">
                                    &ldquo;{ev.excerpt}&rdquo;
                                  </span>
                                </div>
                                <p className="mt-1.5 text-slate-400">
                                  {ev.explanation}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>

              {/* Actionable Improvements & Next Practice */}
              <div className="grid gap-6 lg:grid-cols-3">
                <section className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#111827] p-6">
                  <h2 className="font-display text-base font-semibold text-white">
                    Targeted Next Improvements
                  </h2>
                  {report.improvements.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-400">
                      Contribute substantive technical reasoning and follow-up questions in your next session to unlock targeted improvement steps.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-4">
                      {report.improvements.map((item, idx) => (
                        <li
                          key={idx}
                          className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4"
                        >
                          <p className="text-sm font-medium text-white">
                            {item.action}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-400">
                            {item.why_it_matters}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-xl border border-slate-800 bg-[#111827] p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-medium text-violet-400">
                      Recommended Next Practice
                    </p>
                    <h2 className="mt-1 font-display text-base font-semibold text-white capitalize">
                      {report.next_practice.competency_key.replace(/_/g, ' ')}
                    </h2>
                    <p className="mt-1 text-xs text-slate-400 capitalize">
                      Format: {report.next_practice.suggested_activity_type.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">
                      {report.next_practice.reason}
                    </p>
                  </div>
                  <Link
                    to="/explore"
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                  >
                    <span>Explore Scenarios</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </section>
              </div>

              {/* Learner Feedback & Flag for Human Review */}
              <section className="rounded-xl border border-slate-800 bg-[#111827] p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-display text-sm font-semibold text-white">
                      Was this evaluation fair and helpful?
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      Your feedback improves rubric calibration. You can flag any inaccurate report for review.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {(['useful', 'mixed', 'not_useful'] as const).map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        disabled={submittingFeedback}
                        onClick={() => handleFeedback(choice)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                          evaluation?.feedbackUseful === choice
                            ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                            : 'border-slate-700 bg-[#0B0F17] text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {choice.replace(/_/g, ' ')}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={evaluation?.flaggedForReview}
                      onClick={() => setShowFlagForm((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      <span>
                        {evaluation?.flaggedForReview
                          ? 'Flagged for Review'
                          : 'Flag Inaccuracy'}
                      </span>
                    </button>
                  </div>
                </div>

                {feedbackSaved ? (
                  <p className="mt-3 text-xs text-emerald-400">
                    Feedback recorded. Thank you.
                  </p>
                ) : null}

                {evaluation?.flaggedForReview && evaluation.flagReason ? (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Flagged for review: {evaluation.flagReason}</span>
                  </div>
                ) : null}

                {showFlagForm && !evaluation?.flaggedForReview ? (
                  <form onSubmit={handleFlagSubmit} className="mt-4 space-y-3 border-t border-slate-800 pt-4">
                    <label htmlFor="flagReason" className="block text-xs font-medium text-slate-300">
                      Describe what was misquoted or unfairly assessed
                    </label>
                    <textarea
                      id="flagReason"
                      required
                      minLength={5}
                      maxLength={500}
                      rows={2}
                      value={flagReason}
                      onChange={(e) => setFlagReason(e.target.value)}
                      placeholder="e.g., Missed my follow-up explanation about idempotency keys..."
                      className="w-full rounded-lg border border-slate-700 bg-[#0B0F17] p-2.5 text-sm text-white"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowFlagForm(false)}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingFeedback}
                        className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
                      >
                        Submit Review Flag
                      </button>
                    </div>
                  </form>
                ) : null}
              </section>
            </>
          )}
        </div>
      )}
    </WorkspaceShell>
  );
}
