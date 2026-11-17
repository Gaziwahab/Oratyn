/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, type ReactNode } from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { Link, RouterProvider, useRouter } from './lib/router';
import { AdminPage } from './pages/AdminPage';
import { ArenaHubPage, ArenaRoomPage } from './pages/ArenaPage';
import { DashboardPage } from './pages/DashboardPage';
import { EvaluationReportPage } from './pages/EvaluationReportPage';
import {
  ExplorePage,
  ScenarioDetailPage,
  TopicDetailPage,
} from './pages/ExplorePage';
import { LandingPage } from './pages/LandingPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { MySessionsPage } from './pages/MySessionsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PassportPage } from './pages/PassportPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProgressPage } from './pages/ProgressPage';
import { SessionRoomPage } from './pages/SessionRoomPage';
import { SessionsListPage } from './pages/SessionsListPage';
import { SignInPage } from './pages/SignInPage';

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-[#111827] p-6 text-center">
        <p className="font-display text-sm font-semibold text-white">
          Engineering Practice
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Restoring authenticated workspace...
        </p>
      </div>
    </div>
  );
}

function ProtectedRoute({
  requireOnboarding = true,
  children,
}: {
  requireOnboarding?: boolean;
  children: ReactNode;
}) {
  const { firebaseUser, authReady, profile } = useAuth();
  const { pathname, navigate } = useRouter();

  useEffect(() => {
    if (!authReady) return;
    if (!firebaseUser) {
      navigate('/auth/sign-in');
      return;
    }
    if (
      requireOnboarding &&
      (!profile || !profile.onboardingCompleted) &&
      pathname !== '/onboarding'
    ) {
      navigate('/onboarding');
    }
  }, [authReady, firebaseUser, profile, requireOnboarding, pathname, navigate]);

  if (!authReady) {
    return <AuthLoadingScreen />;
  }

  if (!firebaseUser) {
    return <SignInPage />;
  }

  if (
    requireOnboarding &&
    (!profile || !profile.onboardingCompleted) &&
    pathname !== '/onboarding'
  ) {
    return <OnboardingPage />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { pathname } = useRouter();
  const { firebaseUser } = useAuth();
  const cleanPath =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (cleanPath === '/') {
    return <LandingPage />;
  }

  if (cleanPath === '/auth/sign-in' || cleanPath === '/auth/sign-up') {
    return <SignInPage />;
  }

  if (cleanPath === '/onboarding') {
    return (
      <ProtectedRoute requireOnboarding={false}>
        <OnboardingPage />
      </ProtectedRoute>
    );
  }

  if (cleanPath === '/dashboard') {
    return (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    );
  }

  if (cleanPath === '/explore') {
    return (
      <ProtectedRoute>
        <ExplorePage />
      </ProtectedRoute>
    );
  }

  const topicMatch = cleanPath.match(/^\/topics\/([a-zA-Z0-9_-]+)$/);
  if (topicMatch) {
    return (
      <ProtectedRoute>
        <TopicDetailPage slug={topicMatch[1]} />
      </ProtectedRoute>
    );
  }

  const scenarioMatch = cleanPath.match(/^\/scenarios\/([a-zA-Z0-9_-]+)$/);
  if (scenarioMatch) {
    return (
      <ProtectedRoute>
        <ScenarioDetailPage slug={scenarioMatch[1]} />
      </ProtectedRoute>
    );
  }

  if (cleanPath === '/sessions') {
    return (
      <ProtectedRoute>
        <SessionsListPage />
      </ProtectedRoute>
    );
  }

  if (cleanPath === '/my-sessions') {
    return (
      <ProtectedRoute>
        <MySessionsPage />
      </ProtectedRoute>
    );
  }

  if (cleanPath === '/leaderboard') {
    return (
      <ProtectedRoute>
        <LeaderboardPage />
      </ProtectedRoute>
    );
  }

  const reportMatch = cleanPath.match(/^\/sessions\/([a-zA-Z0-9_-]+)\/report$/);
  if (reportMatch) {
    return (
      <ProtectedRoute>
        <EvaluationReportPage sessionId={reportMatch[1]} />
      </ProtectedRoute>
    );
  }

  const sessionMatch = cleanPath.match(/^\/sessions\/([a-zA-Z0-9_-]+)$/);
  if (sessionMatch) {
    return (
      <ProtectedRoute>
        <SessionRoomPage sessionId={sessionMatch[1]} />
      </ProtectedRoute>
    );
  }

  if (cleanPath === '/arena') {
    return (
      <ProtectedRoute>
        <ArenaHubPage />
      </ProtectedRoute>
    );
  }

  const arenaMatch = cleanPath.match(/^\/arena\/([a-zA-Z0-9_-]+)$/);
  if (arenaMatch) {
    return (
      <ProtectedRoute>
        <ArenaRoomPage arenaId={arenaMatch[1]} />
      </ProtectedRoute>
    );
  }

  if (cleanPath === '/progress') {
    return (
      <ProtectedRoute>
        <ProgressPage />
      </ProtectedRoute>
    );
  }

  if (cleanPath === '/passport') {
    return (
      <ProtectedRoute>
        <PassportPage />
      </ProtectedRoute>
    );
  }

  const passportMatch = cleanPath.match(/^\/passport\/([a-zA-Z0-9_-]+)$/);
  if (passportMatch) {
    return (
      <ProtectedRoute>
        <PassportPage viewedUid={passportMatch[1]} />
      </ProtectedRoute>
    );
  }

  if (cleanPath === '/profile' || cleanPath === '/settings') {
    return (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    );
  }

  if (cleanPath === '/admin') {
    return (
      <ProtectedRoute>
        <AdminPage initialSection="overview" />
      </ProtectedRoute>
    );
  }

  if (cleanPath === '/admin/content') {
    return (
      <ProtectedRoute>
        <AdminPage initialSection="content" />
      </ProtectedRoute>
    );
  }

  if (cleanPath === '/admin/sessions') {
    return (
      <ProtectedRoute>
        <AdminPage initialSection="sessions" />
      </ProtectedRoute>
    );
  }

  if (cleanPath === '/admin/moderation') {
    return (
      <ProtectedRoute>
        <AdminPage initialSection="moderation" />
      </ProtectedRoute>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-slate-800 bg-[#111827] p-8 text-center">
        <p className="font-mono text-xs text-blue-400">404</p>
        <h1 className="mt-2 font-display text-xl font-semibold text-white">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          The requested workspace route does not exist.
        </p>
        <Link
          to={firebaseUser ? '/dashboard' : '/'}
          className="mt-5 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          {firebaseUser ? 'Return to Dashboard' : 'Return Home'}
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </RouterProvider>
  );
}
