import { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { Link, useRouter } from '../lib/router';

export function SignInPage() {
  const { signInWithGoogle, firebaseUser, authError } = useAuth();
  const { navigate } = useRouter();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (firebaseUser) {
      navigate('/dashboard');
    }
  }, [firebaseUser, navigate]);

  if (firebaseUser) {
    return null;
  }

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch {
      // authError state is rendered cleanly below
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to overview</span>
        </Link>

        <div className="mt-6 rounded-xl border border-slate-800 bg-[#111827] p-8">
          <p className="text-xs font-medium text-blue-400">Account Access</p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-white">
            Sign in to Engineering Practice
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Authenticate with your Google account via Firebase Authentication. Your email is never displayed to peers in discussion rooms.
          </p>

          {authError ? (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
            >
              {authError}
            </div>
          ) : null}

          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogleSignIn}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
          >
            <span>{submitting ? 'Signing in...' : 'Continue with Google'}</span>
          </button>

          <div className="mt-6 border-t border-slate-800 pt-5 flex items-start gap-3 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <p className="leading-relaxed">
              Private profiles, room messages, and AI evaluation reports are protected by Firebase Authentication and Firestore Security Rules.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
