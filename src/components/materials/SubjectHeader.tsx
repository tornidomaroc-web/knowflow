import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui';
import { ClayChat, ClayFile, ClayQuiz, ClaySparkBook, ClaySummary } from '@/components/clay/ClayIcons';
import type { SubjectStats } from '@/lib/subject-stats';
import { UserName } from '@/components/ui/UserName';

export interface SubjectHeaderLabels {
  materials: string;
  summarised: string;
  quizzed: string;
  stillProcessing: string;
  askAbout: string;
}

/**
 * The subject page's header (register #85, SIGNED_IN_FEATURES.md 2.2): the
 * name, the description, four counts, and the one action that is the reason
 * the materials are here. Dumb; the counts come from `subjectStats`.
 *
 * Design "C", PR 2: the outline drawings are clay now (the open book, and a
 * file, a summary page and a quiz card on the three counts, the clay icons of
 * the home). The spinner beside "still processing" stays a line: it is the
 * state itself, not a picture.
 */
export function SubjectHeader({
  name,
  description,
  stats,
  askHref,
  labels,
}: {
  name: string;
  description: string | null;
  stats: SubjectStats;
  askHref: string;
  labels: SubjectHeaderLabels;
}) {
  const items = [
    { Icon: ClayFile, value: stats.materials, label: labels.materials },
    { Icon: ClaySummary, value: stats.summarised, label: labels.summarised },
    { Icon: ClayQuiz, value: stats.quizzed, label: labels.quizzed },
  ];
  return (
    <header className="kf-card rise rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <ClaySparkBook width={72} height={72} className="hidden shrink-0 sm:block" />
          <div className="min-w-0">
          <UserName as="h1" className="kf-title text-2xl font-bold text-foreground md:text-3xl">{name}</UserName>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {stats.ready > 0 && (
          <Link href={askHref} className={buttonVariants({ variant: 'primary' })}>
            <ClayChat width={20} height={20} />
            {labels.askAbout}
          </Link>
        )}
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-2 sm:max-w-md">
        {items.map(({ Icon, value, label }) => (
          <div key={label} className="kf-tile rounded-xl bg-raised p-3">
            <dt className="flex items-center gap-1.5 text-xs">
              <Icon width={18} height={18} className="shrink-0" />
              <span className="text-muted-foreground">{label}</span>
            </dt>
            <dd className="mt-1 text-2xl font-bold leading-none text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {stats.processing > 0 && (
        <p className="mt-3 inline-flex items-center gap-2 text-xs text-warning">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {stats.processing} {labels.stillProcessing}
        </p>
      )}
    </header>
  );
}
