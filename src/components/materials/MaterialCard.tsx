import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ClayCheck, ClayDoc, ClayTodo } from '@/components/clay/ClayIcons';
import { cn } from '@/lib/utils';
import { FileName } from '@/components/ui/FileName';
import { formatDate } from '@/lib/format-date';
import type { Locale } from '@/lib/i18n';

export interface MaterialCardLabels {
  statusReady: string;
  statusProcessing: string;
  statusError: string;
  statusNoText: string;
  noTextLine: string;
  /** Option C: "{n} of {total}" pages of a PDF have no text. */
  someNoTextLine: string;
  /** Option C: how to get the text out of photographed or scanned pages. */
  noTextFix: string;
  checklist: string;
  summaryDone: string;
  summaryTodo: string;
  quizDone: string;
  quizTodo: string;
  added: string;
  /** Step Redesign-3: the file-type label in the student's language (Arabic names the kind of file). */
  fileTypes: Record<'pdf' | 'docx' | 'pptx' | 'xlsx' | 'txt' | 'md', string>;
}

/**
 * One material as a study card (register #85, SIGNED_IN_FEATURES.md 2.2): the
 * file, its status as a chip in the student's language, when it was added,
 * and the STUDY KIT checklist, which is the thing every leading app shows and
 * this page did not: whether the summary and the quiz exist yet. The summary
 * and quiz sections, and the rename and delete controls, render inside it
 * unchanged as `children`. It shows no chunk count (register #127, the owner's
 * ruling): chunks are how Ask indexes a file, not something a student reads.
 *
 * `noText` (register #128, `hasNoText` in src/lib/material-text.ts): a ready
 * file in which no text was found does not say "ready". Its chip says it has
 * no text, one line says what to do, and there is no study kit to promise.
 * It only applies to a ready file; processing and failed files are unchanged.
 *
 * `pagesNoText` (Option C, `pagesWithoutText` in src/lib/material-text.ts):
 * a ready PDF in which SOME pages have no text keeps its ready chip and its
 * study kit (the other pages are studied), and says how many pages have no
 * text. Both that line and the no-text line are followed by one line on how
 * to get the text out of photographed or scanned pages.
 */
