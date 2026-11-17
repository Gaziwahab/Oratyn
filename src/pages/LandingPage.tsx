import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  ArrowRight,
  Box,
  Code2,
  Quote,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Link } from '../lib/router';
import { useAuth } from '../features/auth/AuthContext';
import { PILOT_SCENARIOS } from '../../packages/domain/src/catalogue';
import type { RoomType, ScenarioItem } from '../../packages/domain/src/types';
import {
  ThreeArchitectureStage,
  type ArchitectureStagePreset,
} from '../components/ThreeArchitectureStage';
import heroDebateImg from '../assets/images/hero_engineering_debate_stage_1794544516148.jpg';
import labTopologyImg from '../assets/images/lab_distributed_topology_1794544516320.jpg';
import arenaStudioImg from '../assets/images/arena_ai_interviewer_studio_1794544516684.jpg';
import passportEmblemImg from '../assets/images/passport_verified_emblem_1794544516416.jpg';

const ROOM_FILTER_OPTIONS: Array<{ value: 'all' | RoomType; label: string }> = [
  { value: 'all', label: 'All formats' },
  { value: 'system_design', label: 'System Design' },
  { value: 'incident', label: 'Incident' },
  { value: 'debug', label: 'Debug' },
  { value: 'debate', label: 'Debate' },
  { value: 'code_review', label: 'Code Review' },
  { value: 'teach', label: 'Teach-Back' },
];

const SCROLL_STAGE_CHAPTERS: Array<{
  num: string;
  preset: ArchitectureStagePreset;
  title: string;
  subtitle: string;
  description: string;
  metric: string;
}> = [
  {
    num: '01.',
    preset: 'overview',
    title: 'Pre-Decided System Topics & 10-Seat Debate Rooms',
    subtitle: 'System Design · Rate Limiting · Load Balancing · Incident Triage',
    description:
      'Up to 10 developers or CS students join a structured room around a real-world engineering challenge. Rooms remain active while participants are inside and automatically close to generate the AI report when the room empties.',
    metric: '2–10 seats · Auto-lifecycle management',
  },
  {
    num: '02.',
    preset: 'debate_ring',
    title: 'Active Speaker Turn & Attributed Voice Transcription',
    subtitle: '1 Speaking · 9 Listening & Queueing Cross-Questions',
    description:
      'Every participant gets a dedicated turn to explain their architecture or challenge a peer. Everything spoken on stage is transcribed live with the speaker’s name and turn intent so quieter engineers are heard.',
    metric: 'Live Speech-to-Text · Named speaker attribution',
  },
  {
    num: '03.',
    preset: 'load_balancer',
    title: 'Collaborative System Topology & Code Review Labs',
    subtitle: 'Interactive Node Graphs · Line-Level Risk Annotations',
    description:
      'While debating how to prevent retry storms or database CPU saturation, participants co-design live architecture nodes and annotate reference code line by line inside the room workspace.',
    metric: 'Real-time Firestore sync · 3D & 2D topology view',
  },
  {
    num: '04.',
    preset: 'ai_core',
    title: 'Evidence-Linked AI Evaluation & Personalized Roadmap',
    subtitle: 'Best Approach · Questioning Back · Clarification · Defense',
    description:
      'When the debate concludes, the server-side Gemini evaluator verifies exact transcript quotes and awards points for questioning back, clarifying constraints, proposing sound approaches, and defending trade-offs.',
    metric: '0–4 Rubric · Monitored upskill roadmap',
  },
];

