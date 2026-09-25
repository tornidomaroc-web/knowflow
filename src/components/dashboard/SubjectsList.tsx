import Link from 'next/link';
import { ArrowRight, BookOpen, FileText, ListChecks, MessageCircle, Plus, Upload } from 'lucide-react';
import { Badge, buttonVariants } from '@/components/ui';
import { Ring } from '@/components/ui/Ring';
import { EmptyShelf } from '@/components/illustrations';
import { cn } from '@/lib/utils';
import type { SubjectStats } from '@/lib/subject-stats';
import { summarisedPercent } from '@/lib/subject-stats';
import { formatDate } from '@/lib/format-date';
import type { Locale } from '@/lib/i18n';

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
 */
export function SubjectsList({ subjects, newHref, locale, labels }: SubjectsListProps) {
  return (
    <div>
      <div className="max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">{labels.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
          </div>
          <Link href={newHref} className={buttonVariants({ variant: 'primary' })}>
            <Plus className="h-4 w-4" />
            {labels.newSubject}
          </Link>
        </header>

        {subjects.length === 0 ? (
          <div className="rise flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
            <EmptyShelf size={112} title={labels.emptyTitle} />
            <h2 className="mt-4 text-lg font-semibold text-foreground">{labels.emptyTitle}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{labels.emptyPrompt}</p>
            <Link href={newHref} className={cn(buttonVariants({ variant: 'primary' }), 'mt-6')}>
              <Plus className="h-4 w-4" />
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
    <article className={`liftable rise rise-${Math.min(index + 1, 5)} flex flex-col rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary`}>
      <div className="flex items-start justify-between gap-3">
        <Link href={s.href} className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <h2 className="truncate text-lg font-semibold text-foreground">{s.name}</h2>
          {s.description ? <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{s.description}</p> : null}
        </Link>
        <Badge variant="neutral" className="shrink-0 uppercase">{s.language}</Badge>
      </div>

      {empty ? (
        <p className="mt-4 rounded-xl bg-raised p-4 text-sm text-muted-foreground">{labels.noMaterials}</p>
      ) : (
        <>
          {/* The ring is the progress (VISUAL_LANGUAGE.md rule 2): summarised over
              materials, the home's measure, with the percent inside it. */}
          <div className="mt-4 flex items-center gap-4">
            <Ring value={pct / 100} size={64} stroke={6} tone={tone} label={`${pct}% ${labels.summarised}`}>
              <span className="text-sm font-bold text-foreground">{pct}%</span>
            </Ring>
            <dl className="grid flex-1 grid-cols-3 gap-2">
              <Stat icon={FileText} value={stats.materials} label={labels.materials} />
              <Stat icon={BookOpen} value={stats.summarised} label={labels.summarised} />
              <Stat icon={ListChecks} value={stats.quizzed} label={labels.quizzed} />
            </dl>
          </div>
          {stats.processing > 0 && (
            <p className="mt-2 text-xs text-warning">
              {stats.processing} {labels.processing}
            </p>
          )}
        </>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-xs text-faint">
          {whenLabel} <bdi>{formatDate(when, locale as Locale)}</bdi>
        </span>
        <div className="flex items-center gap-2">
          {!empty && (
            <Link href={s.askHref} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
              <MessageCircle className="h-4 w-4" />
              {labels.ask}
            </Link>
          )}
          <Link href={s.href} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            {empty ? <Upload className="h-4 w-4" /> : <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />}
            {empty ? labels.addMaterial : null}
            {empty ? null : <span className="sr-only">{s.name}</span>}
          </Link>
        </div>
      </div>
    </article>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof FileText; value: number; label: string }) {
  return (
    <div className="rounded-xl bg-raised p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-bold leading-none text-foreground">{value}</dd>
    </div>
  );
}
