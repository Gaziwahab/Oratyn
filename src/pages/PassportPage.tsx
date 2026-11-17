import { useEffect, useState, type FormEvent } from 'react';
import {
  Award,
  Check,
  Copy,
  Globe,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { WorkspaceShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import {
  getSkillPassport,
  listCompetencyObservations,
  listUserEvaluations,
  saveSkillPassport,
} from '../features/sessions/sessionService';
import { aggregateCompetencyProgress } from '../../packages/domain/src/evaluation';
import { PILOT_COMPETENCIES } from '../../packages/domain/src/catalogue';
import type {
  SkillPassportCompetencyItem,
  SkillPassportRecord,
} from '../../packages/domain/src/types';
import passportEmblemImg from '../assets/images/passport_verified_emblem_1794544516416.jpg';

export function PassportPage({ viewedUid }: { viewedUid?: string }) {
  const { firebaseUser, profile, publicProfile } = useAuth();
  const targetUid = viewedUid || firebaseUser?.uid || '';
  const isOwner = Boolean(firebaseUser && firebaseUser.uid === targetUid);

  const [passport, setPassport] = useState<SkillPassportRecord | null>(null);
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'community'>('private');
  const [computedCompetencies, setComputedCompetencies] = useState<
    SkillPassportCompetencyItem[]
  >([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!targetUid) return;
    let active = true;
    setLoading(true);

    async function load() {
      try {
        const existingPassport = await getSkillPassport(targetUid).catch(() => null);
        if (!active) return;

        if (existingPassport) {
          setPassport(existingPassport);
          setHeadline(existingPassport.headline);
          setBio(existingPassport.bio);
          setVisibility(existingPassport.visibility);
          setCompletedCount(existingPassport.completedSessionsCount);
          setComputedCompetencies(existingPassport.verifiedCompetencies);
        }

        if (isOwner && firebaseUser) {
          const [evals, obs] = await Promise.all([
            listUserEvaluations(firebaseUser.uid),
            listCompetencyObservations(firebaseUser.uid),
          ]);
          if (!active) return;

          const compTitleMap = new Map(
            PILOT_COMPETENCIES.map((item) => [item.slug, item.title] as const)
          );
          const agg = aggregateCompetencyProgress(obs);
          const freshCompetencies: SkillPassportCompetencyItem[] = agg
            .filter((c) => c.observationCount > 0)
            .map((c) => ({
              competencyKey: c.competencyKey,
              title:
                compTitleMap.get(c.competencyKey) ??
                c.competencyKey.replace(/_/g, ' '),
              status: c.status,
              confidence: c.confidence,
              observationCount: c.observationCount,
            }));

          setCompletedCount(evals.length);
          setComputedCompetencies(freshCompetencies);

          if (!existingPassport) {
            setHeadline(
              `${profile?.experienceBand?.replace(/_/g, ' ') ?? 'Software'} Engineer · Evidence-Based Practice Portfolio`
            );
            setBio(publicProfile?.bio ?? '');
          }
        }
      } catch (err) {
        if (active) {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : 'This Developer Skill Passport is private or has not been published yet.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [targetUid, isOwner, firebaseUser, profile, publicProfile]);

  const handleSavePassport = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile || !isOwner) return;
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const updated = await saveSkillPassport({
        uid: firebaseUser.uid,
        displayName: profile.displayName,
        experienceBand: profile.experienceBand,
        headline,
        bio,
        visibility,
        completedSessionsCount: completedCount,
        verifiedCompetencies: computedCompetencies,
      });
      setPassport(updated);
      setStatusMsg(
        visibility === 'community'
          ? 'Skill Passport synced and visible to authenticated community members.'
          : 'Skill Passport saved privately.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to save Skill Passport.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!targetUid) return;
    const url = `${window.location.origin}/passport/${targetUid}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setStatusMsg(`Share link: ${url}`);
    }
  };

  return (
    <WorkspaceShell
      title="Developer Skill Passport"
      breadcrumb="Opt-in evidence-based engineering competency portfolio · Non-comparative"
      action={
        passport && passport.visibility === 'community' ? (
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Shareable Link</span>
              </>
            )}
          </button>
        ) : null
      }
    >
      <div className="space-y-6">
        {errorMsg ? (
          <div
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200"
          >
            {errorMsg}
          </div>
        ) : null}

        {statusMsg ? (
          <div
            role="status"
            className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200"
          >
            {statusMsg}
          </div>
        ) : null}

        {loading ? (
          <div className="h-72 animate-pulse rounded-xl border border-slate-800 bg-[#111827]" />
        ) : (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Passport Card Preview (7 cols) */}
            <section className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="flex items-start gap-4">
                  <img
                    src={passportEmblemImg}
                    alt="Verified Practice Emblem"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                    className="h-16 w-16 shrink-0 rounded-xl border border-slate-700/80 object-cover shadow-md"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-xs text-blue-400 font-medium">
                      <Award className="h-4 w-4" />
                      <span>Verified Practice Evidence Passport</span>
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-bold text-white">
                      {passport?.displayName ?? profile?.displayName ?? 'Engineer'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-300">
                      {headline || 'Evidence-based software engineering practice portfolio'}
                    </p>
                    {bio ? (
                      <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                        {bio}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#0B0F17] px-3.5 py-2.5 text-right">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">
                    Evaluated Sessions
                  </p>
                  <p className="font-mono text-xl font-bold text-white">
                    {completedCount}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Demonstrated Engineering Competencies
                  </h3>
                  <span className="text-xs text-slate-400">
                    Status: Emerging · Developing · Consistent
                  </span>
                </div>

                {computedCompetencies.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-slate-800/80 bg-[#0B0F17]/60 p-5 text-xs text-slate-400">
                    Complete a peer discussion room or an AI Practice Arena session and generate an evaluation report to populate verified competency evidence on your Skill Passport.
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {computedCompetencies.map((comp) => (
                      <div
                        key={comp.competencyKey}
                        className="rounded-lg border border-slate-800 bg-[#0B0F17] p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white">
                            {comp.title}
                          </span>
                          <span className="font-mono text-xs font-semibold capitalize text-blue-400">
                            {comp.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="mt-1.5 font-mono text-[11px] text-slate-400">
                          {comp.observationCount} session observation
                          {comp.observationCount === 1 ? '' : 's'} ·{' '}
                          {comp.confidence} confidence
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  Observations are derived strictly from rubric-validated transcripts with verified message citations—never global leaderboards.
                </span>
              </div>
            </section>

            {/* Right 5 cols: Owner Controls */}
            {isOwner ? (
              <form
                onSubmit={handleSavePassport}
                className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#111827] p-6 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  <h2 className="font-display text-base font-semibold text-white">
                    Passport Settings &amp; Sharing
                  </h2>
                </div>
                <p className="text-xs text-slate-400">
                  Your Skill Passport is private by default. Opt in to Community visibility if you want to share your verified competency snapshot with mentors or interviewers.
                </p>

                <div>
                  <label
                    htmlFor="passport-headline"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Engineering Headline
                  </label>
                  <input
                    id="passport-headline"
                    type="text"
                    maxLength={120}
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g., Backend & Distributed Systems Engineer"
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="passport-bio"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Focus Statement
                  </label>
                  <textarea
                    id="passport-bio"
                    rows={3}
                    maxLength={280}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Summarize the engineering systems and problem spaces you are practicing..."
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-[#0B0F17] p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-300 mb-2">
                    Passport Visibility
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setVisibility('private')}
                      className={`flex items-center gap-2 rounded-lg border p-3 text-left text-xs ${
                        visibility === 'private'
                          ? 'border-blue-500 bg-blue-600/15 text-white'
                          : 'border-slate-800 bg-[#0B0F17] text-slate-400'
                      }`}
                    >
                      <Lock className="h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">Private</p>
                        <p className="text-[11px] text-slate-400">Only you</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility('community')}
                      className={`flex items-center gap-2 rounded-lg border p-3 text-left text-xs ${
                        visibility === 'community'
                          ? 'border-blue-500 bg-blue-600/15 text-white'
                          : 'border-slate-800 bg-[#0B0F17] text-slate-400'
                      }`}
                    >
                      <Globe className="h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">Shareable</p>
                        <p className="text-[11px] text-slate-400">Community link</p>
                      </div>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? 'Syncing Skill Passport...' : 'Sync & Save Skill Passport'}
                </button>
              </form>
            ) : null}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
