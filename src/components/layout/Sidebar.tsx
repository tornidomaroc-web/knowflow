'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';
import type { Locale } from '@/lib/i18n';
import { getNavItems, isNavActive, type NavLabels } from './nav-items';
import { SignOutButton } from './SignOutButton';

/**
 * Desktop sidebar (md+). Fixed to the inline-start edge via logical properties
 * (`start-0`, `border-e`), so it mirrors automatically under dir="rtl" with no
 * isRtl branching. Mobile navigation lives in MobileNav.
 */
export function Sidebar({
  userEmail,
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
    <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-border bg-surface md:flex">
      <div className="flex h-16 items-center px-6">
        <Link href={`/${locale}/dashboard`} className="text-lg font-bold tracking-tight text-foreground">
          Know<span className="text-primary">Flow</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const active = isNavActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-subtle text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={userEmail}>
            {userEmail}
          </span>
          {isPro && <Badge>PRO</Badge>}
        </div>
        <SignOutButton locale={locale} label={labels.signOut} />
      </div>
    </aside>
  );
}
