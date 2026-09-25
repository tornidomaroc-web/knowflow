import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import type { Locale } from '@/lib/i18n';
import type { NavLabels } from '@/components/layout/nav-items';

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
 * Nothing here reads a cookie, a session or an entitlement: `email` and
 * `isPro` arrive as props, and the layout is their only real source.
 */
export function DashboardShell({
  locale,
  email,
  isPro,
  labels,
  children,
}: {
  locale: Locale;
  email: string;
  isPro: boolean;
  labels: NavLabels & { signOut: string };
  children: ReactNode;
}) {
  // THE SHELL CARRIES NO `data-theme` OF ITS OWN (register #46). It used to
  // hardcode "dark", which #85 recorded as "the light half of the toggle" being
  // one attribute away; with a real toggle that attribute would have pinned
  // the whole app dark whatever the student chose. The theme now sits on
  // <html> (`[locale]/layout.tsx`), and everything here paints with semantic
  // utilities only, so it follows without a class change.
  return (
    <div className="min-h-screen bg-background">
      <Sidebar userEmail={email} isPro={isPro} locale={locale} labels={labels} />
      <MobileNav userEmail={email} isPro={isPro} locale={locale} labels={labels} />

      {/*
        The content canvas for every dashboard screen. WORDING CORRECTED #85:
        this line read "The light content canvas ..." and is no longer true —
        the shell above carries data-theme and this canvas follows it. (P2.7 flip — all
        screens are migrated, so this owns the background + padding and screens
        no longer paint their own). `ms-60` offsets the desktop sidebar (mirrors
        under RTL); the mobile top/bottom padding clears the fixed bars.
      */}
      <main className="min-h-screen bg-background p-4 pb-24 pt-[4.5rem] text-foreground md:ms-60 md:p-8">
        {children}
      </main>
    </div>
  );
}
