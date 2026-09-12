import Link from 'next/link';
import { ArrowRight, BookOpen, Check, FileText, Flame, MessageCircle, Plus, Sparkles, Upload } from 'lucide-react';
import { RecentActivity, type ActivityItem, type RecentActivityLabels } from './RecentActivity';

interface StudentHomeStat {
  label: string;
  value: number;
  desc: string;
}

/**
 * A quota rendered as a LARGE NUMERAL with a faint caption, never as a sentence.
 *
 * Two reasons, and the second is a correctness one.
 *
 * (1) The kits treat big figures as decoration; a number set large with a quiet
 *     label under it is the shape being copied here.
 *
 * (2) IT AVOIDS A DAY CLAIM AND AN ARABIC AGREEMENT BUG AT THE SAME TIME.
 *     `usage_counters.day` defaults to `current_date`, which is SERVER UTC, so
 *     "3 of 10 used today" is false for a student at 00:30 in Morocco — the
 *     exact defect this project already paid for once in the try-again-tomorrow
 *     copy. Splitting the figure from its label removes the word "today"
 *     entirely. It also removes the need to inflect a counted noun inline:
 *     "7 questions left" in Arabic would have to agree with 7, and the caption
 *     form ("Questions left" / the definite plural) agrees with nothing.
 */
export interface QuotaMeter {
  /** Stable key for React; never rendered. */
  key: string;
  /** Caption under the figure. Already localised by the caller. */
  label: string;
  remaining: number;
  total: number;
}

/** Per-subject progress = materials that HAVE a summary. Quiz mastery is ruled
 *  out (it needs a migration; `quiz_attempts` was dropped). */
export interface SubjectProgress {
  id: string;
  name: string;
  materials: number;
  summarised: number;
}

export interface OnboardingStep {
  key: string;
  title: string;
  desc: string;
  done: boolean;
  href: string;
}

interface StudentHomeLabels {
  welcome: string;
  askTitle: string;
  askDesc: string;
  newSubject: string;
  newSubjectDesc: string;
  subjects: string;
  streakLabel: string;
  streakUnit: string;
  streakZoneHint: string;
  recentActivity: string;
  planTitle: string;
  planName: string;
  ofWord: string;
  subjectsUsed: string;
  allSubjects: string;
  materialsWord: string;
  noSubjects: string;
  noSubjectsDesc: string;
  startTitle: string;
  whatTitle: string;
  whatLines: string[];
  upgradeCta: string;
  activity: RecentActivityLabels;
}

export interface StudentHomeProps {
  stats: StudentHomeStat[];
  /** Current study streak, or null when not yet tracked (ghost "—" placeholder). Phase 5 passes a real number. */
  streak: number | null;
  askHref: string;
  newSubjectHref: string;
  subjectsHref: string;
  upgradeHref: string;
  isPro: boolean;
  quotas: QuotaMeter[];
  subjects: SubjectProgress[];
  subjectsUsed: number;
  subjectsLimit: number;
  onboarding: OnboardingStep[];
  labels: StudentHomeLabels;
  recentActivity: ActivityItem[];
}

/**
 * Student home — dumb, presentational. All data/labels arrive as plain props
 * (no i18n dict, no Supabase) so the shell can be reused/storybooked in Phase 8.
 * THAT CONTRACT IS LOAD-BEARING AND MUST SURVIVE: local dev writes to the
 * PRODUCTION database, so a component that fetches its own data cannot be looked
 * at safely. Prop-driven is what lets `/preview/student-home` render this at any
 * data state with no database anywhere near it.
 *
 * It carries `data-theme="dark"` itself and paints its own ground, so it renders
 * correctly mounted inside the (still light) dashboard chrome or alone on the
 * preview route. See globals.css for why the palette is per-subtree.
 *
 * ZERO IS THE STATE THAT MATTERS. The live embedding key was last used
 * 2026-08-10 and every existing conversation is months old, so an empty account
 * is not an edge case — it is what the next student sees. Everything here that
 * carries weight at zero (the plan meters, the subject shelf, the path, the
 * capability panel) renders the same whether the account is empty or full; only
 * the activity list and the progress bars need rows to exist.
 */
