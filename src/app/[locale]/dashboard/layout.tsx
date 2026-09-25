import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PasswordReplacedNotice } from '@/components/dashboard/PasswordReplacedNotice';
import { createClient } from '@/lib/supabase/server';
import { getEntitlement } from '@/lib/entitlement';
import { PASSWORD_REPLACED_COOKIE } from '@/lib/auth/password-replaced';
import { redirect } from 'next/navigation';
import { Locale, useTranslation, resolveLocale } from '@/lib/i18n';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const safeLocale: Locale = resolveLocale(locale);
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

  // Set by /api/auth/callback when Google sign-in has just taken over an
  // unconfirmed password account. It lives in the LAYOUT rather than the home
  // page so the notice still reaches a user whose landing resolved to any other
  // dashboard screen. <PasswordReplacedNotice/> clears it on mount, which is
  // what makes it one-shot; a Server Component cannot clear a cookie itself.
  const cookieStore = await cookies();
  const passwordReplaced =
    cookieStore.get(PASSWORD_REPLACED_COOKIE)?.value === '1';

  const labels = {
    dashboard: t.dashboard.nav.dashboard,
    knowledge: t.dashboard.nav.knowledge,
    agent: t.dashboard.nav.agent,
    settings: t.dashboard.nav.settings,
    appearance: t.nav.appearance,
    themeDark: t.nav.themeDark,
    themeLight: t.nav.themeLight,
    signOut: t.dashboard.nav.signOut,
  };

  return (
    <DashboardShell locale={safeLocale} email={user.email || ''} isPro={isPro} labels={labels}>
      {passwordReplaced && (
        <PasswordReplacedNotice
          locale={safeLocale}
          labels={t.dashboard.passwordReplaced}
        />
      )}
      {children}
    </DashboardShell>
  );
}