export function LandingPage() {
  const { firebaseUser } = useAuth();
  const [selectedRoomType, setSelectedRoomType] = useState<'all' | RoomType>('all');
  const [previewScenario, setPreviewScenario] = useState<ScenarioItem | null>(null);
  const [active3DPreset, setActive3DPreset] =
    useState<ArchitectureStagePreset>('overview');
  const [heroImgError, setHeroImgError] = useState(false);
  const [bentoImgErrors, setBentoImgErrors] = useState<Record<string, boolean>>({});

  const heroSectionRef = useRef<HTMLElement | null>(null);
  const chapterRefs = useRef<Array<HTMLDivElement | null>>([]);

  const visibleScenarios = PILOT_SCENARIOS.filter(
    (s) => selectedRoomType === 'all' || s.roomType === selectedRoomType
  );

  // Subtle GSAP entrance & scroll-linked chapter choreography
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion && heroSectionRef.current) {
      const items = heroSectionRef.current.querySelectorAll('[data-gsap-hero]');
      gsap.fromTo(
        items,
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          stagger: 0.08,
          ease: 'power3.out',
        }
      );
    }

    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const presetAttr = entry.target.getAttribute(
              'data-stage-preset'
            ) as ArchitectureStagePreset | null;
            if (presetAttr) {
              setActive3DPreset(presetAttr);
            }
          }
        }
      },
      {
        rootMargin: '-25% 0px -35% 0px',
        threshold: 0.25,
      }
    );

    for (const el of chapterRefs.current) {
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-800/70 bg-[#06090F]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20">
              <Box className="h-4 w-4" />
            </span>
            <span>Engineering Practice</span>
          </Link>

          <nav
            aria-label="Primary site navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400"
          >
            <a
              href="#stage-3d"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              3D Stage
            </a>
            <a
              href="#architecture"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#scenarios"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Scenarios
            </a>
            <a
              href="#safety"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Privacy
            </a>
          </nav>

          <div className="shrink-0">
            <Link
              to={firebaseUser ? '/dashboard' : '/auth/sign-in'}
              className="studio-cta inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white whitespace-nowrap shrink-0"
            >
              <span>{firebaseUser ? 'Open Workspace' : 'Sign In'}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section: 2-Column Split with items-stretch + Full-Width KPI Row Below */}
        <section
          ref={heroSectionRef}
          className="mx-auto max-w-6xl px-6 pt-14 pb-16 lg:pt-20 lg:pb-20"
        >
          <div className="grid gap-10 lg:grid-cols-12 lg:items-stretch">
            {/* Left Copy Column (7 cols) */}
            <div className="lg:col-span-7 flex flex-col justify-between py-2">
              <div>
                <p
                  data-gsap-hero
                  className="font-mono text-xs font-semibold uppercase tracking-widest text-sky-400"
                >
                  Live 10-Seat Engineering Debate Rooms · AI Rubric &amp; Upskill Roadmap
                </p>
                <h1
                  data-gsap-hero
                  className="mt-3 font-display text-[clamp(2.25rem,4vw,3.65rem)] font-bold tracking-tight text-white text-balance leading-[1.08]"
                >
                  Think, explain, question, and defend engineering decisions out loud.
                </h1>
                <p
                  data-gsap-hero
                  className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300"
                >
                  Writing code is only half the job. Join up to 10 developers or CS
                  students in live audio/video rooms to debate rate limiting, load
                  balancing, and incident recovery—with attributed voice-to-text
                  transcription and AI points for questioning back, best clarification,
                  and best technical approach.
                </p>
              </div>

              <div className="mt-8 space-y-6">
                <div
                  data-gsap-hero
                  className="flex flex-wrap items-center gap-4"
                >
                  <Link
                    to={firebaseUser ? '/sessions' : '/auth/sign-in'}
                    className="studio-cta inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white whitespace-nowrap shrink-0"
                  >
                    <span>
                      {firebaseUser
                        ? 'Enter 10-Seat Debate Rooms'
                        : 'Start Practicing Free'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href="#stage-3d"
                    className="studio-panel-interactive inline-flex items-center rounded-xl px-5 py-3.5 text-sm font-medium text-slate-200 hover:text-white whitespace-nowrap shrink-0"
                  >
                    Explore 3D System Stage
                  </a>
                </div>

                {/* Unboxed metadata per Zero-Pill rule */}
                <div
                  data-gsap-hero
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400"
                >
                  <span>Up to 10 seats per room</span>
                  <span aria-hidden="true">·</span>
                  <span>Named voice-to-text transcription</span>
                  <span aria-hidden="true">·</span>
                  <span>Auto-ends &amp; scores when room empties</span>
                </div>
              </div>
            </div>

            {/* Right Visual Showcase Column (5 cols) */}
            <div
              data-gsap-hero
              className="lg:col-span-5 studio-panel relative overflow-hidden rounded-2xl min-h-[390px] flex flex-col justify-end"
            >
              {!heroImgError ? (
                <img
                  src={heroDebateImg}
                  alt="Engineers collaborating around a circular system topology debate table"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgError(true)}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-950" />
              )}

              {/* Measured Scrim for WCAG AA Contrast */}
              <div className="relative z-10 bg-gradient-to-t from-[#06090F] via-[#06090F]/90 to-transparent p-6 pt-28 space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-mono font-semibold uppercase tracking-wider text-sky-400">
                    Live Room Transcript &amp; Turn Queue
                  </span>
                  <span className="font-mono tabular-nums text-slate-300">
                    10-Seat Debate Protocol
                  </span>
                </div>

                <div className="space-y-2.5 border-t border-slate-800/90 pt-3 text-xs">
                  <div className="flex items-center justify-between text-slate-200">
                    <span className="font-semibold">
                      Speaker Turn: Distributed Rate Limiter
                    </span>
                    <span className="font-mono text-amber-300 tabular-nums">
                      +40 Approach Pts
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    &ldquo;If Redis fails open during peak checkout traffic, how do we
                    bound connection pool exhaustion on the primary PostgreSQL
                    shard?&rdquo;
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Intent: Questioning Back · Cross-Questioning Phase</span>
                    <span className="font-mono text-emerald-400 tabular-nums">
                      +35 Question-Back Pts
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Full-Width 4-Column Quantitative Protocol Strip Below Hero Split */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t border-slate-800/70 pt-8">
            <div className="studio-panel rounded-xl p-5">
              <p className="font-mono text-2xl font-bold text-white tabular-nums">
                2–10 Seats
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Structured speaker &amp; listener queue where everyone gets a turn to
                answer or challenge peers.
              </p>
            </div>
            <div className="studio-panel rounded-xl p-5">
              <p className="font-mono text-2xl font-bold text-sky-400 tabular-nums">
                4 Point Pillars
              </p>
              <p className="mt-1 text-xs text-slate-400">
                AI awards points for Best Approach, Questioning Back, Clarification,
                and Trade-Off Defense.
              </p>
            </div>
            <div className="studio-panel rounded-xl p-5">
              <p className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                100% Real Data
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Zero dummy leaderboard profiles—all standings come from verified
                Firestore transcripts &amp; AI reports.
              </p>
            </div>
            <div className="studio-panel rounded-xl p-5">
              <p className="font-mono text-2xl font-bold text-amber-300 tabular-nums">
                6 Competencies
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Continuous per-user monitoring builds a personalized engineering
                upskill roadmap over time.
              </p>
            </div>
          </div>
        </section>

        {/* Scroll-Choreographed 3D Spatial Architecture & Debate Stage Section */}
        <section
          id="stage-3d"
          className="border-t border-slate-800/70 bg-[#080C16]/80 py-20"
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-sky-400">
                Interactive 3D Spatial Simulation · Scroll or Select a Chapter
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl text-balance">
                How a 10-seat engineering room transforms spoken debate into verified skill
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Scroll through the four architectural stages below—or use the 3D
                bottom control dock—to inspect the 10-seat speaker ring, distributed
                rate-limiting cluster, and AI evidence verification core.
              </p>
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-start">
              {/* Sticky 3D Viewport (7 cols) */}
              <div className="lg:col-span-7 lg:sticky lg:top-24">
                <ThreeArchitectureStage
                  activePreset={active3DPreset}
                  onPresetChange={setActive3DPreset}
                />
              </div>

              {/* Scroll-Synced Narrative Chapters (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                {SCROLL_STAGE_CHAPTERS.map((chap, idx) => {
                  const isActive = active3DPreset === chap.preset;
                  return (
                    <div
                      key={chap.preset}
                      ref={(el) => {
                        chapterRefs.current[idx] = el;
                      }}
                      data-stage-preset={chap.preset}
                      onClick={() => setActive3DPreset(chap.preset)}
                      className={`cursor-pointer rounded-2xl p-6 transition-all ${
                        isActive
                          ? 'studio-panel border-sky-500/60 shadow-lg shadow-sky-500/10'
                          : 'border border-slate-800/80 bg-[#090E1A]/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-sky-400 tabular-nums">
                          {chap.num} {chap.subtitle}
                        </span>
                        <span className="font-mono text-slate-400 tabular-nums">
                          {isActive ? 'Active 3D View' : 'Inspect in 3D'}
                        </span>
                      </div>
                      <h3 className="mt-2 font-display text-lg font-semibold text-white">
                        {chap.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-300">
                        {chap.description}
                      </p>
                      <p className="mt-4 border-t border-slate-800/80 pt-3 font-mono text-xs text-amber-300 tabular-nums">
                        {chap.metric}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Asymmetric Bento Grid of Core Platform Modules */}
        <section id="architecture" className="border-t border-slate-800/70 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-sky-400">
                Production Engineering Architecture
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl text-balance">
                Four integrated environments for complete engineering mastery
              </h2>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {/* Bento Card 1: 2 cols wide */}
              <article className="lg:col-span-2 studio-panel relative overflow-hidden rounded-2xl min-h-[340px] flex flex-col justify-end">
                {!bentoImgErrors.topology ? (
                  <img
                    src={labTopologyImg}
                    alt="Isometric high-availability cloud load balancer and distributed database cluster"
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setBentoImgErrors((p) => ({ ...p, topology: true }))
                    }
                    className="absolute inset-0 h-full w-full object-cover opacity-65"
                  />
                ) : null}
                <div className="relative z-10 bg-gradient-to-t from-[#06090F] via-[#06090F]/85 to-transparent p-8 pt-24">
                  <p className="font-mono text-xs text-sky-400 tabular-nums">
                    01. Collaborative System Topology &amp; Code Review Labs
                  </p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-white">
                    Co-design rate limiters, load balancers, and database shards in real time
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                    Inside every discussion room, participants share a live System
                    Topology Lab (with both 2D and interactive 3D views) and a
                    Line-by-Line Code Review Annotation Lab to ground debates in
                    concrete architecture artifacts.
                  </p>
                </div>
              </article>

              {/* Bento Card 2: 1 col wide */}
              <article className="studio-panel relative overflow-hidden rounded-2xl min-h-[340px] flex flex-col justify-end">
                {!bentoImgErrors.arena ? (
                  <img
                    src={arenaStudioImg}
                    alt="Executive technical interview studio with system architecture monitors"
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setBentoImgErrors((p) => ({ ...p, arena: true }))
                    }
                    className="absolute inset-0 h-full w-full object-cover opacity-65"
                  />
                ) : null}
                <div className="relative z-10 bg-gradient-to-t from-[#06090F] via-[#06090F]/90 to-transparent p-6 pt-20">
                  <p className="font-mono text-xs text-sky-400 tabular-nums">
                    02. 24/7 AI Practice Arena
                  </p>
                  <h3 className="mt-2 font-display text-lg font-semibold text-white">
                    Solo sparring with explicit [AI] personas
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    Practise on demand with an AI Technical Mentor, Mock Interviewer,
                    Socratic Challenger, or Multi-Perspective Engineering Panel before
                    entering live peer rooms.
                  </p>
                </div>
              </article>

              {/* Bento Card 3: 1 col wide */}
              <article className="studio-panel relative overflow-hidden rounded-2xl min-h-[300px] flex flex-col justify-end">
                {!bentoImgErrors.passport ? (
                  <img
                    src={passportEmblemImg}
                    alt="Precision-machined brushed gold and titanium geometric emblem"
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setBentoImgErrors((p) => ({ ...p, passport: true }))
                    }
                    className="absolute inset-0 h-full w-full object-cover opacity-60"
                  />
                ) : null}
                <div className="relative z-10 bg-gradient-to-t from-[#06090F] via-[#06090F]/90 to-transparent p-6 pt-16">
                  <p className="font-mono text-xs text-amber-300 tabular-nums">
                    03. Developer Skill Passport
                  </p>
                  <h3 className="mt-2 font-display text-lg font-semibold text-white">
                    Multi-session verified competency portfolio
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    Consistent mastery requires repeated evidence across multiple
                    scenarios—never granted from a single lucky session.
                  </p>
                </div>
              </article>

              {/* Bento Card 4: 2 cols wide */}
              <article className="lg:col-span-2 studio-panel rounded-2xl p-8 flex flex-col justify-between">
                <div>
                  <p className="font-mono text-xs text-emerald-400 tabular-nums">
                    04. Live Leaderboard &amp; Personalized Upskill Roadmap
                  </p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-white">
                    AI review points for questioning back, best clarification, and technical defense
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                    Instead of rewarding who talks the longest, our evaluation engine
                    scores the sharpness of your follow-up questions, the clarity of
                    your problem framing, and your ability to defend trade-offs under
                    peer questioning.
                  </p>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-4 border-t border-slate-800/80 pt-5 text-xs">
                  <div>
                    <p className="font-mono font-semibold text-sky-400">
                      Best Approach
                    </p>
                    <p className="mt-1 text-slate-400">
                      Concrete architecture &amp; root-cause design
                    </p>
                  </div>
                  <div>
                    <p className="font-mono font-semibold text-emerald-400">
                      Questioning Back
                    </p>
                    <p className="mt-1 text-slate-400">
                      Probing peer failure modes &amp; bottlenecks
                    </p>
                  </div>
                  <div>
                    <p className="font-mono font-semibold text-violet-400">
                      Clarification
                    </p>
                    <p className="mt-1 text-slate-400">
                      Unpacking SLAs, edge cases &amp; constraints
                    </p>
                  </div>
                  <div>
                    <p className="font-mono font-semibold text-amber-300">
                      Trade-Off Defense
                    </p>
                    <p className="mt-1 text-slate-400">
                      Justifying why one path beats alternatives
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Curated Pilot Scenarios Library */}
        <section
          id="scenarios"
          className="border-t border-slate-800/70 bg-[#080C16]/80 py-20"
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-sky-400">
                  Pre-Decided System Engineering Topics
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Curated scenario library
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Every prompt has multiple defensible approaches and realistic constraints. Preview any brief below.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-[#0C121E] p-1">
                {ROOM_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedRoomType(opt.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      selectedRoomType === opt.value
                        ? 'studio-cta text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visibleScenarios.map((scenario) => (
                <article
                  key={scenario.id}
                  className="studio-panel-interactive flex flex-col justify-between rounded-2xl p-6"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="text-sky-400 font-medium">
                        {scenario.domainTitle}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{scenario.difficulty}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {scenario.estimatedMinutes}m
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-lg font-semibold text-white">
                      {scenario.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {scenario.context}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-800/80 pt-4 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewScenario(scenario)}
                      className="font-medium text-slate-300 hover:text-white whitespace-nowrap shrink-0"
                    >
                      Preview Brief &amp; Artifact
                    </button>
                    <Link
                      to={
                        firebaseUser
                          ? `/scenarios/${scenario.slug}`
                          : '/auth/sign-in'
                      }
                      className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:text-sky-300 whitespace-nowrap shrink-0"
                    >
                      <span>{firebaseUser ? 'Open Brief' : 'Sign In to Join'}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Privacy & Formative Assessment Guarantee */}
        <section id="safety" className="border-t border-slate-800/70 py-16">
          <div className="mx-auto max-w-6xl px-6">
            <div className="studio-panel flex flex-col gap-6 rounded-2xl p-8 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Evidence-verified formative feedback</span>
                </div>
                <h2 className="mt-2 font-display text-xl font-semibold text-white">
                  Every AI evaluation cites exact room transcript excerpts and automatically ends empty rooms.
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Reports never invent quotes, identify insufficient evidence honestly, and update your personalized upskill roadmap after every debate.
                </p>
              </div>
              <Link
                to={firebaseUser ? '/dashboard' : '/auth/sign-in'}
                className="studio-cta inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white whitespace-nowrap shrink-0"
              >
                {firebaseUser ? 'Enter Workspace' : 'Create Free Account'}
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Scenario Brief & Sample Report Preview Modal */}
      {previewScenario ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${previewScenario.title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="studio-panel w-full max-w-2xl rounded-2xl p-6 space-y-5 my-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <p className="text-xs text-slate-400">
                  {previewScenario.domainTitle} · {previewScenario.difficulty} ·{' '}
                  {previewScenario.estimatedMinutes} min
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold text-white">
                  {previewScenario.title}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close scenario preview"
                onClick={() => setPreviewScenario(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm max-h-[65vh] overflow-y-auto pr-1">
              <div>
                <p className="text-xs font-medium text-sky-400">Context</p>
                <p className="mt-1 text-slate-300 leading-relaxed">
                  {previewScenario.context}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-[#080C16] p-3.5">
                <p className="text-xs font-medium text-sky-400">
                  Discussion Prompt
                </p>
                <p className="mt-1 text-slate-200 leading-relaxed">
                  {previewScenario.prompt}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400">
                  Engineering Constraints
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-slate-300">
                  {previewScenario.constraints.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              {previewScenario.codeArtifact ? (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Code2 className="h-3.5 w-3.5 text-sky-400" />
                    <span>Reference Code / Telemetry Artifact</span>
                  </div>
                  <pre className="mt-1.5 overflow-x-auto rounded-xl border border-slate-800 bg-[#080C16] p-3 font-mono text-[11px] leading-relaxed text-slate-300">
                    {previewScenario.codeArtifact}
                  </pre>
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-800 bg-[#080C16] p-3.5 text-xs space-y-1.5">
                <p className="font-medium text-emerald-400">
                  Sample Verified-Evidence AI Feedback Excerpt
                </p>
                <div className="flex items-start gap-2 text-slate-300">
                  <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                  <span className="italic">
                    &ldquo;Strong signal: You identified the trade-off between bounded retries and downstream connection pool exhaustion before proposing a cache layer.&rdquo;
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setPreviewScenario(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
              <Link
                to={
                  firebaseUser
                    ? `/scenarios/${previewScenario.slug}`
                    : '/auth/sign-in'
                }
                className="studio-cta inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
              >
                <span>
                  {firebaseUser
                    ? 'Open Scenario in Workspace'
                    : 'Sign In to Practice'}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="border-t border-slate-800/70 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Engineering Practice Platform — Structured Technical Learning
          </span>
          <span>
            Reports are AI-generated formative feedback, not employment certifications.
          </span>
        </div>
      </footer>
    </div>
  );
}
