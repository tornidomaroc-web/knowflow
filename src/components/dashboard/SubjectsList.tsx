import Link from 'next/link';
import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui';
import { Ring } from '@/components/ui/Ring';
import { ClayAddFile, ClayArrow, ClayBook, ClayChat, ClayEmptyShelf, ClayFile, ClayPlus, ClayQuiz, ClaySummary } from '@/components/clay/ClayIcons';
import { cn } from '@/lib/utils';
import type { SubjectStats } from '@/lib/subject-stats';
import { summarisedPercent } from '@/lib/subject-stats';
import { formatDate } from '@/lib/format-date';
import type { Locale } from '@/lib/i18n';
import { UserName } from '@/components/ui/UserName';

export interface SubjectItem {
  id: string;
  name: string;
  description: string | null;
  language: string;
  href: string;
  askHref: string;
  createdAt: string;
  stats: SubjectStats;
}

export interface SubjectsListLabels {
  title: string;
  subtitle: string;
  newSubject: string;
  emptyTitle: string;
  emptyPrompt: string;
  materials: string;
  summarised: string;
  quizzed: string;
  processing: string;
  noMaterials: string;
  lastAsked: string;
  lastAdded: string;
  created: string;
  ask: string;
  addMaterial: string;
  /** #129 (b): a subject whose files all failed or have no text has no percent; this line says why. */
  nothingToSummarise: string;
}

export interface SubjectsListProps {
  subjects: SubjectItem[];
  newHref: string;
  locale: string;
  labels: SubjectsListLabels;
}

/**
 * Subjects (register #85, SIGNED_IN_FEATURES.md 2.1). Each card says how far
 * along the course is: counts, a bar of summarised over materials, the last
 * thing that happened in it, and the two actions a student takes next. Dumb
 * and presentational; the numbers come from `subjectStats` on the server.
 *
 * A subject with no materials is not a failure state but the most common
 * state of a new account, so its card says what to do and offers only that.
 *
 * Design "C", PR 3: clay cards with no border and no divider; each subject
 * starts with the default clay book on its tint (the home's subject row),
 * the stats carry clay glyphs, the actions are clay pills, and the empty
 * screen is the clay shelf (the outline shelf drawing is gone).
 */
