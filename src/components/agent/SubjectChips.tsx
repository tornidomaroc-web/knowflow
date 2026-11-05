'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui';
import { ClayAskArt, ClayUploadGlyph } from '@/components/clay/ClayIcons';
import { UserName } from '@/components/ui/UserName';

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
  // 44 pt tall (min-h-11): the iOS tap target. The chips were 34 px (20 px
  // line, 6 px padding each side, 1 px borders) and stayed so only while the
  // store shot ar/04 needed them (Store-Shots-1); the screenshots are uploaded,
  // so the target wins. Height, not font: the text stays text-sm, centred.
  //
  // Design "C", PR 4 (the owner's review of #305): a chip cut at the bar's
  // edge said nothing about the bar scrolling. The edge that hides chips now
  // fades out (a mask, paint only: no blur, the chips keep their 44 pt), and
  // only that edge: the scroll position is read in physical pixels, so the
  // fade is on the right side in RTL and in LTR, and moves as the bar scrolls.
  const ref = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const kids = [...el.children].map((c) => c.getBoundingClientRect());
    // A chip that runs past the padding box on a side is hidden there.
    const left = kids.some((k) => k.left < r.left - 0.5);
    const right = kids.some((k) => k.right > r.right + 0.5);
    setFade((f) => (f.left === left && f.right === right ? f : { left, right }));
  }, []);
  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', measure); };
  }, [measure, subjects.length]);
  const mask = fade.left || fade.right
    ? `linear-gradient(to right, ${fade.left ? 'transparent' : '#000'} 0, #000 ${fade.left ? '2.5rem' : '0'}, #000 calc(100% - ${fade.right ? '2.5rem' : '0px'}), ${fade.right ? 'transparent' : '#000'} 100%)`
    : undefined;
  return (
    // Design "C", PR 4: the chosen subject is the gold clay pill, the others
    // surface clay pills; no edges. The row pads its own shadows so the
    // horizontal scroll does not clip them.
    <div
      ref={ref}
      data-kf-chips=""
      data-kf-fade={[fade.left && 'left', fade.right && 'right'].filter(Boolean).join(' ') || undefined}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      className="-my-2 flex min-w-0 flex-1 gap-2 overflow-x-auto px-2 py-2"
    >
      {subjects.map((kb) => (
        <button
          key={kb.id}
          type="button"
          onClick={() => onPick(kb.id)}
          aria-pressed={selectedId === kb.id}
          className={cn(
            'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selectedId === kb.id
              ? 'kf-gold'
              : 'kf-pill text-foreground',
          )}
        >
          <UserName>{kb.name}</UserName>
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
        <ClayAskArt width={96} height={96} data-kf-clay-art="empty-ask" />
        <p className="mt-4 text-base font-semibold text-foreground">{labels.title}</p>
        <Link href={href} className={cn(buttonVariants({ variant: 'primary' }), 'mt-4')}>
          <ClayUploadGlyph width={24} height={24} />
          {labels.cta}
        </Link>
      </div>
    </div>
  );
}
