import { useState, type FormEvent } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { useRouter } from '../lib/router';
import {
  DIFFICULTIES,
  EXPERIENCE_BANDS,
  LEARNING_FOCUS_AREAS,
  type Difficulty,
  type ExperienceBand,
  type LearningFocusArea,
} from '../../packages/domain/src/types';

const INTEREST_OPTIONS = [
  'System Design',
  'Backend & APIs',
  'Databases',
  'Code Review',
  'OS & Concurrency',
  'Data Structures',
  'Security',
  'Testing & Debugging',
];

export function OnboardingPage() {
  const { firebaseUser, profile, completeOnboarding } = useAuth();
  const { navigate } = useRouter();

  const [displayName, setDisplayName] = useState(
    profile?.displayName ?? firebaseUser?.displayName ?? ''
  );
  const [experienceBand, setExperienceBand] = useState<ExperienceBand>(
    profile?.experienceBand ?? 'student'
  );
  const [goals, setGoals] = useState<LearningFocusArea[]>([
    'problem_solving',
    'explanation_clarity',
  ]);
  const [interests, setInterests] = useState<string[]>([
    'System Design',
    'Backend & APIs',
  ]);
  const [preferredDifficulty, setPreferredDifficulty] =
    useState<Difficulty>('beginner');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleGoal = (goal: LearningFocusArea) => {
    setGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (displayName.trim().length < 2) {
      setError('Please enter a display name (at least 2 characters).');
      return;
    }
    if (goals.length === 0) {
      setError('Please select at least one skill you want to practise.');
      return;
    }
    if (interests.length === 0) {
      setError('Please choose at least one engineering topic.');
      return;
    }

    setSaving(true);
    try {
      await completeOnboarding({
        displayName: displayName.trim(),
        experienceBand,
        goals,
        interests,
        preferredDifficulty,
        notificationsEnabled,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save onboarding details.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-800 bg-[#111827] p-6 sm:p-8">
        <p className="text-xs font-medium text-blue-400">Quick Setup</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-white">
          Personalize your practice workspace
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          No lengthy diagnostic test required. Tell us your experience level and what you want to practise so we can suggest relevant rooms.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200"
            >
              {error}
            </div>
          ) : null}

          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-slate-200"
            >
              Room Display Name
            </label>
            <p className="mt-0.5 text-xs text-slate-400">
              Shown to peers inside rooms. You do not need to use your real name.
            </p>
            <input
              id="displayName"
              type="text"
              required
              minLength={2}
              maxLength={60}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex_Dev"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="experienceBand"
                className="block text-sm font-medium text-slate-200"
              >
                Experience Level
              </label>
              <select
                id="experienceBand"
                value={experienceBand}
                onChange={(e) => setExperienceBand(e.target.value as ExperienceBand)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3.5 py-2.5 text-sm text-white capitalize"
              >
                {EXPERIENCE_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {band.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="preferredDifficulty"
                className="block text-sm font-medium text-slate-200"
              >
                Preferred Scenario Difficulty
              </label>
              <select
                id="preferredDifficulty"
                value={preferredDifficulty}
                onChange={(e) => setPreferredDifficulty(e.target.value as Difficulty)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3.5 py-2.5 text-sm text-white capitalize"
              >
                {DIFFICULTIES.map((diff) => (
                  <option key={diff} value={diff}>
                    {diff}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-200">
              Skills you want to strengthen
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {LEARNING_FOCUS_AREAS.map((goal) => {
                const selected = goals.includes(goal);
                return (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => toggleGoal(goal)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      selected
                        ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                        : 'border-slate-700 bg-[#0B0F17] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {goal.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-200">
              Topic Interests
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((topic) => {
                const selected = interests.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleInterest(topic)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                        : 'border-slate-700 bg-[#0B0F17] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-[#0B0F17] text-blue-600"
            />
            <span>Notify me when post-session evaluation reports are ready</span>
          </label>

          <div className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4 text-xs text-slate-400 leading-relaxed">
            <strong className="text-slate-200">How AI feedback works:</strong> After a completed discussion, AI generates a private report citing exact quotes from your messages. One session never creates a permanent skill label or public ranking.
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving workspace preferences...' : 'Enter Practice Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
