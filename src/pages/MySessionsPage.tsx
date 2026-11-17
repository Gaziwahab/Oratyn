import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { WorkspaceShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import {
  listDiscoverableSessions,
  listUserArenaSessions,
  listUserEvaluations,
  listUserJoinedSessions,
  reconcileStaleUserRooms,
} from '../features/sessions/sessionService';
import { Link } from '../lib/router';
import { AI_ARENA_MODE_INFO } from '../../packages/domain/src/discussion';
import type {
  ArenaSessionSummary,
  SessionSummary,
  UserEvaluationRecord,
} from '../../packages/domain/src/types';

type ActivityFilter = 'all' | 'active' | 'hosted' | 'completed' | 'arena';

export function MySessionsPage() {
  const { firebaseUser, profile } = useAuth();
  const [peerSessions, setPeerSessions] = useState<SessionSummary[]>([]);
  const [arenaSessions, setArenaSessions] = useState<ArenaSessionSummary[]>([]);
  const [evaluations, setEvaluations] = useState<UserEvaluationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!firebaseUser) return;
    let active = true;
    setLoading(true);
    const uid = firebaseUser.uid;

    reconcileStaleUserRooms({
      uid,
      displayName:
        profile?.displayName ?? firebaseUser.displayName ?? 'Participant',
      activeSessionId: null,
      profile,
    })
      .then(() =>
        Promise.all([
          listUserJoinedSessions(uid).catch(() => [] as SessionSummary[]),
          listDiscoverableSessions().catch(() => [] as SessionSummary[]),
          listUserArenaSessions(uid).catch(() => [] as ArenaSessionSummary[]),
          listUserEvaluations(uid).catch(() => [] as UserEvaluationRecord[]),
        ])
      )
      .then(([joinedRooms, allSessions, arenas, evals]) => {
        if (!active) return;
        const byId = new Map<string, SessionSummary>();
        for (const s of joinedRooms) {
          byId.set(s.id, s);
        }
        for (const s of allSessions) {
          if (s.participantUids.includes(uid) || s.hostUid === uid) {
            byId.set(s.id, s);
          }
        }
        setPeerSessions(
          Array.from(byId.values()).sort((a, b) => b.createdAtMs - a.createdAtMs)
        );
        setArenaSessions(arenas);
        setEvaluations(evals);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [firebaseUser, profile]);

  const evalBySessionId = useMemo(() => {
    const map = new Map<string, UserEvaluationRecord>();
    for (const ev of evaluations) {
      map.set(ev.sessionId, ev);
    }
    return map;
  }, [evaluations]);

  const filteredPeerSessions = useMemo(() => {
    if (filter === 'arena') return [];
    const q = searchQuery.trim().toLowerCase();
    return peerSessions.filter((s) => {
      if (
        q &&
        !s.title.toLowerCase().includes(q) &&
        !s.scenarioTitle.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (filter === 'active') {
        return (
          s.status === 'active' ||
          s.status === 'open' ||
          s.status === 'scheduled' ||
          s.status === 'paused'
        );
      }
      if (filter === 'hosted') {
        return s.hostUid === firebaseUser?.uid;
      }
      if (filter === 'completed') {
        return s.status === 'completed';
      }
      return true;
    });
  }, [peerSessions, filter, searchQuery, firebaseUser?.uid]);

  const filteredArenaSessions = useMemo(() => {
    if (filter === 'hosted') return [];
    const q = searchQuery.trim().toLowerCase();
    return arenaSessions.filter((a) => {
      if (q && !a.scenarioTitle.toLowerCase().includes(q)) {
        return false;
      }
      if (filter === 'active') return a.status === 'active';
      if (filter === 'completed') return a.status === 'completed';
      return true;
    });
  }, [arenaSessions, filter, searchQuery]);

  const activeCount =
    peerSessions.filter(
      (s) =>
        s.status === 'active' ||
        s.status === 'open' ||
        s.status === 'scheduled' ||
        s.status === 'paused'
    ).length + arenaSessions.filter((a) => a.status === 'active').length;

  const completedCount =
    peerSessions.filter((s) => s.status === 'completed').length +
    arenaSessions.filter((a) => a.status === 'completed').length;

  return (
    <WorkspaceShell
      title="My Sessions & Practice History"
      breadcrumb="Activity Log"
      action={
        <div className="flex items-center gap-2">
          <Link
            to="/arena"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#111827] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-blue-500 whitespace-nowrap"
          >
            <Bot className="h-3.5 w-3.5 text-blue-400" />
            <span>AI Arena</span>
          </Link>
          <Link
            to="/sessions"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Browse &amp; Host Rooms</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Summary Strip */}
        <section className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
            <p className="text-xs text-slate-400">Joined Peer Rooms</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              {peerSessions.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
            <p className="text-xs text-slate-400">AI Arena Sessions</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              {arenaSessions.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
            <p className="text-xs text-slate-400">Active &amp; Scheduled</p>
            <p className="mt-1 font-mono text-2xl font-bold text-blue-400 tabular-nums">
              {activeCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
            <p className="text-xs text-slate-400">Private Reports Generated</p>
            <p className="mt-1 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
              {evaluations.length}
            </p>
          </div>
        </section>

        {/* Filter & Search Bar */}
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: 'all', label: 'All Activity' },
                { id: 'active', label: `Active & Scheduled (${activeCount})` },
                { id: 'hosted', label: 'Hosted by Me' },
                { id: 'completed', label: `Completed (${completedCount})` },
                { id: 'arena', label: 'AI Arena Only' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  filter === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title or scenario..."
              aria-label="Filter my sessions"
              className="w-full rounded-lg border border-slate-700 bg-[#0B0F17] py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-slate-800 bg-[#111827]"
              />
            ))}
          </div>
        ) : filteredPeerSessions.length === 0 &&
          filteredArenaSessions.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-10 text-center">
            <Calendar className="mx-auto h-8 w-8 text-slate-500" />
            <h2 className="mt-3 font-display text-base font-semibold text-white">
              No matching sessions in your history yet
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Join a peer discussion room or start an on-demand AI Practice Arena session to build your engineering practice history.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/sessions"
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Find a Peer Session
              </Link>
              <Link
                to="/arena"
                className="rounded-lg border border-slate-700 bg-[#0B0F17] px-4 py-2 text-xs font-medium text-slate-200 hover:border-blue-500"
              >
                Start AI Arena Practice
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Peer Discussion Rooms */}
            {filteredPeerSessions.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  <h2 className="font-display text-sm font-semibold text-white">
                    Peer Discussion Rooms ({filteredPeerSessions.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {filteredPeerSessions.map((sess) => {
                    const hasEval = evalBySessionId.has(sess.id);
                    const isHost = sess.hostUid === firebaseUser?.uid;
                    return (
                      <article
                        key={sess.id}
                        className="rounded-xl border border-slate-800 bg-[#111827] p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span
                              className={`font-medium capitalize ${
                                sess.status === 'active'
                                  ? 'text-emerald-400'
                                  : sess.status === 'completed'
                                  ? 'text-blue-400'
                                  : 'text-amber-300'
                              }`}
                            >
                              {sess.status}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">
                              {sess.roomType.replace(/_/g, ' ')}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">{sess.difficulty}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {sess.participantCount}/{sess.capacity} seats
                            </span>
                            {isHost ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-slate-200 font-medium">
                                  Hosted by you
                                </span>
                              </>
                            ) : null}
                            {sess.startsAtMs ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 text-slate-300">
                                  <Clock className="h-3 w-3 text-blue-400" />
                                  {new Date(sess.startsAtMs).toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </>
                            ) : null}
                          </div>

                          <h3 className="mt-1.5 font-display text-base font-semibold text-white">
                            {sess.title}
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-400">
                            Scenario: {sess.scenarioTitle} · Phase:{' '}
                            <span className="capitalize">
                              {sess.currentPhase.replace(/_/g, ' ')}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {sess.status === 'completed' ? (
                            <Link
                              to={`/sessions/${sess.id}/report`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-600/15 px-3.5 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-600/25"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>
                                {hasEval ? 'View AI Report' : 'Generate AI Report'}
                              </span>
                            </Link>
                          ) : null}
                          <Link
                            to={`/sessions/${sess.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                          >
                            <span>
                              {sess.status === 'completed'
                                ? 'Review Transcript'
                                : 'Enter Room'}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* AI Practice Arena Sessions */}
            {filteredArenaSessions.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-blue-400" />
                  <h2 className="font-display text-sm font-semibold text-white">
                    AI Practice Arena Sessions ({filteredArenaSessions.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {filteredArenaSessions.map((arena) => {
                    const modeInfo = AI_ARENA_MODE_INFO[arena.mode];
                    const hasEval = evalBySessionId.has(arena.id);
                    return (
                      <article
                        key={arena.id}
                        className="rounded-xl border border-slate-800 bg-[#111827] p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span
                              className={
                                arena.status === 'completed'
                                  ? 'text-emerald-400 font-medium inline-flex items-center gap-1'
                                  : 'text-blue-400 font-medium'
                              }
                            >
                              {arena.status === 'completed' ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : null}
                              {arena.status === 'completed'
                                ? 'Completed'
                                : 'In Progress'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{modeInfo?.title ?? arena.mode}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-blue-400">[AI]</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {arena.turnCount} turns
                            </span>
                          </div>
                          <h3 className="mt-1.5 font-display text-base font-semibold text-white">
                            {arena.scenarioTitle}
                          </h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {arena.status === 'completed' ? (
                            <Link
                              to={`/sessions/${arena.id}/report`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-600/15 px-3.5 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-600/25"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>
                                {hasEval ? 'View AI Report' : 'Generate AI Report'}
                              </span>
                            </Link>
                          ) : null}
                          <Link
                            to={`/arena/${arena.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0B0F17] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-blue-500"
                          >
                            <span>
                              {arena.status === 'completed'
                                ? 'Inspect Arena'
                                : 'Resume Arena'}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
