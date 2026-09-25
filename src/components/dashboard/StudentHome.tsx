import Link from 'next/link';
import { ArrowRight, BookOpen, Check, FileText, MessageCircle, Plus, Sparkles, Upload } from 'lucide-react';
import type { Locale } from '@/lib/i18n';
import { Ring } from '@/components/ui/Ring';
import { ChatPages, EmptyShelf, Flame, SparkBook } from '@/components/illustrations';
import { RecentActivity, type ActivityItem, type RecentActivityLabels } from './RecentActivity';

interface StudentHomeStat {
  label: string;
  value: number;
  desc: string;
}

/**
 * A quota rendered as a RING with the number inside, never as a sentence
 * (docs/design/VISUAL_LANGUAGE.md, rule 2). The caption under it agrees with
 * nothing, so no Arabic plural category is involved and no day word appears:
 * `usage_counters.day` is server UTC, and "used today" would be false for a
 * student at 00:30 in Morocco (register #85).
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

/** The most recent conversation, for the Continue card (register #85, 2.4). */
export interface ContinueCard {
  subject: string;
  date: string;
  href: string;
}

interface StudentHomeLabels {
  continueTitle: string;
  continueBody: string;
  continueCta: string;
  welcome: string;
  /** The friendly line under the greeting (VISUAL_LANGUAGE.md rule 3). */
  welcomeLine: string;
  askTitle: string;
  askDesc: string;
  newSubject: string;
  newSubjectDesc: string;
  subjects: string;
  streakLabel: string;
  streakUnit: string;
  streakZoneHint: string;
  /** One line under the flame: lit ("Keep it going.") or unlit ("Start one today."). */
  streakLit: string;
  streakUnlit: string;
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
  /** Streak in days; null while unknown (no timezone yet) renders a ghost dash. */
  streak: number | null;
  askHref: string;
  newSubjectHref: string;
  subjectsHref: string;
  /** Null when no purchase link may be shown (Apple 3.1.1(a); src/lib/platform.ts). */
  upgradeHref: string | null;
  /** The most recent conversation, or null for an account that has not asked yet. */
  continueCard?: ContinueCard | null;
  /** For the one date format (#121). */
  locale: Locale;
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
 * THE STUDENT HOME, FOR AN 18-YEAR-OLD ON A PHONE (docs/design/VISUAL_LANGUAGE.md).
 *
 * Every card says what it is with a picture before a word is read; every
 * number is a ring or a bar; every line is short; the cards rise in as the
 * screen opens (staggered, inside the reduced-motion guard); a press scales.
 * The data and the props did not change: this is the same screen, made for
 * the person it is for.
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
  continueCard = null,
  locale,
}: StudentHomeProps) {
  const stepsLeft = onboarding.filter((s) => !s.done).length;
  const lit = (streak ?? 0) > 0;
  const tones = ['accent', 'mint', 'sky', 'violet'] as const;

  return (
    <div>
      <div className="max-w-6xl space-y-5">
        {/* ── Greeting: a name-sized headline, one friendly line, the plan pill. ── */}
        <header className="rise flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">{labels.welcome}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{labels.welcomeLine}</p>
          </div>
          <span
            className={
              isPro
                ? 'inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground'
                : 'inline-flex items-center gap-1.5 rounded-full bg-accent-subtle px-3 py-1 text-xs font-semibold text-accent'
            }
          >
            <Sparkles className="h-3.5 w-3.5" />
            {labels.planName}
          </span>
        </header>

        {/* ── Ask + streak ── */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            href={askHref}
            className="pressable liftable rise rise-1 group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl bg-accent p-6 text-accent-foreground transition-colors hover:bg-accent-hover md:col-span-2"
          >
            <div className="min-w-0">
              <p className="text-xl font-bold">{labels.askTitle}</p>
              <p className="mt-1 text-sm opacity-80">{labels.askDesc}</p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-1.5 text-xs font-semibold">
                <MessageCircle className="h-3.5 w-3.5" />
                {labels.askTitle}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
              </span>
            </div>
            {/* The illustration sits on the gold: its own tokens re-colour on the
                accent fill through the -subtle vars, which are translucent. */}
            <ChatPages onAccent size={104} className="hidden shrink-0 sm:block" />
          </Link>

          <div className="rise rise-2 flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
            <Flame lit={lit} size={72} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase text-muted-foreground">{labels.streakLabel}</p>
              {streak === null ? (
                <p className="text-4xl font-bold text-faint">-</p>
              ) : (
                <p>
                  <span className="text-4xl font-bold text-foreground">{streak}</span>
                  <span className="ms-2 text-sm text-muted-foreground">{labels.streakUnit}</span>
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{lit ? labels.streakLit : labels.streakUnlit}</p>
              {streak !== null && <p className="mt-0.5 text-[11px] text-faint">{labels.streakZoneHint}</p>}
            </div>
          </div>
        </section>

        {/* ── Pick up where you left off (register #85, 2.4). ── */}
        {continueCard && (
          <section className="rise rise-2 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5">
            <div className="flex min-w-0 items-center gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-subtle text-violet">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">{labels.continueTitle}</h2>
                {/* #121: the subject and the date are each a <bdi>. */}
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {labels.continueBody.split('{subject}')[0]}
                  <bdi className="font-medium text-foreground">{continueCard.subject}</bdi>
                  {labels.continueBody.split('{subject}')[1]}{' '}
                  <bdi className="whitespace-nowrap text-faint">· {continueCard.date}</bdi>
                </p>
              </div>
            </div>
            <Link
              href={continueCard.href}
              className="pressable inline-flex h-10 items-center gap-2 rounded-xl border border-accent px-4 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {labels.continueCta}
              <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </section>
        )}

        {/* ── Plan: rings, not sentences. Full at zero, which is the most useful
            thing the screen can say to someone who has done nothing yet. ── */}
        <section className="rise rise-3 rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                <Sparkles className="h-4 w-4" />
              </span>
              {labels.planTitle}
            </h2>
            {!isPro && upgradeHref && (
              <Link
                href={upgradeHref}
                className="pressable inline-flex items-center gap-1.5 rounded-full border border-accent px-3 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {labels.upgradeCta}
              </Link>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {quotas.map((q, i) => (
              <div key={q.key} className="flex flex-col items-center rounded-xl bg-raised p-3 text-center">
                <Ring value={q.total ? q.remaining / q.total : 0} tone={tones[i % tones.length]} label={`${q.remaining} ${labels.ofWord} ${q.total} ${q.label}`}>
                  <span className="text-xl font-bold leading-none text-foreground">{q.remaining}</span>
                </Ring>
                <p className="mt-2 text-xs font-medium text-muted-foreground">{q.label}</p>
                <p className="text-[11px] text-faint">
                  {labels.ofWord} {q.total}
                </p>
              </div>
            ))}
            <div className="flex flex-col items-center rounded-xl bg-raised p-3 text-center">
              <Ring value={subjectsLimit ? subjectsUsed / subjectsLimit : 0} tone="violet" label={`${subjectsUsed} ${labels.ofWord} ${subjectsLimit} ${labels.subjectsUsed}`}>
                <span className="text-xl font-bold leading-none text-foreground">{subjectsUsed}</span>
              </Ring>
              <p className="mt-2 text-xs font-medium text-muted-foreground">{labels.subjectsUsed}</p>
              <p className="text-[11px] text-faint">
                {labels.ofWord} {subjectsLimit}
              </p>
            </div>
          </div>
        </section>

        {/* ── The path: present at zero, gone once all three are done. ── */}
        {stepsLeft > 0 && (
          <section className="rise rise-3 rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center gap-4">
              <SparkBook size={64} className="shrink-0" />
              <h2 className="text-base font-bold text-foreground">{labels.startTitle}</h2>
            </div>
            <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {onboarding.map((step, i) => {
                const Icon = [Plus, Upload, MessageCircle][i] ?? Plus;
                const tile = ['bg-mint-subtle text-mint', 'bg-sky-subtle text-sky', 'bg-violet-subtle text-violet'][i] ?? 'bg-accent-subtle text-accent';
                return (
                  <li key={step.key}>
                    <Link
                      href={step.href}
                      className="pressable liftable group flex h-full items-center gap-3 rounded-xl bg-raised p-4 transition-colors hover:bg-muted sm:flex-col sm:items-start"
                    >
                      <span className={step.done ? 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground' : `inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tile}`}>
                        {step.done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          <span className="me-1.5 text-faint">{i + 1}.</span>
                          {step.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{step.desc}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* ── Subjects with mini rings; an illustrated empty state. ── */}
        <section className="rise rise-4 rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-subtle text-sky">
                <BookOpen className="h-4 w-4" />
              </span>
              {labels.subjects}
            </h2>
            <Link
              href={subjectsHref}
              className="group inline-flex items-center gap-1.5 text-xs font-semibold text-accent transition-colors hover:text-accent-hover"
            >
              {labels.allSubjects}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
            </Link>
          </div>

          {subjects.length === 0 ? (
            <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-border bg-raised p-6 text-center">
              <EmptyShelf size={88} title={labels.noSubjects} />
              <p className="mt-2 text-sm font-semibold text-foreground">{labels.noSubjects}</p>
              <p className="mt-1 text-sm text-muted-foreground">{labels.noSubjectsDesc}</p>
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {subjects.map((s, i) => {
                const pct = s.materials === 0 ? 0 : s.summarised / s.materials;
                return (
                  <li key={s.id} className="flex items-center gap-3 rounded-xl bg-raised p-3">
                    <Ring value={pct} size={48} stroke={5} tone={tones[(i + 1) % tones.length]} label={`${s.summarised} ${labels.ofWord} ${s.materials} ${labels.materialsWord}`}>
                      <span className="text-[11px] font-bold text-foreground">{Math.round(pct * 100)}%</span>
                    </Ring>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                      <p className="text-xs text-faint">
                        {s.summarised}/{s.materials} {labels.materialsWord}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href={newSubjectHref}
            className="pressable group mt-3 flex items-center gap-4 rounded-xl border border-dashed border-border p-4 transition-colors hover:border-accent"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
              <Plus className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{labels.newSubject}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{labels.newSubjectDesc}</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
          </Link>
        </section>

        {/* ── Stats as tiles, each with its own tint. ── */}
        <section className="rise rise-4 grid grid-cols-3 gap-3">
          {stats.map(({ label, value, desc }, i) => {
            const Icon = [BookOpen, FileText, MessageCircle][i] ?? BookOpen;
            const tile = ['bg-sky-subtle text-sky', 'bg-mint-subtle text-mint', 'bg-violet-subtle text-violet'][i] ?? 'bg-accent-subtle text-accent';
            return (
              <div key={label} className="rounded-2xl border border-border bg-surface p-4">
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tile}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-3 text-2xl font-bold leading-none text-foreground">{value}</p>
                <p className="mt-1 text-xs font-medium text-foreground">{label}</p>
                <p className="hidden text-[11px] text-faint sm:block">{desc}</p>
              </div>
            );
          })}
        </section>

        {/* ── What KnowFlow does: three tiles with an icon each. ── */}
        <section className="rise rise-5 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-foreground">{labels.whatTitle}</h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {labels.whatLines.map((line, i) => {
              const Icon = [FileText, BookOpen, MessageCircle][i] ?? FileText;
              const tile = ['bg-mint-subtle text-mint', 'bg-coral-subtle text-coral', 'bg-sky-subtle text-sky'][i] ?? 'bg-accent-subtle text-accent';
              return (
                <li key={line} className="flex items-start gap-3 rounded-xl bg-raised p-4">
                  <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tile}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm text-muted-foreground">{line}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Recent activity ── */}
        <section className="rise rise-5 rounded-2xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-coral-subtle text-coral">
              <MessageCircle className="h-4 w-4" />
            </span>
            {labels.recentActivity}
          </h2>
          <div className="mt-4">
            <RecentActivity items={recentActivity} labels={labels.activity} locale={locale} />
          </div>
        </section>
      </div>
    </div>
  );
}
