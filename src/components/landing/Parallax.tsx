'use client';

import { useEffect } from 'react';

/**
 * DEPTH ON SCROLL, CHEAPLY (Part C, 2026-09-25).
 *
 * The hero's floating shapes carry `data-depth` (0.05..0.3). On scroll they
 * translate by `scrollY × depth`, so nearer shapes move more and the page
 * gains a sense of layers. One passive scroll listener, one
 * requestAnimationFrame per scroll burst, transforms only (no layout),
 * capped at 600px of travel so the shapes never leave their section.
 *
 * Does nothing with reduced motion, on a touch-only phone narrower than
 * 768px (where a scroll is a flick and the effect reads as jitter), or when
 * there are no shapes. The shapes' base position is their final position.
 */
export function Parallax() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(max-width: 767px)').matches) return;
    const shapes = Array.from(document.querySelectorAll<HTMLElement>('[data-depth]'));
    if (shapes.length === 0) return;
    let ticking = false;
    const apply = () => {
      const y = Math.min(window.scrollY, 600);
      for (const s of shapes) {
        const depth = Number(s.dataset.depth) || 0;
        s.style.transform = `translate3d(0, ${Math.round(y * depth)}px, 0)`;
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(apply);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    apply();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return null;
}
