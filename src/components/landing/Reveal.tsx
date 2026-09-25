'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * SCROLL-DRIVEN REVEAL FOR THE LANDING (Part C, 2026-09-25).
 *
 * A section starts 16px low and transparent and rises when it enters the
 * viewport. The hidden start state exists ONLY inside
 * `@media (prefers-reduced-motion: no-preference)` (globals.css, `.reveal`),
 * so with reduced motion, without JavaScript, or in a browser with no
 * IntersectionObserver the section is simply visible: the final state is
 * the base state. The observer adds `.is-in` once and disconnects; nothing
 * runs on every scroll frame, which is what keeps a mid-range phone smooth.
 *
 * `delay` staggers siblings by tenths (0..5), mapped to `.reveal-1..5`.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: 0 | 1 | 2 | 3 | 4 | 5;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add('is-in');
            io.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const T = Tag as 'div';
  return (
    <T ref={ref as React.RefObject<HTMLDivElement>} className={`reveal${delay ? ` reveal-${delay}` : ''} ${className}`.trim()}>
      {children}
    </T>
  );
}
