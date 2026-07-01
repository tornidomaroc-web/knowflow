import { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { createClient } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/entitlement';
import { redirect } from 'next/navigation';
import { Locale, locales, useTranslation } from '@/lib/i18n';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const safeLocale: Locale = locales.includes(locale) ? locale : 'en';
  const t = useTranslation(safeLocale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${safeLocale}/login`);
  }

  // Derive entitlement via getEntitlement (single source of truth), not a raw
  // subscription.status === 'pro' check: the webhook now writes faithful Paddle
  // statuses ('active'/'trialing'/'past_due'), so a === 'pro' check would show
  // paying users as free. getEntitlement also uses maybeSingle internally, so a
  // user with no subscription row resolves to free instead of throwing.
  const { tier } = await getEntitlement(user.id);
  const isPro = tier === 'pro';

  const labels = {
    dashboard: t.dashboard.nav.dashboard,
    knowledge: t.dashboard.nav.knowledge,
    agent: t.dashboard.nav.agent,
    settings: t.dashboard.nav.settings,
    signOut: t.dashboard.nav.signOut,
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar userEmail={user.email || ''} isPro={isPro} locale={safeLocale} labels={labels} />
      <MobileNav userEmail={user.email || ''} isPro={isPro} locale={safeLocale} labels={labels} />

      {/*
        Content stays on the LEGACY dark surface until each screen is migrated
        (P2.2+). Flipping it light now would hide the un-redesigned screens'
        hardcoded white text. `ms-60` offsets the desktop sidebar (mirrors under
        RTL); the mobile top/bottom padding clears the fixed bars.
      */}
      <main className="min-h-screen bg-[var(--bg-color)] p-4 pb-24 pt-[4.5rem] text-white md:ms-60 md:p-8">
        {children}
      </main>
    </div>
  );
}
