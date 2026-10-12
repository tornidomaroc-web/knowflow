'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';
import { ENDONYM, otherLocale, switchLocaleHref, type Locale } from '@/lib/i18n';
import type { Platform } from '@/lib/platform';
import { getNavItems, isNavActive, type NavLabels } from './nav-items';
import { SignOutButton } from './SignOutButton';
import { ThemeToggle } from './ThemeToggle';
import { TAB_ICONS } from './tab-icons';

/**
 * Mobile navigation (below md). STEP REDESIGN-2: the bottom tab bar floats
 * above the home indicator as a clay slab, the active tab a gold capsule
 * with the FILLED glyph (tab-icons.tsx, Phosphor pair) and the idle ones
 * outlined; labels under every glyph. Inside the app there is NO top bar: a
 * web pattern (account, language and theme buttons on every screen) that
 * read as a website in a shell (App Review 4.2); those three live in Settings.
 * The web keeps its slim top bar, which is its own navigation.
 *
 * Both bars pad by their safe-area inset, which is non-zero only because the
 * viewport is `viewport-fit=cover` (register #96). Row order and edges mirror
 * automatically under dir="rtl".
 */
export function MobileNav({
  isPro,
  locale,
  labels,
  platform = 'web',
}: {
  userEmail: string;
  isPro?: boolean;
  locale: Locale;
  labels: NavLabels & { signOut: string };
  platform?: Platform;
}) {
  const pathname = usePathname();
  const items = getNavItems(locale, labels);
  const native = platform === 'native';

  return (
    <>
      {!native && (
        /* The top bar runs under the notch: `viewport-fit=cover` (src/lib/viewport.ts)
           makes the inset real, and the bar grows by it so its content stays
           below the sensors. Register #96, corrected. */
        <header
          className="fixed inset-x-0 top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-b border-border bg-surface px-4 pt-[env(safe-area-inset-top)] md:hidden"
        >
          <Link href={`/${locale}/dashboard`} className="text-lg font-bold tracking-tight text-foreground">
            Know<span className="text-primary">Flow</span>
          </Link>
          <div className="flex items-center gap-2">
            {/* Register #83 (b): the language switch, in the top bar so it is
                reachable from every screen without opening a menu. 44px tall.
                A plain `<a>`, so the switch is a page load the middleware
                remembers (register #136). */}
            <a
              href={switchLocaleHref(locale, pathname)}
              lang={otherLocale(locale)}
              className="inline-flex min-h-[2.75rem] items-center rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {ENDONYM[otherLocale(locale)]}
            </a>
            <ThemeToggle
              variant="icon"
              labels={{ appearance: labels.appearance, dark: labels.themeDark, light: labels.themeLight }}
            />
            {isPro && <Badge>PRO</Badge>}
            <SignOutButton locale={locale} label={labels.signOut} iconOnly />
          </div>
        </header>
      )}
      {/* The ground fades in under the floating bar, so rows do not show
          through around it. Paint only, under the bar's layer. */}
      <div aria-hidden="true" className="kf-tabfade pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(7rem+env(safe-area-inset-bottom))] md:hidden" />
      <nav
        aria-label={labels.dashboard}
        className="kf-tabbar fixed inset-x-4 z-30 flex h-[4.25rem] items-center justify-around rounded-[1.875rem] px-2 md:hidden"
        style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {items.map((item) => {
          const active = isNavActive(pathname, item);
          const glyphs = TAB_ICONS[item.key as keyof typeof TAB_ICONS];
          const Icon = active ? glyphs.fill : glyphs.outline;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-[3.75rem] min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-[1.375rem] px-1 text-[0.72rem] font-medium transition-colors',
                active ? 'kf-tab-active font-bold text-accent' : 'text-muted-foreground',
              )}
            >
              <Icon width={26} height={26} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