export function SubjectsList({ subjects, newHref, locale, labels }: SubjectsListProps) {
  return (
    <div>
      {/* Every line is balanced (text-wrap is inherited), so no card ends on a
          word alone; the design-c render asserts it. */}
      <div className="max-w-6xl space-y-6 [text-wrap:balance]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="kf-title text-2xl font-bold text-foreground md:text-3xl">{labels.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
          </div>
          <Link href={newHref} className="kf-pill pressable inline-flex items-center gap-1.5 rounded-full px-4 text-sm font-bold text-foreground">
            <ClayPlus />
            {labels.newSubject}
          </Link>
        </header>

        {subjects.length === 0 ? (
          <div data-kf-subjects-empty="" className="kf-card rise flex flex-col items-center p-8 text-center">
            <ClayEmptyShelf title={labels.emptyTitle} />
            <h2 className="mt-3 text-lg font-extrabold text-foreground">{labels.emptyTitle}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{labels.emptyPrompt}</p>
            <Link href={newHref} className={cn(buttonVariants({ variant: 'primary' }), 'mt-6 rounded-full px-6 font-bold')}>
              <ClayPlus />
              {labels.newSubject}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {subjects.map((s, i) => (
              <SubjectCard key={s.id} subject={s} locale={locale} labels={labels} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const TONES = ['accent', 'mint', 'sky', 'violet', 'coral'] as const;

function SubjectCard({ subject: s, locale, labels, index }: { subject: SubjectItem; locale: string; labels: SubjectsListLabels; index: number }) {
  const { stats } = s;
  const pct = summarisedPercent(stats);
  const tone = TONES[index % TONES.length];
  const empty = stats.materials === 0;
  const when = stats.lastActivityAt ?? s.createdAt;
  const whenLabel = stats.lastActivityAt ? (stats.lastActivityIsAsk ? labels.lastAsked : labels.lastAdded) : labels.created;

  return (
    <article data-kf-subject-card="" className={`kf-card liftable rise rise-${Math.min(index + 1, 5)} flex flex-col p-4 md:p-5`}>
      {/* Design "C", PR 3 (the owner's review of #303): on a phone the ring sits
          in the title row and the language pill under the name, so no row is
          left with the ring alone; from sm the 1280 layout stands (the pill in
          the title row, the ring beside the tiles). */}
      <div className="flex items-center gap-3.5">
        <span data-kf-subject-icon="" className={`kf-tint-${(index % 3) + 1} inline-flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-[1.0625rem]`}>
          <ClayBook index={index} />
        </span>
        <Link href={s.href} className="flex min-h-[2.75rem] min-w-0 flex-1 flex-col justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <UserName as="h2" className="truncate text-lg font-extrabold text-foreground">{s.name}</UserName>
          {/* The description is the student's own text, isolated as a name is
              (UserName), so an Arabic line beside Latin words keeps its order. */}
          {s.description ? <UserName as="p" className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{s.description}</UserName> : null}
          <span className="kf-pill mt-1.5 inline-flex h-6 w-fit items-center rounded-full px-2 text-[0.6875rem] font-bold uppercase text-muted-foreground sm:hidden">{s.language}</span>
        </Link>
        {!empty && pct !== null && (
          <span data-kf-ring-phone="" className="shrink-0 sm:hidden">
            <Ring value={pct / 100} size={52} stroke={5} tone={tone} label={`${pct}% ${labels.summarised}`}>
              <span className="text-xs font-bold text-foreground">{pct}%</span>
            </Ring>
          </span>
        )}
        <span className="kf-pill hidden h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-bold uppercase text-muted-foreground sm:inline-flex">{s.language}</span>
      </div>

      {empty ? (
        <p className="kf-well mt-4 rounded-xl bg-raised p-4 text-sm text-muted-foreground">{labels.noMaterials}</p>
      ) : (
        <>
          {/* The ring is the progress (VISUAL_LANGUAGE.md rule 2): summarised over
              materials, the home's measure, with the percent inside it. */}
          {/* From sm the ring stands beside the tiles (three labels next to a 64 pt
              ring clipped at 375 pt, #122, so on a phone it is in the title row). */}
          <div className="mt-4 flex items-center gap-4">
            {pct !== null && (
              <span className="hidden shrink-0 sm:block">
                <Ring value={pct / 100} size={64} stroke={6} tone={tone} label={`${pct}% ${labels.summarised}`}>
                  <span className="text-sm font-bold text-foreground">{pct}%</span>
                </Ring>
              </span>
            )}
            <dl className="grid w-full flex-1 grid-cols-3 gap-2">
              <Stat icon={<ClayFile width={16} height={16} />} value={stats.materials} label={labels.materials} />
              <Stat icon={<ClaySummary width={16} height={16} />} value={stats.summarised} label={labels.summarised} />
              <Stat icon={<ClayQuiz width={16} height={16} />} value={stats.quizzed} label={labels.quizzed} />
            </dl>
          </div>
          {/* #129 (b): when every file failed or has no text there is nothing a
              summary can ever cover, so there is no percent: not 0% (a promise of
              work the student can do) nor 100%. The card says so in words instead
              of the old ring with a dash (the owner's review of #303). */}
          {pct === null && (
            <p data-kf-nothing-to-summarise="" className="kf-well mt-3 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground">{labels.nothingToSummarise}</p>
          )}
          {stats.processing > 0 && (
            <p className="mt-2 text-xs text-warning">
              {stats.processing} {labels.processing}
            </p>
          )}
        </>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-faint">
          {whenLabel} <bdi>{formatDate(when, locale as Locale)}</bdi>
        </span>
        <div className="flex items-center gap-2">
          {/* #129 (c): Ask only for a subject with a file it can answer from. */}
          {stats.ready > 0 && (
            <Link href={s.askHref} className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'rounded-full px-4 font-bold')}>
              <ClayChat width={18} height={18} />
              {labels.ask}
            </Link>
          )}
          <Link href={s.href} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'min-w-[2.75rem] rounded-full font-bold')}>
            {empty ? <ClayAddFile width={20} height={20} /> : <ClayArrow className="rtl:-scale-x-100" />}
            {empty ? labels.addMaterial : null}
            {empty ? null : <span className="sr-only">{s.name}</span>}
          </Link>
        </div>
      </div>
    </article>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="kf-tile p-3">
      {/* Below sm the icon sits above its label: beside it, "Summarised" did
          not fit a third of a 390 pt card once the icon kept its size. */}
      <dt className="flex flex-col items-start gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-1.5">
        {/* A fixed box that never shrinks beside a long label ("Summarised" at
            390 pt squeezed the glyph to a 2 pt sliver; the owner's review of #303). */}
        <span data-kf-stat-icon="" className="inline-flex h-4 w-4 shrink-0">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-bold leading-none text-foreground">{value}</dd>
    </div>
  );
}
