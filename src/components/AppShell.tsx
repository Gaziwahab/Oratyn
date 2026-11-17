import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  Box,
  Compass,
  History,
  Home,
  LineChart,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { Link, useRouter } from '../lib/router';
import { PILOT_SCENARIOS } from '../../packages/domain/src/catalogue';

interface NavItem {
  label: string;
  to: string;
  icon: typeof Home;
  accent?: string;
}

const LEARNER_NAV: NavItem[] = [
  { label: 'Command Studio', to: '/dashboard', icon: Home },
  { label: '10-Seat Rooms', to: '/sessions', icon: MessageSquare, accent: 'Live' },
  { label: 'My Sessions', to: '/my-sessions', icon: History },
  { label: 'Leaderboard', to: '/leaderboard', icon: Trophy },
  { label: 'AI Arena', to: '/arena', icon: Bot, accent: '[AI]' },
  { label: 'Topic Library', to: '/explore', icon: Compass },
  { label: 'Upskill Roadmap', to: '/progress', icon: LineChart },
  { label: 'Skill Passport', to: '/passport', icon: Award },
  { label: 'Profile', to: '/profile', icon: User },
];

export function WorkspaceShell({
  title,
  breadcrumb,
  action,
  children,
}: {
  title: string;
  breadcrumb?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { pathname, navigate } = useRouter();
  const { profile, firebaseUser, isAdmin, signOutUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  const navItems: NavItem[] = isAdmin
    ? [...LEARNER_NAV, { label: 'Admin Console', to: '/admin', icon: ShieldAlert }]
    : LEARNER_NAV;

  const isActive = (to: string) =>
    pathname === to || (to !== '/dashboard' && pathname.startsWith(to));

  const handleSignOut = async () => {
    await signOutUser();
    navigate('/');
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      } else if (e.key === 'Escape' && commandOpen) {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandOpen]);

  const commandItems = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    const pages = navItems.map((item) => ({
      id: `nav_${item.to}`,
      category: 'Workspace Navigation',
      title: item.label,
      subtitle: `Navigate to ${item.to}`,
      to: item.to,
    }));
    const scenarios = PILOT_SCENARIOS.map((sc) => ({
      id: `sc_${sc.id}`,
      category: `Scenario · ${sc.roomType.replace(/_/g, ' ')}`,
      title: sc.title,
      subtitle: `${sc.domainTitle} · ${sc.difficulty} · ${sc.estimatedMinutes}m`,
      to: `/scenarios/${sc.slug}`,
    }));
    const all = [...pages, ...scenarios];
    if (!q) return all.slice(0, 10);
    return all
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [commandQuery, navItems]);

  return (
    <div className="min-h-screen text-slate-100 flex">
      {/* Desktop Obsidian & Titanium Sidebar */}
      <aside className="hidden lg:flex lg:w-68 lg:flex-col lg:border-r lg:border-slate-800/70 bg-[#070B14]/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between border-b border-slate-800/70 px-6">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 font-display text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20">
              <Box className="h-4 w-4" />
            </span>
            <span>Engineering Practice</span>
          </Link>
        </div>

        <div className="px-3.5 pt-3.5">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-800/90 bg-[#0B101D] px-3.5 py-2.5 text-xs text-slate-400 hover:border-sky-500/40 hover:text-slate-200 transition-all shadow-inner"
          >
            <span className="inline-flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-sky-400" />
              <span>Jump to room or topic...</span>
            </span>
            <kbd className="rounded border border-slate-700/80 bg-[#131C2E] px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
              ⌘K
            </kbd>
          </button>
        </div>

        <nav
          aria-label="Primary workspace navigation"
          className="flex-1 space-y-1 px-3.5 py-3.5"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                  active
                    ? 'bg-gradient-to-r from-sky-500/20 via-blue-600/15 to-transparent text-white border border-sky-500/35 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/45 hover:text-slate-100 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-sky-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {item.accent ? (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-sky-400">
                    {item.accent}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800/70 p-4 space-y-2.5 bg-[#050810]/60">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 font-mono text-xs font-bold text-sky-300">
              {(profile?.displayName ?? firebaseUser?.displayName ?? 'E')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {profile?.displayName ?? firebaseUser?.displayName ?? 'Engineer'}
              </p>
              <p className="truncate font-mono text-[11px] text-sky-400 capitalize">
                {profile?.experienceBand
                  ? `${profile.experienceBand.replace(/_/g, ' ')} tier`
                  : 'Active Member'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRulesModalOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg border border-slate-800/90 bg-[#0B101D] px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white transition-colors whitespace-nowrap"
          >
            <BookOpen className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            <span>Community Rules &amp; Norms</span>
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg border border-slate-800/90 bg-[#0B101D] px-3 py-2 text-xs font-medium text-slate-400 hover:border-slate-700 hover:text-white transition-colors whitespace-nowrap"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-800/70 bg-[#06090F]/85 backdrop-blur-xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-lg border border-slate-800 p-2 text-slate-300 hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              {breadcrumb ? (
                <p className="truncate font-mono text-[11px] uppercase tracking-wider text-sky-400">
                  {breadcrumb}
                </p>
              ) : null}
              <h1 className="truncate font-display text-lg font-bold tracking-tight text-white">
                {title}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Quick search scenarios and rooms"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0C121E] px-3 py-1.5 text-xs text-slate-300 hover:border-sky-500/40 hover:text-white whitespace-nowrap shrink-0"
            >
              <Search className="h-3.5 w-3.5 text-sky-400" />
              <span>Quick Jump</span>
              <kbd className="ml-1 font-mono text-[10px] text-slate-400">⌘K</kbd>
            </button>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Quick Jump Command Palette Modal (Cmd/Ctrl + K) */}
      {commandOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quick jump command palette"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-20"
          onClick={() => setCommandOpen(false)}
        >
          <div
            className="studio-panel w-full max-w-xl rounded-2xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <Search className="h-4 w-4 text-sky-400 shrink-0" />
              <input
                type="search"
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Search engineering topics, debate rooms, or workspace pages..."
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 max-h-80 overflow-y-auto divide-y divide-slate-800/60">
              {commandItems.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  No matching topics or pages found.
                </p>
              ) : (
                commandItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCommandOpen(false);
                      setCommandQuery('');
                      navigate(item.to);
                    }}
                    className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-sky-400">
                        {item.category}
                      </p>
                      <p className="truncate text-sm font-medium text-white">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {item.subtitle}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex w-72 flex-col bg-[#070B14] border-r border-slate-800 p-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <span className="font-display text-base font-bold text-white">
                Engineering Practice
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-4 flex-1 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      active
                        ? 'bg-sky-500/15 text-sky-400'
                        : 'text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setRulesModalOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-800 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                <BookOpen className="h-4 w-4 text-sky-400" />
                <span>Community Rules &amp; Norms</span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-800 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Community Rules & Engineering Norms Modal */}
      {rulesModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="community-rules-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="studio-panel relative w-full max-w-2xl rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h2
                  id="community-rules-title"
                  className="font-display text-lg font-semibold text-white"
                >
                  Engineering Discussion Norms &amp; Safety Rules
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRulesModalOpen(false)}
                aria-label="Close community rules"
                className="rounded-lg border border-slate-800 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-slate-300">
              <div>
                <h3 className="font-semibold text-white text-sm">
                  1. Challenge Technical Ideas, Never People
                </h3>
                <p className="mt-1 text-slate-400">
                  Critique architecture trade-offs, failure modes, and assumptions with concrete evidence. Personal attacks, harassment, demeaning remarks, or discrimination are strictly prohibited.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white text-sm">
                  2. Fair Turn-Taking &amp; Non-Punitive Passing
                </h3>
                <p className="mt-1 text-slate-400">
                  Every participant can pass a turn without penalty. Message volume and speaking duration are never scored as a proxy for engineering skill.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white text-sm">
                  3. Privacy, Confidentiality &amp; AI Disclosure
                </h3>
                <p className="mt-1 text-slate-400">
                  Never pressure peers to disclose real names, employers, or private credentials, and do not paste confidential production secrets. All AI Arena personas carry explicit{' '}
                  <span className="font-mono text-sky-300">[AI]</span> disclosure badges, and post-session AI evaluations are private to each learner by default.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-white text-sm">
                  4. Reporting, Blocking &amp; Human Moderation
                </h3>
                <p className="mt-1 text-slate-400">
                  Use the flag or block controls on any room message to report misconduct or mute a peer immediately. AI outputs are never used as the sole basis for punitive account actions.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
              <Link
                to="/settings"
                onClick={() => setRulesModalOpen(false)}
                className="text-xs font-medium text-sky-400 hover:text-sky-300"
              >
                Manage Privacy &amp; Blocked Users →
              </Link>
              <button
                type="button"
                onClick={() => setRulesModalOpen(false)}
                className="studio-cta rounded-lg px-4 py-2 text-xs font-semibold text-white"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
