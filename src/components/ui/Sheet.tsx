'use client';

import { cn } from '@/lib/utils';
import { useEffect, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Physical side; callers pick based on RTL for start/end drawers. */
  side?: 'left' | 'right' | 'bottom';
  className?: string;
  label?: string;
  children: ReactNode;
}

/**
 * Lightweight controlled drawer. Overlay-click and Escape close it; aria-modal
 * is set. NOTE: no focus trap yet — acceptable for the current mobile drawers;
 * revisit when a Sheet hosts complex interactive content.
 */
export function Sheet({ open, onClose, side = 'bottom', className, label, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          'absolute bg-surface text-foreground shadow-card transition-transform duration-200',
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
