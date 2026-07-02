import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { Badge, Card, buttonVariants } from '@/components/ui';

interface SubjectItem {
  id: string;
  name: string;
  description: string | null;
  language: string;
  href: string;
  createdAt: string;
}

interface SubjectsListLabels {
  title: string;
  newSubject: string;
  emptyPrompt: string;
}

export interface SubjectsListProps {
  subjects: SubjectItem[];
  newHref: string;
  labels: SubjectsListLabels;
}

/**
 * Subjects list — dumb, presentational. Data/labels arrive as plain props
 * (hrefs pre-built by the server wrapper) so it can be reused in Phase 8.
 *
 * Like the student home, the root paints its own light canvas so every
 * heading, card, and label sits on a light surface with dark tokens — nothing
 * inherits the layout's legacy text-white, so nothing vanishes. The dark
 * <main> gutter closes with the Phase-2-end layout flip.
 */
export function SubjectsList({ subjects, newHref, labels }: SubjectsListProps) {
  return (
    <div className="rounded-2xl bg-background p-4 text-foreground md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{labels.title}</h1>
          <Link href={newHref} className={buttonVariants({ variant: 'primary' })}>
            <Plus className="h-4 w-4" />
            {labels.newSubject}
          </Link>
        </div>

        {subjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
            <p className="mb-4 text-sm text-muted-foreground">{labels.emptyPrompt}</p>
            <Link href={newHref} className={buttonVariants({ variant: 'secondary' })}>
              <Plus className="h-4 w-4" />
              {labels.newSubject}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {subjects.map((s) => (
              <Link key={s.id} href={s.href} className="group block">
                <Card className="h-full p-6 transition-colors group-hover:border-primary">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="min-w-0 truncate text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                      {s.name}
                    </h3>
                    <Badge variant="neutral" className="shrink-0 uppercase">
                      {s.language}
                    </Badge>
                  </div>
                  <p className="mb-6 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                    {s.description || ''}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
