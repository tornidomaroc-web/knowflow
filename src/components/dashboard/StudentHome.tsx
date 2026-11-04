import Link from 'next/link';
import { ArrowRight, BookOpen, Check, FileText, MessageCircle, Plus, Sparkles, Upload } from 'lucide-react';
import type { Locale } from '@/lib/i18n';
import { Ring } from '@/components/ui/Ring';
import { EmptyShelf, SparkBook } from '@/components/illustrations';
import {
  ClayArrow,
  ClayAskArt,
  ClayBook,
  ClayBooksGlyph,
  ClayChevron,
  ClayFlame,
  ClayMenu,
  ClayNewSubject,
  ClayPlus,
  ClayQuestionGlyph,
  ClayUploadGlyph,
} from '@/components/clay/ClayIcons';
import { RecentActivity, type ActivityItem, type RecentActivityLabels } from './RecentActivity';
import { UserName } from '@/components/ui/UserName';

interface StudentHomeStat {
  label: string;
  value: number;
  desc: string;
}

/**
 * A quota rendered as a RING beside its number, never as a sentence
 * (docs/design/VISUAL_LANGUAGE.md, rule 2). The caption agrees with nothing,
 * so no Arabic plural category is involved and no day word appears:
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
  /** The friendly line beside the date (VISUAL_LANGUAGE.md rule 3). */
  welcomeLine: string;
  askTitle: string;
  askDesc: string;
  newSubject: string;
  newSubjectDesc: string;
  subjects: string;
  /** The menu button's name (the Settings tab's label). */
  settings?: string;
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
  /** Streak in days; null while unknown (no timezone yet). */
  streak: number | null;
  /** Step Redesign-2: the weekday and the day, from the real date (formatDayDate). */
  dateLine?: string;
  askHref: string;
  newSubjectHref: string;
  subjectsHref: string;
  /** The greeting's menu button (design "C"); Settings, in both shells. */
  settingsHref?: string;
  /** Null when no purchase link may be shown (Apple 3.1.1(a); src/lib/platform.ts). */
  upgradeHref: string | null;
  /** The most recent conversation, or null for an account that has not asked yet. */
  continueCard?: ContinueCard | null;
  /** For the one date format (#121), the question mark in the pictures and the count's word order. */
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

