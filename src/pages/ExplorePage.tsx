import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Calendar,
  Code2,
  Compass,
  Search,
  Users,
} from 'lucide-react';
import { WorkspaceShell } from '../components/AppShell';
import { fetchPublishedCatalogue } from '../features/catalogue/catalogueService';
import {
  createSessionRoom,
  listDiscoverableSessions,
} from '../features/sessions/sessionService';
import { useAuth } from '../features/auth/AuthContext';
import { Link, useRouter } from '../lib/router';
import {
  DIFFICULTIES,
  ROOM_TYPES,
  type Difficulty,
  type DomainItem,
  type RoomType,
  type ScenarioItem,
  type SessionSummary,
} from '../../packages/domain/src/types';
import { PILOT_COMPETENCIES } from '../../packages/domain/src/catalogue';

export function ExplorePage() {
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | Difficulty>('all');
  const [selectedRoomType, setSelectedRoomType] = useState<'all' | RoomType>('all');

  useEffect(() => {
    let active = true;
    fetchPublishedCatalogue()
      .then((res) => {
        if (!active) return;
        setDomains(res.domains);
        setScenarios(res.scenarios);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = scenarios.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.context.toLowerCase().includes(q) ||
      s.domainTitle.toLowerCase().includes(q);
    const matchesDomain = selectedDomain === 'all' || s.domainId === selectedDomain;
    const matchesDifficulty =
      selectedDifficulty === 'all' || s.difficulty === selectedDifficulty;
    const matchesRoom =
      selectedRoomType === 'all' || s.roomType === selectedRoomType;
    return matchesSearch && matchesDomain && matchesDifficulty && matchesRoom;
  });

  return (
    <WorkspaceShell
      title="Explore Engineering Topics & Scenarios"
      breadcrumb="Catalogue"
      action={
        <div className="flex items-center gap-2">
          <Link
            to="/arena"
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-600/15 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-600/25 whitespace-nowrap"
          >
            <Bot className="h-3.5 w-3.5" />
            <span>AI Practice Arena</span>
          </Link>
          <Link
            to="/sessions"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 whitespace-nowrap"
          >
            <span>Open Sessions</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Curated Engineering Domains / Topics */}
        {domains.length > 0 ? (
          <section aria-label="Engineering Domains">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-blue-400" />
                <h2 className="font-display text-sm font-semibold text-white">
                  Engineering Domains &amp; Topics
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Select a domain to inspect competencies or filter scenarios
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {domains.map((domain) => {
                const count = scenarios.filter((s) => s.domainId === domain.id).length;
                const isSelected = selectedDomain === domain.id;
                return (
                  <div
                    key={domain.id}
                    className={`rounded-xl border p-4 flex flex-col justify-between transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-950/20'
                        : 'border-slate-800 bg-[#111827]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="font-mono tabular-nums">
                          {count} {count === 1 ? 'scenario' : 'scenarios'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDomain((prev) =>
                              prev === domain.id ? 'all' : domain.id
                            )
                          }
                          className="text-blue-400 hover:text-blue-300 font-medium"
                        >
                          {isSelected ? 'Clear filter' : 'Filter below'}
                        </button>
                      </div>
                      <h3 className="mt-1.5 font-display text-sm font-semibold text-white">
                        {domain.title}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        {domain.description}
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        {PILOT_COMPETENCIES.filter((c) => c.domainId === domain.id).length} core competencies
                      </span>
                      <Link
                        to={`/topics/${domain.slug}`}
                        className="inline-flex items-center gap-1 font-medium text-slate-200 hover:text-blue-400"
                      >
                        <span>Topic Overview</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Filters */}
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scenarios, systems, or concepts..."
                aria-label="Search scenarios"
                className="w-full rounded-lg border border-slate-700 bg-[#0B0F17] py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500"
              />
            </div>

            <select
              aria-label="Filter by domain"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-slate-200"
            >
              <option value="all">All domains</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by difficulty"
              value={selectedDifficulty}
              onChange={(e) =>
                setSelectedDifficulty(e.target.value as 'all' | Difficulty)
              }
              className="rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-slate-200 capitalize"
            >
              <option value="all">All levels</option>
              {DIFFICULTIES.map((diff) => (
                <option key={diff} value={diff}>
                  {diff}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedRoomType('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                selectedRoomType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              All formats
            </button>
            {ROOM_TYPES.map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => setSelectedRoomType(rt)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                  selectedRoomType === rt
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {rt.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-xl border border-slate-800 bg-[#111827]"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-10 text-center">
            <p className="text-sm text-slate-300">
              No scenarios match your current filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedDomain('all');
                setSelectedDifficulty('all');
                setSelectedRoomType('all');
              }}
              className="mt-3 text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {filtered.map((scenario) => (
              <article
                key={scenario.id}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-[#111827] p-6"
              >
                <div>
                  <p className="text-xs text-slate-400">
                    <span>{scenario.domainTitle}</span>
                    <span className="mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    <span className="capitalize">{scenario.difficulty}</span>
                    <span className="mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono tabular-nums">
                      {scenario.estimatedMinutes}m
                    </span>
                    <span className="mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    <span className="capitalize">
                      {scenario.roomType.replace(/_/g, ' ')}
                    </span>
                  </p>
                  <h2 className="mt-2 font-display text-lg font-semibold text-white">
                    {scenario.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {scenario.context}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-4">
                  <Link
                    to={`/arena?scenario=${scenario.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-blue-400"
                  >
                    <Bot className="h-3.5 w-3.5 text-blue-400" />
                    <span>Practice with AI [AI]</span>
                  </Link>
                  <Link
                    to={`/scenarios/${scenario.slug}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300"
                  >
                    <span>Inspect Brief &amp; Rooms</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

export function TopicDetailPage({ slug }: { slug: string }) {
  const [domain, setDomain] = useState<DomainItem | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchPublishedCatalogue()
      .then((res) => {
        if (!active) return;
        const found =
          res.domains.find((d) => d.slug === slug || d.id === slug) ?? null;
        setDomain(found);
        if (found) {
          setScenarios(res.scenarios.filter((s) => s.domainId === found.id));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const domainCompetencies = PILOT_COMPETENCIES.filter(
    (c) => c.domainId === domain?.id
  );

  return (
    <WorkspaceShell
      title={domain?.title ?? 'Engineering Topic'}
      breadcrumb="Explore / Topic Overview"
      action={
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Explore</span>
        </Link>
      }
    >
      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-slate-800 bg-[#111827]" />
      ) : !domain ? (
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-8 text-center">
          <p className="text-sm text-slate-300">Engineering topic not found.</p>
          <Link to="/explore" className="mt-3 inline-block text-sm text-blue-400">
            Return to Explore
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-800 bg-[#111827] p-6">
            <p className="text-xs font-medium text-blue-400">
              Curated Engineering Domain
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-white">
              {domain.title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
              {domain.description}
            </p>

            {domainCompetencies.length > 0 ? (
              <div className="mt-6 border-t border-slate-800 pt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Target Engineering Competencies
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {domainCompetencies.map((comp) => (
                    <div
                      key={comp.id}
                      className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4"
                    >
                      <p className="font-display text-sm font-semibold text-white">
                        {comp.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        {comp.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-base font-semibold text-white">
              Scenarios in {domain.title} ({scenarios.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {scenarios.map((scenario) => (
                <article
                  key={scenario.id}
                  className="rounded-xl border border-slate-800 bg-[#111827] p-6 flex flex-col justify-between"
                >
                  <div>
                    <p className="text-xs text-slate-400">
                      <span className="capitalize">{scenario.difficulty}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono tabular-nums">
                        {scenario.estimatedMinutes} min
                      </span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span className="capitalize">
                        {scenario.roomType.replace(/_/g, ' ')}
                      </span>
                    </p>
                    <h3 className="mt-2 font-display text-lg font-semibold text-white">
                      {scenario.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                      {scenario.context}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">
                    <Link
                      to={`/arena?scenario=${scenario.id}`}
                      className="text-xs font-medium text-slate-300 hover:text-blue-400"
                    >
                      Practice with AI [AI]
                    </Link>
                    <Link
                      to={`/scenarios/${scenario.slug}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300"
                    >
                      <span>Open Scenario Brief</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </WorkspaceShell>
  );
}

export function ScenarioDetailPage({ slug }: { slug: string }) {
  const { firebaseUser, profile } = useAuth();
  const { navigate } = useRouter();
  const [scenario, setScenario] = useState<ScenarioItem | null>(null);
  const [relatedRooms, setRelatedRooms] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [capacity, setCapacity] = useState(4);
  const [mode, setMode] = useState<'scheduled' | 'async'>('async');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchPublishedCatalogue(),
      listDiscoverableSessions().catch(() => [] as SessionSummary[]),
    ])
      .then(([res, rooms]) => {
        if (!active) return;
        const found = res.scenarios.find((s) => s.slug === slug) ?? null;
        setScenario(found);
        if (found) {
          setRelatedRooms(
            rooms.filter(
              (r) =>
                r.scenarioId === found.id &&
                r.status !== 'completed' &&
                r.status !== 'cancelled'
            )
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const handleOpenRoom = async () => {
    if (!firebaseUser || !profile || !scenario) return;
    setError(null);
    setCreating(true);
    let parsedStartsAt: number | null = null;
    if (mode === 'scheduled' && scheduledDateTime.trim()) {
      const ms = new Date(scheduledDateTime).getTime();
      if (!Number.isNaN(ms) && ms > Date.now()) {
        parsedStartsAt = ms;
      }
    }

    try {
      const sessionId = await createSessionRoom({
        scenario,
        hostUid: firebaseUser.uid,
        hostDisplayName: profile.displayName,
        title: scenario.title,
        roomType: scenario.roomType,
        participationMode: mode,
        visibility: 'public',
        capacity,
        startsAtMs: parsedStartsAt,
      });
      navigate(`/sessions/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create room.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <WorkspaceShell
      title={scenario?.title ?? 'Scenario Brief'}
      breadcrumb="Explore / Scenario"
      action={
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Explore</span>
        </Link>
      }
    >
      {loading ? (
        <div className="h-72 animate-pulse rounded-xl border border-slate-800 bg-[#111827]" />
      ) : !scenario ? (
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-8 text-center">
          <p className="text-sm text-slate-300">Scenario not found.</p>
          <Link to="/explore" className="mt-3 inline-block text-sm text-blue-400">
            Return to catalogue
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="rounded-xl border border-slate-800 bg-[#111827] p-6">
              <p className="text-xs text-slate-400">
                <span>{scenario.domainTitle}</span>
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span>{scenario.topicTitle}</span>
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span className="capitalize">{scenario.difficulty}</span>
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono tabular-nums">
                  {scenario.estimatedMinutes} min
                </span>
              </p>
              <h2 className="mt-3 font-display text-xl font-semibold text-white">
                Context &amp; Problem Statement
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {scenario.context}
              </p>
              <div className="mt-5 rounded-lg border border-slate-800 bg-[#0B0F17] p-4">
                <p className="text-xs font-medium text-blue-400">
                  Discussion Prompt
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-100">
                  {scenario.prompt}
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-5">
              <div>
                <h3 className="font-display text-base font-semibold text-white">
                  Constraints
                </h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-300">
                  {scenario.constraints.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-display text-base font-semibold text-white">
                  Learning Objectives
                </h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-300">
                  {scenario.learningObjectives.map((obj, idx) => (
                    <li key={idx}>{obj}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-display text-base font-semibold text-white">
                  Prerequisites
                </h3>
                <p className="mt-1.5 text-sm text-slate-400">
                  {scenario.prerequisites.join(' · ')}
                </p>
              </div>
            </section>

            {scenario.codeArtifact ? (
              <section className="rounded-xl border border-slate-800 bg-[#111827] p-6">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-blue-400" />
                  <h3 className="font-display text-base font-semibold text-white">
                    Reference Code &amp; Telemetry Artifact
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Inside the session room, participants can pin line-by-line review annotations on this artifact.
                </p>
                <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-[#0B0F17] p-4 font-mono text-xs leading-relaxed text-slate-200">
                  {scenario.codeArtifact}
                </pre>
              </section>
            ) : null}
          </div>

          <aside className="space-y-6">
            {/* Open Peer Room Card */}
            <div className="rounded-xl border border-slate-800 bg-[#111827] p-6">
              <div className="flex items-center gap-2 text-blue-400">
                <Users className="h-4 w-4" />
                <h3 className="font-display text-base font-semibold text-white">
                  Open a Peer Practice Room
                </h3>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                Creates a structured room (2–6 learners) with turn-taking, live Audio/Video Stage, and collaborative Architecture &amp; Code Review Labs.
              </p>

              {error ? (
                <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
                  {error}
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="roomCapacity"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Seat Capacity (2–6)
                  </label>
                  <select
                    id="roomCapacity"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white"
                  >
                    {[2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} participants
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="participationMode"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Participation Mode
                  </label>
                  <select
                    id="participationMode"
                    value={mode}
                    onChange={(e) =>
                      setMode(e.target.value as 'scheduled' | 'async')
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white"
                  >
                    <option value="async">Async-friendly window</option>
                    <option value="scheduled">Live scheduled session</option>
                  </select>
                </div>

                {mode === 'scheduled' ? (
                  <div>
                    <label
                      htmlFor="scenarioScheduleTime"
                      className="block text-xs font-medium text-slate-300"
                    >
                      Scheduled Start Time (Optional)
                    </label>
                    <input
                      id="scenarioScheduleTime"
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-xs text-white"
                    />
                  </div>
                ) : null}

                <button
                  type="button"
                  disabled={creating}
                  onClick={handleOpenRoom}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
                >
                  {creating ? 'Creating room...' : 'Create & Enter Peer Room'}
                </button>
              </div>
            </div>

            {/* AI Practice Arena Quick Launch */}
            <div className="rounded-xl border border-slate-800 bg-[#111827] p-6">
              <div className="flex items-center gap-2 text-blue-400">
                <Bot className="h-4 w-4" />
                <h3 className="font-display text-base font-semibold text-white">
                  Solo AI Practice Arena
                </h3>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                Want to rehearse your architecture or debugging explanation right now? Practice 1-on-1 or with a multi-role AI panel (<span className="font-mono text-slate-200">[AI]</span>).
              </p>
              <Link
                to={`/arena?scenario=${scenario.id}`}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#0B0F17] px-4 py-2.5 text-xs font-semibold text-slate-100 hover:border-blue-500"
              >
                <Bot className="h-3.5 w-3.5 text-blue-400" />
                <span>Launch Scenario in AI Arena</span>
              </Link>
            </div>

            {/* Existing Open Rooms for this Scenario */}
            {relatedRooms.length > 0 ? (
              <div className="rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  <h3 className="font-display text-sm font-semibold text-white">
                    Active &amp; Upcoming Rooms ({relatedRooms.length})
                  </h3>
                </div>
                <ul className="space-y-2.5">
                  {relatedRooms.slice(0, 4).map((rm) => (
                    <li
                      key={rm.id}
                      className="rounded-lg border border-slate-800 bg-[#0B0F17] p-3 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">
                          {rm.title}
                        </p>
                        <p className="mt-0.5 text-slate-400 font-mono tabular-nums">
                          {rm.participantCount}/{rm.capacity} seats · {rm.status}
                        </p>
                      </div>
                      <Link
                        to={`/sessions/${rm.id}`}
                        className="shrink-0 font-semibold text-blue-400 hover:text-blue-300"
                      >
                        Open →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </WorkspaceShell>
  );
}
