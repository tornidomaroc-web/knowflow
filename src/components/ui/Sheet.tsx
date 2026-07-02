'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Physical side; callers pick based on RTL for start/end drawers. */
  side?: 'left' | 'right' | 'bottom';
  className?: string;
  label?: string;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Lightweight controlled drawer. Overlay-click and Escape close it; aria-modal
 * is set; and while open it TRAPS focus (P2.4): focus moves into the panel on
 * open, Tab/Shift+Tab cycle within it, and focus is restored to the trigger on
 * close. Required now that Sheet hosts the interactive conversation drawer.
 */
export function Sheet({ open, onClose, side = 'bottom', className, label, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the open effect on every parent
  // render (callers pass inline arrows), which would otherwise re-steal focus.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];

    // Move focus into the panel (first focusable, else the panel itself).
    (focusables()[0] ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  const panelPos =
    side === 'bottom'
      ? 'inset-x-0 bottom-0 rounded-t-2xl'
      : side === 'left'
        ? 'inset-y-0 left-0 h-full w-80 max-w-[85%]'
        : 'inset-y-0 right-0 h-full w-80 max-w-[85%]';

  const panelClosed =
    side === 'bottom' ? 'translate-y-full' : side === 'left' ? '-translate-x-full' : 'translate-x-full';

  return (
    <div className={cn('fixed inset-0 z-50', !open && 'pointer-events-none')} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={cn('absolute inset-0 bg-black/40 transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0')}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'absolute bg-surface text-foreground shadow-card outline-none transition-transform duration-200',
          panelPos,
          open ? 'translate-x-0 translate-y-0' : panelClosed,
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