/** One meter of the allowance card: the ring with its picture, the number beside it. */
function Meter({ value, glyph, tone, remaining, total, label, ofWord }: { value: number; glyph: React.ReactNode; tone: 'accent' | 'green' | 'sky'; remaining: number; total: number; label: string; ofWord: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Ring value={value} size={62} stroke={9} tone={tone} track="var(--ring-track)" label={`${remaining} ${ofWord} ${total} ${label}`}>
        {glyph}
      </Ring>
      <div className="min-w-0">
        <p className="text-[1.3125rem] font-extrabold leading-tight text-foreground">
          {remaining} <span className="text-[0.8125rem] font-medium text-muted-foreground">{ofWord} {total}</span>
        </p>
        <p className="text-[0.8125rem] font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/**
 * THE STUDENT HOME, DESIGN "C" (the clay mix, owner-approved 2026-11-03).
 *
 * In the mockup's order: the greeting (the date line, the welcome, a clay
 * menu button to Settings); the dark ask card; a two-up row (the streak, and
 * a new subject); the allowance as rings; the subjects. The sections the
 * mockup does not show (the plan pill, Continue, the three-step path, the
 * stats, what KnowFlow does, recent activity) are kept with their logic and
 * made clay cards. The data and the rules did not change: the plan pill and
 * the upgrade link appear only where they did (3.1.1(a), 3.1.3(f)), every
 * subject name goes through UserName, every number is a ring or a bar.
 */
export function StudentHome({
  stats,
  streak,
  dateLine,
  askHref,
  newSubjectHref,
  subjectsHref,
  settingsHref,
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
  const en = locale === 'en';
  const mark = en ? '?' : '؟';
  const meterGlyph = [<ClayQuestionGlyph key="q" mark={mark} />, <ClayUploadGlyph key="u" />];
  const meterTone = ['accent', 'green'] as const;

  return (
    <div>
      <div className="max-w-6xl space-y-[1.125rem]">
        {/* ── Greeting: the date line, the welcome, the menu button. ── */}
        <header className="rise flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              {dateLine ? <><bdi>{dateLine}</bdi>{' · '}</> : null}
              {labels.welcomeLine}
            </p>
            <h1 className="mt-1 text-[2rem] font-extrabold leading-[2.5rem] text-foreground">{labels.welcome}</h1>
            {/* Apple 3.1.3(f), measured in the simulator 2026-10-08: inside the app a
                free student sees no plan name at all ("Free" names a tier that
                exists only where it can be bought). On the web, and for a Pro
                student anywhere, the pill stays. */}
            {(isPro || upgradeHref) && (
              <span
                className={
                  isPro
                    ? 'kf-gold-sm mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold'
                    : 'kf-plan-pill kf-pill mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-accent'
                }
              >
                <Sparkles className="h-3.5 w-3.5" />
                {labels.planName}
              </span>
            )}
          </div>
          {settingsHref && (
            <Link
              href={settingsHref}
              aria-label={labels.settings}
              className="kf-button pressable inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            >
              <ClayMenu />
            </Link>
          )}
        </header>

        {/* ── Ask: the dark card, the gold pill, the gold ring and bubble. ── */}
        <Link
          href={askHref}
          className="kf-ask pressable rise rise-1 group flex items-center gap-3 rounded-[1.75rem] px-5 py-[1.375rem]"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[1.4375rem] font-extrabold leading-tight">{labels.askTitle}</p>
            <p className="mt-1.5 text-[0.9375rem] leading-normal text-[color:var(--clay-ask-muted)]">{labels.askDesc}</p>
            <span className="kf-gold mt-4 inline-flex min-h-[2.875rem] items-center gap-2 whitespace-nowrap rounded-full px-5 text-[0.9375rem] font-bold">
              {labels.askTitle}
              <ClayArrow className="rtl:-scale-x-100" />
            </span>
          </div>
          <ClayAskArt mark={mark} className="shrink-0" />
        </Link>

        {/* ── The two-up row: one structure, the streak and a new subject. ── */}
        <section className="rise rise-2 grid grid-cols-2 gap-3.5">
          <div data-kf-streak={lit ? 'lit' : 'unlit'} className="kf-streak flex min-w-0 flex-col gap-1 rounded-3xl p-4">
            <ClayFlame lit={lit} />
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[1.0625rem] font-extrabold text-foreground">
              {labels.streakLabel}
              {streak ? (
                <span className="kf-gold-sm inline-flex h-[1.625rem] items-center rounded-full px-2.5 text-sm font-extrabold">
                  <bdi>{streak} {labels.streakUnit}</bdi>
                </span>
              ) : null}
              {streak === 0 && <span className="sr-only">0 {labels.streakUnit}</span>}
            </p>
            <p className="text-[0.8125rem] font-medium leading-snug text-[color:var(--clay-streak-muted)]">{lit ? labels.streakLit : labels.streakUnlit}</p>
            {streak !== null && <p className="text-[0.6875rem] font-medium text-[color:var(--clay-streak-muted)]">{labels.streakZoneHint}</p>}
          </div>
          <Link href={newSubjectHref} className="kf-card pressable flex min-w-0 flex-col gap-1 p-4">
            <ClayNewSubject />
            <p className="mt-1 text-[1.0625rem] font-extrabold text-foreground">{labels.newSubject}</p>
            <p className="text-[0.8125rem] font-medium leading-snug text-muted-foreground">{labels.newSubjectDesc}</p>
          </Link>
        </section>

        {/* ── The allowance: rings, not sentences. Full at zero. ── */}
        <section className="kf-card rise rise-3 p-[1.125rem]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-foreground">{labels.planTitle}</h2>
            {!isPro && upgradeHref && (
              <Link
                href={upgradeHref}
                className="kf-pill pressable inline-flex items-center gap-1.5 rounded-full px-3.5 text-xs font-bold text-accent"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {labels.upgradeCta}
              </Link>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {quotas.map((q, i) => (
              <Meter
                key={q.key}
                value={q.total ? q.remaining / q.total : 0}
                glyph={meterGlyph[i] ?? null}
                tone={meterTone[i] ?? 'sky'}
                remaining={q.remaining}
                total={q.total}
                label={q.label}
                ofWord={labels.ofWord}
              />
            ))}
            <Meter
              value={subjectsLimit ? subjectsUsed / subjectsLimit : 0}
              glyph={<ClayBooksGlyph />}
              tone="sky"
              remaining={subjectsUsed}
              total={subjectsLimit}
              label={labels.subjectsUsed}
              ofWord={labels.ofWord}
            />
          </div>
        </section>

        {/* ── Pick up where you left off (register #85, 2.4). ── */}
        {continueCard && (
          <section className="kf-card rise rise-3 flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex min-w-0 items-center gap-4">
              <span className="kf-chip inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-subtle text-violet">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">{labels.continueTitle}</h2>
                {/* #121: the subject and the date are each a <bdi>. */}
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {labels.continueBody.split('{subject}')[0]}
                  <UserName inline className="font-medium text-foreground">{continueCard.subject}</UserName>
                  {labels.continueBody.split('{subject}')[1]}{' '}
                  <bdi className="whitespace-nowrap text-faint">· {continueCard.date}</bdi>
                </p>
              </div>
            </div>
            <Link
              href={continueCard.href}
              className="kf-gold pressable inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold"
            >
              {labels.continueCta}
              <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </section>
        )}

        {/* ── The path: present at zero, gone once all three are done. ── */}
        {stepsLeft > 0 && (
          <section className="kf-card rise rise-3 p-5">
            <div className="flex items-center gap-4">
              <SparkBook size={64} className="shrink-0" />
              <h2 className="text-base font-extrabold text-foreground">{labels.startTitle}</h2>
            </div>
            <ol className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {onboarding.map((step, i) => {
                const Icon = [Plus, Upload, MessageCircle][i] ?? Plus;
                const tile = ['bg-mint-subtle text-mint', 'bg-sky-subtle text-sky', 'bg-violet-subtle text-violet'][i] ?? 'bg-accent-subtle text-accent';
                return (
                  <li key={step.key}>
                    <Link
                      href={step.href}
                      className="kf-tile pressable liftable group flex h-full items-center gap-3 p-4 sm:flex-col sm:items-start"
                    >
                      <span className={step.done ? 'kf-gold-sm inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl' : `kf-chip inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tile}`}>
                        {step.done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-foreground">
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

        {/* ── The subjects: a header with two links, then clay rows. ── */}
        <section className="rise rise-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="text-xl font-extrabold text-foreground">{labels.subjects}</h2>
            <div className="flex items-center gap-3">
              <Link href={subjectsHref} className="kf-all-link inline-flex min-h-[2.75rem] items-center text-sm font-semibold underline underline-offset-4">
                {labels.allSubjects}
              </Link>
              <Link href={newSubjectHref} className="kf-pill pressable inline-flex items-center gap-1.5 rounded-full px-3.5 text-sm font-bold text-foreground">
                <ClayPlus />
                {labels.newSubject}
              </Link>
            </div>
          </div>

          {subjects.length === 0 ? (
            <div className="kf-card flex flex-col items-center p-6 text-center">
              <EmptyShelf size={88} title={labels.noSubjects} />
              <p className="mt-2 text-sm font-bold text-foreground">{labels.noSubjects}</p>
              <p className="mt-1 text-sm text-muted-foreground">{labels.noSubjectsDesc}</p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {subjects.map((s, i) => {
                // #129 (b): `materials` is the progress base (failed and no-text
                // files left out). 0 means nothing to measure: a hyphen, not 0%
                // or 100%, and no "0 of 0".
                const none = s.materials === 0;
                const pct = none ? 0 : Math.min(1, s.summarised / s.materials);
                const count = en
                  ? `${s.summarised} ${labels.ofWord} ${s.materials} ${labels.materialsWord}`
                  : `${labels.materialsWord} ${s.summarised} ${labels.ofWord} ${s.materials}`;
                return (
                  <li key={s.id}>
                    <Link href={`${subjectsHref}/${s.id}`} className="kf-row pressable flex items-center gap-3.5 px-4 py-3.5">
                      <span className={`kf-tint-${(i % 3) + 1} inline-flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-[1.0625rem]`}>
                        <ClayBook index={i} />
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <UserName as="p" className="truncate text-base font-bold text-foreground">{s.name}</UserName>
                          <p className="whitespace-nowrap text-[0.8125rem] font-medium text-muted-foreground">{none ? '-' : count}</p>
                        </div>
                        <div role="img" aria-label={none ? '-' : count} data-kf-progress={none ? '' : Math.round(pct * 100)} className="kf-track h-2 overflow-hidden rounded-full">
                          <div className="bar-fill h-full rounded-full bg-accent" style={{ width: `${Math.round(pct * 100)}%` }} />
                        </div>
                      </div>
                      <ClayChevron className="shrink-0 rtl:-scale-x-100" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Stats as clay tiles, each with its own tint. ── */}
        <section className="rise rise-4 grid grid-cols-3 gap-3">
          {stats.map(({ label, value, desc }, i) => {
            const Icon = [BookOpen, FileText, MessageCircle][i] ?? BookOpen;
            const tile = ['bg-sky-subtle text-sky', 'bg-mint-subtle text-mint', 'bg-violet-subtle text-violet'][i] ?? 'bg-accent-subtle text-accent';
            return (
              <div key={label} className="kf-card p-4">
                <span className={`kf-chip inline-flex h-9 w-9 items-center justify-center rounded-xl ${tile}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-3 text-2xl font-extrabold leading-none text-foreground">{value}</p>
                <p className="mt-1 text-xs font-medium text-foreground">{label}</p>
                <p className="hidden text-[11px] text-faint sm:block">{desc}</p>
              </div>
            );
          })}
        </section>

        {/* ── What KnowFlow does: three tiles with an icon each. ── */}
        <section className="kf-card rise rise-5 p-5">
          <h2 className="text-sm font-bold text-foreground">{labels.whatTitle}</h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {labels.whatLines.map((line, i) => {
              const Icon = [FileText, BookOpen, MessageCircle][i] ?? FileText;
              const tile = ['bg-mint-subtle text-mint', 'bg-coral-subtle text-coral', 'bg-sky-subtle text-sky'][i] ?? 'bg-accent-subtle text-accent';
              return (
                <li key={line} className="kf-tile flex items-start gap-3 p-4">
                  <span className={`kf-chip inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tile}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm text-muted-foreground">{line}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Recent activity ── */}
        <section className="kf-card rise rise-5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <span className="kf-chip inline-flex h-8 w-8 items-center justify-center rounded-lg bg-coral-subtle text-coral">
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
