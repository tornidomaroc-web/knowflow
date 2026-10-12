import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import type { Locale } from '@/lib/i18n';
import type { NavLabels } from '@/components/layout/nav-items';
import type { Platform } from '@/lib/platform';
import { cn } from '@/lib/utils';

/**
 * The signed-in chrome — desktop sidebar, mobile top bar and bottom tab bar,
 * and the canvas every dashboard screen renders into — as ONE dumb component.
 *
 * Split out of `dashboard/layout.tsx` so the design preview routes
 * (`/[locale]/preview/*`, which open no Supabase client and 404 on production)
 * can render a screen INSIDE the real chrome. Before this the chrome could only
 * be looked at signed in, on production, which the standing constraints forbid
 * on a preview; the sidebar's language switch (register #83 (b)) would have
 * shipped unseen.
 *
 * Nothing here reads a cookie, a session or an entitlement: `email`, `isPro`
 * and `platform` arrive as props, and the layout is their only real source.
 *
 * STEP REDESIGN-2. The root carries `kf-clay`, the scope of the signed-in
 * clay (globals.css), in both shells. The STRUCTURE differs by shell: inside
 * the app (`platform="native"`) there is no top bar at all, the large title
 * of each screen is the header and sign out, language and appearance live in
 * Settings; the web keeps its top bar, whose buttons are its own navigation.
 * The bottom tab bar floats above the home indicator in both.
 */
export function DashboardShell({
  locale,
  email,
  isPro,
  labels,
  platform = 'web',
  activeNav,
  children,
}: {
  locale: Locale;
  email: string;
  isPro: boolean;
  labels: NavLabels & { signOut: string };
  platform?: Platform;
  /** The design previews only: which tab is active (see MobileNav). */
  activeNav?: string;
  children: ReactNode;
}) {
  const native = platform === 'native';
  // THE SHELL CARRIES NO `data-theme` OF ITS OWN (register #46). It used to
  // hardcode "dark", which #85 recorded as "the light half of the toggle" being
  // one attribute away; with a real toggle that attribute would have pinned
  // the whole app dark whatever the student chose. The theme now sits on
  // <html> (`[locale]/layout.tsx`), and everything here paints with semantic
  // utilities only, so it follows without a class change.
  return (
    <div className="kf-clay min-h-screen bg-background" data-kf-shell={platform}>
      <Sidebar userEmail={email} isPro={isPro} locale={locale} labels={labels} />
      <MobileNav userEmail={email} isPro={isPro} locale={locale} labels={labels} platform={platform} activeNav={activeNav} />
      {/*
        The content canvas for every dashboard screen. WORDING CORRECTED #85:
        this line read "The light content canvas ..." and is no longer true —
        the shell above carries data-theme and this canvas follows it. (P2.7 flip — all
        screens are migrated, so this owns the background + padding and screens
        no longer paint their own). `ms-60` offsets the desktop sidebar (mirrors
        under RTL); the mobile top/bottom padding clears the fixed bars: on the
        web the 3.5rem top bar plus the inset, inside the app only the inset
        (there is no top bar) plus a breath; below, the floating tab bar
        (0.75rem + 4.25rem + a 0.5rem gap) plus the bottom inset.
      */}
      <main
        className={cn(
          'min-h-screen bg-background p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] text-foreground md:ms-60 md:p-8',
          native ? 'pt-[calc(1.25rem+env(safe-area-inset-top))]' : 'pt-[calc(4.5rem+env(safe-area-inset-top))]',
        )}
      >
        {children}
      </main>
    </div>
  );
}
