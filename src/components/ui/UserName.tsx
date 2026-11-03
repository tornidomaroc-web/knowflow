import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A name the student typed (a subject's name), shown inside Arabic or English
 * UI. The fix for the 2026-11-03 phone test, Arabic UI: a Latin subject name
 * was cut at its START ("…N11 PROD CHECK 2026-08-10"), and in an Ask
 * suggestion the Latin name broke across two lines, so the sentence's full
 * stop sat against the front of a Latin word (".CHECK 2026-08-10").
 *
 * Two shapes, like FileName (file names keep FileName, which also handles the
 * extension):
 *
 * - BLOCK (the default): the element that holds only the name. `dir="auto"`
 *   gives it the name's own direction, so `truncate` cuts a Latin name at its
 *   right-hand end and an Arabic name at its left-hand end, and neutral
 *   characters at either end ("C++", "(1)") stay where the name puts them. The
 *   alignment stays the page's: right in Arabic, left in English, as before.
 * - INLINE (`inline`): a name inside a sentence. An isolating `<bdi>`, so the
 *   sentence's punctuation keeps the sentence's direction, laid out as one
 *   inline block so the name never breaks across lines; a name wider than the
 *   line takes a line of its own and wraps inside, never overflowing.
 *
 * Display only. No character is added: the rendered text is the stored name.
 */
export function UserName({
  children,
  as: Tag = 'span',
  inline = false,
  className,
}: {
  children: ReactNode;
  as?: 'span' | 'p' | 'h1' | 'h2';
  inline?: boolean;
  className?: string;
}) {
  if (inline) {
    return (
      <bdi dir="auto" className={cn('inline-block max-w-full', className)} data-username="">
        {children}
      </bdi>
    );
  }
  return (
    <Tag dir="auto" className={cn('rtl:text-right ltr:text-left', className)} data-username="">
      {children}
    </Tag>
  );
}