export function MaterialCard({
  filename,
  fileType,
  status,
  addedAt,
  locale,
  hasSummary,
  hasQuiz,
  noText = false,
  pagesNoText = null,
  anchorId,
  labels,
  children,
}: {
  filename: string;
  fileType: string | null;
  status: string;
  addedAt: string;
  locale: string;
  hasSummary: boolean;
  hasQuiz: boolean;
  noText?: boolean;
  pagesNoText?: { n: number; total: number } | null;
  /** Step Redesign-2: the id an Ask source link scrolls to (`material-<document id>`). */
  anchorId?: string;
  labels: MaterialCardLabels;
  children?: ReactNode;
}) {
  const empty = status === 'ready' && noText;
  const chip =
    empty
      // Not the processing chip's style (that one says "wait") and not the ready
      // chip's, which it matched at a glance on the preview: this file needs the
      // student to act, so it reads as the failed one does.
      ? { text: labels.statusNoText, cls: 'bg-danger-subtle text-danger' }
      : status === 'ready'
      ? { text: labels.statusReady, cls: 'bg-primary-subtle text-primary' }
      : status === 'error'
        ? { text: labels.statusError, cls: 'bg-danger-subtle text-danger' }
        : { text: labels.statusProcessing, cls: 'bg-raised text-warning' };

  // A tint per file type (VISUAL_LANGUAGE.md rule 4), so a list of materials
  // reads as a shelf of different things, not a column of identical tiles.
  // Design "C", PR 3: the tint is the clay page's tone; the tile behind it
  // keeps the type's subtle ground and the label its colour.
  const tile =
    fileType === 'pdf' ? 'bg-coral-subtle text-coral'
    : fileType === 'pptx' ? 'bg-violet-subtle text-violet'
    : fileType === 'docx' ? 'bg-sky-subtle text-sky'
    : fileType === 'xlsx' ? 'bg-mint-subtle text-mint'
    : 'bg-accent-subtle text-accent';
  const tone =
    fileType === 'pdf' ? 'peach'
    : fileType === 'pptx' ? 'violet'
    : fileType === 'docx' ? 'blue'
    : fileType === 'xlsx' ? 'green'
    : 'gold';
  // Step Redesign-3: the label from the dictionary, so the Arabic layout reads
  // "مستند" where it read "PDF"; a type the app does not know keeps its letters.
  const typeLabel = fileType
    ? (labels.fileTypes as Record<string, string> | undefined)?.[fileType] ?? fileType.toUpperCase()
    : '';
  return (
    <article id={anchorId} data-kf-material="" className="kf-card rise p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className={`kf-chip inline-flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl ${tile}`}>
          <ClayDoc tone={tone} width={20} height={20} />
          <span className="max-w-full truncate px-0.5 text-[9px] font-bold uppercase leading-none">{typeLabel}</span>
        </span>
        <div className="min-w-0 flex-1">
          {/* Register #124: `<p dir="auto">` showed "الفصل pdf.3"; FileName keeps "3.pdf" one unit.
              Step Store-Fix-1: the title is the name without its extension; the badge shows the type. */}
          <FileName name={filename} withoutExtension className="text-sm font-semibold text-foreground" />
          <p className="mt-0.5 text-xs text-muted-foreground">
            {typeLabel} · {labels.added}{' '}
            <bdi>{formatDate(addedAt, locale as Locale)}</bdi>
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', chip.cls)}>{chip.text}</span>
      </div>

      {empty && (
        <>
          <p className="mt-3 text-sm text-danger">{labels.noTextLine}</p>
          <p className="mt-1 text-xs text-muted-foreground" data-kf-text-fix="">{labels.noTextFix}</p>
        </>
      )}

      {status === 'ready' && !empty && pagesNoText && (
        <div className="mt-3" data-kf-some-no-text="">
          <p className="flex items-start gap-1.5 text-sm text-foreground">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              {labels.someNoTextLine.replace('{n}', String(pagesNoText.n)).replace('{total}', String(pagesNoText.total))}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground" data-kf-text-fix="">{labels.noTextFix}</p>
        </div>
      )}

      {status === 'ready' && !empty && (
        <div className="kf-well mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl bg-raised px-3 py-2 text-xs">
          <span className="font-medium text-muted-foreground">{labels.checklist}</span>
          <Check done={hasSummary} done_label={labels.summaryDone} todo_label={labels.summaryTodo} />
          <Check done={hasQuiz} done_label={labels.quizDone} todo_label={labels.quizTodo} />
        </div>
      )}

      {/* THE ACTION GROUP (register #121, defect 6). The four controls each
          render a full-width button in their idle state and a panel when open;
          the grid gives the buttons equal cells, and a child that has opened a
          panel (a div where a button stood) spans the full row.
          Design "C", PR 3: two columns at every width, and below sm the two
          study buttons (`data-kf-study`, "Summarize this material" and "Quiz
          me on this material") take a row each, so neither breaks over two
          lines at 390 pt (a 158 pt half-row could not hold three words); the
          design-c render asserts one line each. */}
      <div data-kf-actions="" className="mt-3 grid grid-cols-2 gap-2 [&>[data-kf-study]:not(:has(>div))]:col-span-2 sm:[&>[data-kf-study]:not(:has(>div))]:col-span-1 [&>*:has(>div)]:col-span-full">{children}</div>
    </article>
  );
}

function Check({ done, done_label, todo_label }: { done: boolean; done_label: string; todo_label: string }) {
  return (
    // Step Redesign-2: a pill each; the one still to do is a plain pill in the
    // secondary text colour, not a faint hole (the mockup critique).
    <span className={cn('kf-pill inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-medium', done ? 'bg-surface text-success' : 'bg-surface text-muted-foreground')}>
      {done ? <ClayCheck width={14} height={14} /> : <ClayTodo />}
      {done ? done_label : todo_label}
    </span>
  );
}
