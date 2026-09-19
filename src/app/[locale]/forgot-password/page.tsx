'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui';
import { AuthField } from '@/components/auth/AuthField';
import { useTranslation, Locale } from '@/lib/i18n';

/** Marker read by /api/auth/callback so a recovery landing goes to the
 *  set-a-new-password page instead of the dashboard. It rides the same browser
 *  that asked for the link, which is the only browser where the PKCE exchange
 *  can succeed anyway, so its absence never costs us a working case. */
const RECOVERY_COOKIE = 'kf_recovery';

export default function ForgotPasswordPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params);
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setRateLimited(false);

    document.cookie = `${RECOVERY_COOKIE}=1; path=/; max-age=900; samesite=lax`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback`,
    });

    // A 429 is about OUR send interval, not about whether the address exists,
    // so showing it leaks nothing and is worth showing: it is the one failure
    // the user can act on. Every other error collapses into the same neutral
    // reply as success, deliberately. See the enumeration note below.
    if (error && error.status === 429) {
      setRateLimited(true);
      setLoading(false);
      return;
    }
    if (error) console.error('resetPasswordForEmail:', error);

    // NEVER branch the visible reply on whether the address is registered.
    // Doing so turns this form into a free membership oracle for any address an
    // attacker cares to type.
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex w-full items-center justify-center bg-surface p-8">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 text-start">
          {/* #103: the product name at every width. The gold panel carried it at lg and up and is gone. */}
          {/* #105: it links to the landing. These pages had no other way back. */}
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold tracking-tight">
              <Link href={`/${locale}`} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {t.nav.home.replace('Flow', '')}<span className="text-primary">Flow</span>
              </Link>
            </h1>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">{t.auth.forgotTitle}</h2>
          <p className="mb-8 text-sm text-muted-foreground">{t.auth.forgotSubtitle}</p>

          {rateLimited && (
            <div className="rounded-xl border border-danger-border bg-danger-subtle px-4 py-3 text-sm text-danger">{t.auth.forgotRateLimited}</div>
          )}

          {sent ? (
            <div className="rounded-xl border border-primary-border bg-primary-subtle px-4 py-3 text-sm">
              <p className="font-medium text-foreground">{t.auth.forgotSent}</p>
              <p className="mt-1 text-muted-foreground">{t.auth.forgotAnyDevice}</p>
            </div>
          ) : (
            <>
              <AuthField
                label={t.auth.email}
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" disabled={loading} className={cn(buttonVariants({ variant: 'primary' }), 'mt-2 w-full')}>
                {loading ? t.auth.forgotSending : t.auth.forgotSubmit}
              </button>
            </>
          )}

          <div className="mt-6 text-center">
            <Link href={`/${locale}/login`} className="text-sm text-muted-foreground transition-colors hover:text-primary">
              {t.auth.backToLogin}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
