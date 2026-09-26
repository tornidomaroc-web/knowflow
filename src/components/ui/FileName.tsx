import { cn } from '@/lib/utils';
import { splitFileNameForDisplay } from '@/lib/file-name-display';

/**
 * The ONE way a file name reaches the screen. Register #124.
 *
 * Every site that shows a material's name renders this, so the bidi rule in
 * `@/lib/file-name-display` cannot be forgotten by a new screen: the head of
 * the name (up to its last right-to-left letter) keeps the browser's handling,
 * and the tail (the digit run, the dot, the extension) is one left-to-right
 * isolate, placed after the head in reading order. `<bdi>` does the isolating;
 * no control character is inserted, so the rendered text IS the stored name.
 *
 * Two shapes:
 *
 * - BLOCK (the default), for a card title or a queued file: a flex row whose
 *   direction is the name's own. The head truncates with its ellipsis on the
 *   correct side (left for Arabic, right for English); a short tail such as
 *   "3.pdf" or "(1).docx" never shrinks, so the extension stays visible when
 *   the name is long; a long tail (a Latin sentence after an Arabic word)
 *   truncates too, so nothing overflows.
 * - INLINE (`inline`), for a citation pill or any text with words around it:
 *   an isolating `<bdi>` with the same split inside, no layout of its own.
 *
 * The whitespace classes are `pre`, not `nowrap`: the head ends with the space
 * before the tail, and a trailing space at the end of a `nowrap` box is
 * dropped, which would glue "3.pdf" to the Arabic.
 */
export function FileName({
  name,
  className,
  inline = false,
}: {
  name: string;
  className?: string;
  inline?: boolean;
}) {
  const { head, tail, dir } = splitFileNameForDisplay(name);

  if (inline) {
    return (
      <bdi dir={dir} className={className} data-filename="">
        {head}
        {tail ? <bdi dir="ltr">{tail}</bdi> : null}
      </bdi>
    );
  }

  const shortTail = head !== '' && tail.length <= 16;
  return (
    <span dir={dir} className={cn('flex min-w-0 max-w-full', className)} data-filename="">
      {head ? <bdi className="min-w-0 overflow-hidden text-ellipsis whitespace-pre">{head}</bdi> : null}
      {tail ? (
        <bdi dir="ltr" className={shortTail ? 'shrink-0 whitespace-pre' : 'min-w-0 overflow-hidden text-ellipsis whitespace-pre'}>
          {tail}
        </bdi>
      ) : null}
    </span>
  );
}