export function StudentHome({
  stats,
  streak,
  askHref,
  newSubjectHref,
  subjectsHref,
  upgradeHref,
  isPro,
  quotas,
  subjects,
  subjectsUsed,
  subjectsLimit,
  onboarding,
  labels,
  recentActivity,
}: StudentHomeProps) {
  const stepsLeft = onboarding.filter((s) => !s.done).length;

  return (
    <div data-theme="dark" className="-m-4 min-h-screen p-4 pb-24 pt-[4.5rem] md:-m-8 md:p-8 md:pt-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* ── Header. Weight, not letter-spacing, carries the hierarchy: Rubik's
            Arabic subset ships the full 300..900 axis, so font-bold on a large
            size is available in both scripts. No tracking utility appears
            anywhere in this file. ── */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">{labels.welcome}</h1>
          <span
            className={
              isPro
                ? 'inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground'
                : 'inline-flex items-center rounded-full bg-accent-subtle px-3 py-1 text-xs font-semibold text-accent'
            }
          >
            {labels.planName}
          </span>
        </header>

        {/* ── Primary action + streak ── */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            href={askHref}
            className="group flex items-center justify-between gap-4 rounded-2xl bg-accent p-6 text-accent-foreground transition-colors hover:bg-accent-hover md:col-span-2"
          >
            <div className="min-w-0">
              <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-black/15">
                <MessageCircle className="h-5 w-5" />
              </span>
              <p className="text-lg font-bold">{labels.askTitle}</p>
              <p className="mt-1 text-sm opacity-80">{labels.askDesc}</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
          </Link>

          {/*
            Streak. P5.3 wired it; the component did not change shape, exactly as
            register #14 predicted — `streak` simply stopped being a literal null.

            `null` still means NOT MEASURED (no timezone yet, or the read failed) and
            renders the ghost with the unit AND the zone hint suppressed: a hint that
            the dash is "in your local time" would be a claim about a number that
            does not exist. `0` is a real, earned zero and renders normally.
          */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-muted-foreground">{labels.streakLabel}</span>
              <Flame className={streak ? 'h-5 w-5 text-accent' : 'h-5 w-5 text-faint'} />
            </div>
            <div className="mt-3">
              {streak === null ? (
                <p>
                  <span className="text-5xl font-bold text-faint">-</span>
                </p>
              ) : (
                <>
                  <p>
                    <span className="text-5xl font-bold text-foreground">{streak}</span>
                    <span className="ms-2 text-sm text-muted-foreground">{labels.streakUnit}</span>
                  </p>
                  {/*
                    §5, "never promise what the app doesn't do". The streak counts
                    days in the STUDENT'S timezone; that is true but opaque, so it is
                    stated rather than left to be inferred from a number that ticks
                    at what looks like a strange hour.
                  */}
                  <p className="mt-1 text-xs text-faint">{labels.streakZoneHint}</p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Plan + quota. Renders identically at zero: a new account has its
            full allowance, which is the most useful thing the screen can say to
            someone who has done nothing yet. NO DAY WORD APPEARS — see QuotaMeter. ── */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">{labels.planTitle}</h2>
            {!isPro && (
              <Link
                href={upgradeHref}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent px-3 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {labels.upgradeCta}
              </Link>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {quotas.map((q) => (
              <div key={q.key} className="rounded-xl bg-raised p-4">
                <p className="text-4xl font-bold leading-snug text-foreground">{q.remaining}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{q.label}</p>
                <p className="mt-2 text-xs text-faint">
                  {labels.ofWord} {q.total}
                </p>
              </div>
            ))}
            <div className="rounded-xl bg-raised p-4">
              <p className="text-4xl font-bold leading-snug text-foreground">
                {subjectsUsed}
                <span className="text-xl font-semibold text-faint">/{subjectsLimit}</span>
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{labels.subjectsUsed}</p>
            </div>
          </div>
        </section>

        {/* ── The path. Present at zero, and it is the densest thing on the screen
            for an empty account precisely because every step is undone. It
            disappears once all three are done, so a working account does not
            carry onboarding forever. ── */}
        {stepsLeft > 0 && (
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-foreground">{labels.startTitle}</h2>
            <ol className="mt-4 space-y-2">
              {onboarding.map((step, i) => (
                <li key={step.key}>
                  <Link
                    href={step.href}
                    className="group flex items-center gap-4 rounded-xl bg-raised p-4 transition-colors hover:bg-muted"
                  >
                    <span
                      className={
                        step.done
                          ? 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground'
                          : 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent'
                      }
                    >
                      {step.done ? <Check className="h-5 w-5" /> : <span className="text-sm font-bold">{i + 1}</span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{step.title}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{step.desc}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ── Subjects + per-subject progress. At zero this is the empty
            affordance, not a blank area. ── */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">{labels.subjects}</h2>
            <Link
              href={subjectsHref}
              className="group inline-flex items-center gap-1.5 text-xs font-semibold text-accent transition-colors hover:text-accent-hover"
            >
              {labels.allSubjects}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
            </Link>
          </div>

          {subjects.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-raised p-8 text-center">
              <span className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                <BookOpen className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-foreground">{labels.noSubjects}</p>
              <p className="mt-1 text-sm text-muted-foreground">{labels.noSubjectsDesc}</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {subjects.map((s) => {
                const pct = s.materials === 0 ? 0 : Math.round((s.summarised / s.materials) * 100);
                return (
                  <li key={s.id} className="rounded-xl bg-raised p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                      <p className="shrink-0 text-xs text-faint">
                        {s.summarised}/{s.materials} {labels.materialsWord}
                      </p>
                    </div>
                    {/* Progress = materials WITH a summary. The track is a surface
                        step, not a shadow; the fill is the one accent. */}
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href={newSubjectHref}
            className="group mt-3 flex items-center gap-4 rounded-xl border border-dashed border-border p-4 transition-colors hover:border-accent"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
              <Plus className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{labels.newSubject}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{labels.newSubjectDesc}</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
          </Link>
        </section>

        {/* ── Stats. The three counts the page already fetched, in the kits' tile
            shape: icon in a rounded accent-tinted square, short title, faint line. ── */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map(({ label, value, desc }, i) => {
            const Icon = [BookOpen, FileText, MessageCircle][i] ?? BookOpen;
            return (
              <div key={label} className="rounded-2xl border border-border bg-surface p-5">
                <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="text-3xl font-bold text-foreground">{value}</p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-xs text-faint">{desc}</p>
              </div>
            );
          })}
        </section>

        {/* ── What this does. Pure capability copy, so it is fully present at zero
            and is the answer to "this looks empty, what am I paying for". ── */}
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-foreground">{labels.whatTitle}</h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {labels.whatLines.map((line, i) => {
              const Icon = [Upload, Sparkles, MessageCircle][i] ?? Sparkles;
              return (
                <li key={line} className="rounded-xl bg-raised p-4">
                  <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="text-sm text-muted-foreground">{line}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Recent activity ── */}
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase text-muted-foreground">{labels.recentActivity}</h2>
          <RecentActivity items={recentActivity} labels={labels.activity} />
        </section>
      </div>
    </div>
  );
}
