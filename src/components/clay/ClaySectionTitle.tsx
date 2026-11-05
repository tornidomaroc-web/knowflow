import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A Settings section's title in design "C" (PR 2's Preferences card,
 * Prefs.dc.html, now every section: PR 3): a 36 pt clay tile that says what
 * the section is, then its name at 17 pt, weight 800. The picture is
 * decorative (aria-hidden in ClayIcons); the heading carries the name.
 * `className` sets the colour where the section's meaning is a warning (the
 * account deletion card's danger red).
 */
export function ClaySectionTitle({ icon, children, className }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <h2 className={cn('flex items-center gap-2.5 text-[1.0625rem] font-extrabold text-foreground', className)}>
      <span className="section-icon inline-flex shrink-0">{icon}</span>
      {children}
    </h2>
  );
}
