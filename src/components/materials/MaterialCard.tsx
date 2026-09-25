import type { ReactNode } from 'react';
import { CheckCircle2, Circle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MaterialCardLabels {
  chunks: string;
  statusReady: string;
  statusProcessing: string;
  statusError: string;
  checklist: string;
  summaryDone: string;
  summaryTodo: string;
  quizDone: string;
  quizTodo: string;
  added: string;
}

/**
 * One material as a study card (register #85, SIGNED_IN_FEATURES.md 2.2): the
 * file, its status as a chip in the student's language, when it was added,
 * and the STUDY KIT checklist, which is the thing every leading app shows and
 * this page did not: whether the summary and the quiz exist yet. The summary
 * and quiz sections, and the rename and delete controls, render inside it
 * unchanged as `children`.
 */
export function MaterialCard({
  filename,
  fileType,
  chunkCount,
  status,
  addedAt,
  locale,
  hasSummary,
  hasQuiz,
  labels,
  children,
}: {
  filename: string;
  fileType: string | null;
  chunkCount: number;
  status: string;
  addedAt: string;
  locale: string;
  hasSummary: boolean;
  hasQuiz: boolean;
  labels: MaterialCardLabels;
  children?: ReactNode;
}) {
  const chip =
    status === 'ready'
      ? { text: labels.statusReady, cls: 'bg-primary-subtle text-primary' }
      : status === 'error'
        ? { text: labels.statusError, cls: 'bg-danger-subtle text-danger' }
        : { text: labels.statusProcessing, cls: 'bg-raised text-warning' };

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground" dir="auto">{filename}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fileType?.toUpperCase()} · {chunkCount} {labels.chunks} · {labels.added}{' '}
            {new Date(addedAt).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-GB')}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', chip.cls)}>{chip.text}</span>
      </div>

      {status === 'ready' && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-raised px-3 py-2 text-xs">
          <span className="font-medium text-muted-foreground">{labels.checklist}</span>
          <Check done={hasSummary} done_label={labels.summaryDone} todo_label={labels.summaryTodo} />
          <Check done={hasQuiz} done_label={labels.quizDone} todo_label={labels.quizTodo} />
        </div>
      )}

      {children}
    </article>
  );
}

function Check({ done, done_label, todo_label }: { done: boolean; done_label: string; todo_label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', done ? 'text-success' : 'text-faint')}>
      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
      {done ? done_label : todo_label}
    </span>
  );
}
