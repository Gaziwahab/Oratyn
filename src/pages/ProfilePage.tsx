import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Ban,
  Download,
  Lock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { WorkspaceShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import {
  listBlockedUsers,
  listCompetencyObservations,
  listUserArenaSessions,
  listUserEvaluations,
  unblockPeerUser,
} from '../features/sessions/sessionService';
import type { ProfileVisibility } from '../../packages/domain/src/types';
import { Link } from '../lib/router';

export function ProfilePage() {
  const {
    firebaseUser,
    profile,
    publicProfile,
    preferences,
    savePublicProfile,
    requestAccountDeletion,
  } = useAuth();

  const [displayName, setDisplayName] = useState(
    publicProfile?.displayName ?? profile?.displayName ?? ''
  );
  const [bio, setBio] = useState(publicProfile?.bio ?? '');
  const [interestsText, setInterestsText] = useState(
    (publicProfile?.interests ?? preferences?.interests ?? []).join(', ')
  );
  const [visibility, setVisibility] = useState<ProfileVisibility>(
    publicProfile?.visibility ?? 'private'
  );
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);

  useEffect(() => {
    setDisplayName(publicProfile?.displayName ?? profile?.displayName ?? '');
    setBio(publicProfile?.bio ?? '');
    setInterestsText(
      (publicProfile?.interests ?? preferences?.interests ?? []).join(', ')
    );
    setVisibility(publicProfile?.visibility ?? 'private');
  }, [publicProfile, profile, preferences]);

  useEffect(() => {
    if (!firebaseUser) return;
    setLoadingBlocks(true);
    listBlockedUsers(firebaseUser.uid)
      .then(setBlockedUids)
      .catch(() => {})
      .finally(() => setLoadingBlocks(false));
  }, [firebaseUser]);

  const handleSavePublicProfile = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveMessage(null);
    setSaving(true);
    try {
      const interests = interestsText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length >= 1)
        .slice(0, 10);

      await savePublicProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        interests,
        visibility,
      });
      setSaveMessage('Public profile preferences updated.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save public profile.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (blockedUid: string) => {
    if (!firebaseUser) return;
    try {
      await unblockPeerUser(firebaseUser.uid, blockedUid);
      setBlockedUids((prev) => prev.filter((id) => id !== blockedUid));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to unblock user.');
    }
  };

  const handleExportMyData = async () => {
    if (!firebaseUser) return;
    setExporting(true);
    setError(null);
    try {
      const [evaluations, observations, arenaSessions] = await Promise.all([
        listUserEvaluations(firebaseUser.uid),
        listCompetencyObservations(firebaseUser.uid),
        listUserArenaSessions(firebaseUser.uid),
      ]);

      const exportBundle = {
        exportedAtIso: new Date().toISOString(),
        account: {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          profile,
          preferences,
          publicProfile,
        },
        evaluations,
        competencyObservations: observations,
        arenaSessions,
        blockedUids,
      };

      const blob = new Blob([JSON.stringify(exportBundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `engineering-practice-export-${firebaseUser.uid.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSaveMessage('Your complete account & practice data JSON export has downloaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export data.');
    } finally {
      setExporting(false);
    }
  };

  const handleRequestDeletion = async () => {
    setDeleting(true);
    setError(null);
    try {
      await requestAccountDeletion();
      setConfirmDelete(false);
      setSaveMessage(
        'Your account status has been marked as pending_deletion for data governance processing.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit account deletion request.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <WorkspaceShell
      title="Profile & Privacy Controls"
      breadcrumb="Account & Data Governance"
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={handleExportMyData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5 text-blue-400" />
            <span>{exporting ? 'Exporting...' : 'Export My Data (JSON)'}</span>
          </button>
          <Link
            to="/onboarding"
            className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 whitespace-nowrap"
          >
            Edit Learning Preferences
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {error}
          </div>
        ) : null}

        {saveMessage ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {saveMessage}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Private Account Summary */}
          <section className="rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <Lock className="h-4 w-4" />
              <h2 className="font-display text-base font-semibold text-white">
                Private Account Record
              </h2>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Only visible to you. Your email address and private evaluation reports are never exposed to room peers.
            </p>
            <dl className="space-y-3 border-t border-slate-800 pt-4 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Authenticated Email</dt>
                <dd className="mt-0.5 text-slate-200">
                  {firebaseUser?.email ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Room Display Name</dt>
                <dd className="mt-0.5 text-slate-200">
                  {profile?.displayName ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Experience Band</dt>
                <dd className="mt-0.5 capitalize text-slate-200">
                  {profile?.experienceBand?.replace(/_/g, ' ') ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Account Status</dt>
                <dd className="mt-0.5 capitalize text-emerald-400">
                  {profile?.accountStatus?.replace(/_/g, ' ') ?? 'active'}
                </dd>
              </div>
            </dl>
          </section>

          {/* Opt-in Public Profile */}
          <section className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#111827] p-6">
            <div className="flex items-center gap-2 text-blue-400">
              <UserCheck className="h-4 w-4" />
              <h2 className="font-display text-base font-semibold text-white">
                Optional Community Profile
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Defaults to private. Switch to &ldquo;community&rdquo; only if you want peers in discussion rooms to view your short engineering bio and topic interests.
            </p>

            <form onSubmit={handleSavePublicProfile} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="pubName"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Public Display Name
                  </label>
                  <input
                    id="pubName"
                    type="text"
                    required
                    minLength={2}
                    maxLength={60}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pubVis"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Profile Visibility
                  </label>
                  <select
                    id="pubVis"
                    value={visibility}
                    onChange={(e) =>
                      setVisibility(e.target.value as ProfileVisibility)
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white"
                  >
                    <option value="private">Private (only you)</option>
                    <option value="community">
                      Community (visible to signed-in peers)
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="pubBio"
                  className="block text-xs font-medium text-slate-300"
                >
                  Short Engineering Bio (max 280 characters)
                </label>
                <textarea
                  id="pubBio"
                  rows={3}
                  maxLength={280}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="What systems or problems are you currently exploring?"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0F17] p-3 text-sm text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label
                  htmlFor="pubInterests"
                  className="block text-xs font-medium text-slate-300"
                >
                  Interests (comma-separated, up to 10)
                </label>
                <input
                  id="pubInterests"
                  type="text"
                  value={interestsText}
                  onChange={(e) => setInterestsText(e.target.value)}
                  placeholder="System Design, Databases, Debugging"
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white placeholder-slate-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Community Profile'}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Blocked Users Safety List */}
        <section className="rounded-xl border border-slate-800 bg-[#111827] p-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            <h2 className="font-display text-base font-semibold text-white">
              Blocked Participants
            </h2>
          </div>
          {loadingBlocks ? (
            <p className="py-4 text-xs text-slate-400">Loading safety list...</p>
          ) : blockedUids.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">
              You have not blocked any participants. Messages from blocked peers are hidden immediately inside rooms.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800/80">
              {blockedUids.map((uid) => (
                <li
                  key={uid}
                  className="py-3 flex items-center justify-between gap-4 text-sm"
                >
                  <div className="flex items-center gap-2 text-slate-300">
                    <Ban className="h-4 w-4 text-slate-500" />
                    <span className="font-mono text-xs">{uid}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblock(uid)}
                    className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:border-slate-500"
                  >
                    Unblock
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Data Governance & Self-Service Account Deletion */}
        <section className="rounded-xl border border-slate-800 bg-[#111827] p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <h2 className="font-display text-base font-semibold text-white">
                Data Governance &amp; Account Deletion
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              You can export your complete evaluation and competency history as JSON at any time, or request permanent account deletion.
            </p>
          </div>
          {profile?.accountStatus === 'pending_deletion' ? (
            <span className="font-mono text-xs text-amber-400">
              Deletion Request Pending
            </span>
          ) : confirmDelete ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleRequestDeletion}
                className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
              >
                {deleting ? 'Submitting...' : 'Confirm Deletion Request'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-red-500/40 bg-red-950/20 px-3.5 py-2 text-xs font-medium text-red-200 hover:bg-red-950/40 whitespace-nowrap shrink-0"
            >
              Request Account Deletion
            </button>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
