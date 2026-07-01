'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';
import type { Locale } from '@/lib/i18n';
import { getNavItems, isNavActive, type NavLabels } from './nav-items';
import { SignOutButton } from './SignOutButton';

/**
 * Mobile navigation (below md): a slim top bar (brand + sign-out) and a bottom
 * tab bar (thumb-reachable, ≥44px targets, safe-area padded for the Capacitor
 * shell in Phase 8). Row order and edges mirror automatically under dir="rtl".
 */
export function MobileNav({
  isPro,
  locale,
  labels,
}: {
  userEmail: string;
  isPro?: boolean;
  locale: Locale;
  labels: NavLabels & { signOut: string };
}) {
  const pathname = usePathname();
  const items = getNavItems(locale, labels);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
        <Link href={`/${locale}/dashboard`} className="text-lg font-bold tracking-tight text-foreground">
          Know<span className="text-primary">Flow</span>
        </Link>
        <div className="flex items-center gap-2">
          {isPro && <Badge>PRO</Badge>}
          <SignOutButton locale={locale} label={labels.signOut} iconOnly />
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-surface md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {items.map((item) => {
          const active = isNavActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.7rem] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate px-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
