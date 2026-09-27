'use client';

import Link from 'next/link';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui';
import { ChatPages } from '@/components/illustrations';

/**
 * Ask's subject bar (register #129 (c)): only the subjects Ask can answer
 * from. Presentational, so the preview can render it with literal subjects;
 * KBSelector owns the selection and the rule (`answerableSubjectIds`).
 * Single-subject scope: picking one switches the active subject.
 */
export function SubjectChips({
  subjects,
  selectedId,
  onPick,
}: {
  subjects: { id: string; name: string }[];
  selectedId: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {subjects.map((kb) => (
        <button
          key={kb.id}
          type="button"
          onClick={() => onPick(kb.id)}
          aria-pressed={selectedId === kb.id}
          className={cn(
            'whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
            selectedId === kb.id
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-muted-foreground hover:border-primary hover:text-foreground',
          )}
        >
          {kb.name}
        </button>
      ))}
    </div>
  );
}

/**
 * What Ask shows when the student has subjects but none holds a file it can
 * answer from (all processing, failed or with no text). Never a blank page:
 * it sends them to their subjects, where each card says what to do, and the
 * history drawer stays one tap away.
 */
export function AskNoAnswerableSubject({ href, labels }: { href: string; labels: { title: string; cta: string } }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <ChatPages size={96} title={labels.title} />
        <p className="mt-4 text-base font-semibold text-foreground">{labels.title}</p>
        <Link href={href} className={cn(buttonVariants({ variant: 'primary' }), 'mt-4')}>
          <Upload className="h-4 w-4" />
          {labels.cta}
        </Link>
      </div>
    </div>
  );
}
