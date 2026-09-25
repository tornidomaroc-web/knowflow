import Link from 'next/link';
import { BookOpen, FileText, ListChecks, Loader2, MessageCircle } from 'lucide-react';
import { buttonVariants } from '@/components/ui';
import { SparkBook } from '@/components/illustrations';
import type { SubjectStats } from '@/lib/subject-stats';

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
    { icon: FileText, value: stats.materials, label: labels.materials },
    { icon: BookOpen, value: stats.summarised, label: labels.summarised },
    { icon: ListChecks, value: stats.quizzed, label: labels.quizzed },
  ];
  return (
    <header className="rise rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <SparkBook size={72} className="hidden shrink-0 sm:block" />
          <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">{name}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {stats.ready > 0 && (
          <Link href={askHref} className={buttonVariants({ variant: 'primary' })}>
            <MessageCircle className="h-4 w-4" />
            {labels.askAbout}
          </Link>
        )}
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-2 sm:max-w-md">
        {items.map(({ icon: Icon, value, label }, i) => (
          <div key={label} className="rounded-xl bg-raised p-3">
            <dt className={`flex items-center gap-1.5 text-xs ${['text-sky', 'text-mint', 'text-violet'][i] ?? 'text-muted-foreground'}`}>
              <Icon className="h-3.5 w-3.5" />
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
