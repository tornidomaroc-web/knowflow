import Link from 'next/link';
import type { ReactNode } from 'react';
import { ClayChevron } from '@/components/clay/ClayIcons';

/**
 * A Help and legal row of Settings (design "C", PR 3): a clay tile with its
 * icon, a label, an optional line under it and the chevron. Moved here from
 * SettingsPanel.tsx unchanged, so the rating row (src/components/review/
 * RateRow.tsx, a client component) draws the very same tile. `mark` is an
 * inert attribute for design-c (`data-kf-link`), absent on the other rows.
 */
export function LinkRow({
  href,
  icon,
  label,
  description,
  detail,
  external = false,
  mark,
}: {
  href: string;
  icon: ReactNode;
  label: ReactNode;
  /** A line in the page's language under the label. */
  description?: ReactNode;
  /** A left-to-right value (an address) under the label. */
  detail?: string;
  external?: boolean;
  mark?: string;
}) {
  const inner = (
    <>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
        {detail && (
          <span className="block truncate text-xs text-muted-foreground" dir="ltr">
            {detail}
          </span>
        )}
      </span>
      <ClayChevron className="shrink-0 rtl:-scale-x-100" />
    </>
  );
  const className =
    // Item 4j: `active:opacity-70`, the press shows while the finger is down
    // (the rest state is unchanged; `pressable` would lower min-height here).
    'kf-tile flex min-h-[3.5rem] items-center gap-3 rounded-[1.125rem] px-3 py-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-70';
  return (
    <li {...(mark ? { 'data-kf-link': mark } : {})}>
      {external ? (
        <a href={href} className={className}>
          {inner}
        </a>
      ) : (
        <Link href={href} className={className}>
          {inner}
        </Link>
      )}
    </li>
  );
}
