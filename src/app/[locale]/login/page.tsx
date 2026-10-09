'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { GoogleAccountHint } from '@/components/auth/GoogleAccountHint';
import { AppleButton } from '@/components/auth/AppleButton';
import { ChatPages } from '@/components/illustrations';
import { APPLE_SIGNIN_ENABLED } from '@/lib/auth/providers';
import { googleSignInAllowed } from '@/lib/platform';
import { usePlatform } from '@/components/platform/PlatformProvider';
import { AuthField, PasswordField } from '@/components/auth/AuthField';
import { useTranslation, Locale } from '@/lib/i18n';
import { isAuthErrorFragment, loginNotice } from '@/lib/auth/login-notice';

export default function LoginPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params);
  const t = useTranslation(locale);
  // The "or" between the provider buttons and the e-mail form exists only
  // when a provider button is shown; inside the app (STORE_PATH.md step a)
  // the Google button is hidden and Apple is not enabled yet, so the divider
  // would separate nothing. Read from the same context the button reads.
  const providerShown = googleSignInAllowed(usePlatform()) || APPLE_SIGNIN_ENABLED;
  const isRtl = locale === 'ar';

  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [noticeCode, setNoticeCode] = useState<string | null>(null);

  // Read on the client rather than with useSearchParams: this page is a client
  // component with no Suspense boundary, and useSearchParams would opt the whole
  // route out of prerendering at build time. Storing the CODE and resolving the
  // copy during render keeps the effect free of the dictionary.
  useEffect(() => {
    setNoticeCode(new URLSearchParams(window.location.search).get('notice'));
    // GoTrue's error fragment rides along from a refused mail link; take it out
    // of the address bar, keeping the path, the query and the router's state.
    if (isAuthErrorFragment(window.location.hash)) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
  }, []);

  const notice = loginNotice(noticeCode, t, locale);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(`/${locale}/dashboard`);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* The landing's depth, quietly (review #122, defect 7): two tinted shapes
          behind the form at #109's 0.08, and the page rises in like every
          other screen. The form itself is unchanged in what it asks. */}
      <div aria-hidden="true" className="hero-float pointer-events-none absolute z-0" style={{ top: '-8rem', insetInlineEnd: '-8rem', width: '24rem', height: '24rem', opacity: 0.08, background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)' }} />
      <div aria-hidden="true" className="hero-float hero-float-2 pointer-events-none absolute z-0" style={{ bottom: '-8rem', insetInlineStart: '-8rem', width: '20rem', height: '20rem', opacity: 0.08, background: 'radial-gradient(circle, var(--violet) 0%, transparent 70%)' }} />
      <div className="relative z-10 flex w-full items-center justify-center bg-surface/0 p-6 sm:p-8">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-6 text-start">
          {/* #103: the product name at every width. The gold panel carried it at lg and up and is gone. */}
          {/* #105: it links to the landing. These pages had no other way back. */}
          <div className="rise mb-8 flex flex-col items-center text-center">
            <ChatPages size={88} className="mb-3" />
            <h1 className="text-4xl font-bold tracking-tight">
              <Link href={`/${locale}`} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {t.nav.home.replace('Flow', '')}<span className="text-primary">Flow</span>
              </Link>
            </h1>
          </div>
          <h2 className="rise rise-1 text-3xl font-semibold tracking-tight">{t.auth.loginTitle}</h2>
          <p className="rise rise-1 mb-8 text-sm text-muted-foreground">{t.auth.loginSubtitle}</p>

          {error && <div className="rounded-xl border border-danger-border bg-danger-subtle px-4 py-3 text-sm text-danger">{error}</div>}

          {notice && (
            <div className="rounded-xl border border-primary-border bg-primary-subtle px-4 py-3 text-sm text-foreground">
              {notice.text}
              {notice.link && (
                <Link href={notice.link.href} className="mt-1 block w-fit font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {notice.link.label}
                </Link>
              )}
            </div>
          )}

          {/*
            ABOVE the email fields, not below them, and the placement is a
            judgement about a phone rather than about symmetry. This form is two
            text inputs deep on a small screen with a keyboard covering half of
            it. A student who has a Google account is one tap from being signed
            in, and burying that under the thing it replaces means scrolling past
            a form they were never going to fill in. The email path stays exactly
            where it was for everyone who already has a password here.
          */}
          <GoogleButton label={t.auth.googleLogin} errorLabel={t.auth.googleFailed} />
          {/* Apple guideline 4.8: Apple's own sign-in beside Google, with the same
              weight. Shown only once the provider is enabled (#119, #121):
              NEXT_PUBLIC_APPLE_SIGNIN=enabled, set by the owner after the console
              steps, and the button appears on the next build. */}
          {APPLE_SIGNIN_ENABLED && <AppleButton label={t.auth.appleLogin} errorLabel={t.auth.appleFailed} />}

          {providerShown && (
            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">{t.auth.orDivider}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          )}

          <div className="space-y-4">
            <AuthField
              label={t.auth.email}
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <PasswordField
              label={t.auth.password}
              showLabel={t.auth.showPassword}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className={cn(buttonVariants({ variant: 'primary' }), 'mt-6 w-full')}>
            {loading ? t.auth.loggingIn : t.auth.loginButton}
          </button>

          <div className="text-center">
            <Link href={`/${locale}/forgot-password`} className="text-sm text-muted-foreground transition-colors hover:text-primary">
              {t.auth.forgotLink}
            </Link>
          </div>
          <GoogleAccountHint text={t.auth.googleAccountHint} forgotLabel={t.auth.forgotLink} forgotHref={`/${locale}/forgot-password`} />
          <div className="mt-6 text-center">
            <Link href={`/${locale}/signup`} className="text-sm text-muted-foreground transition-colors hover:text-primary">
              {t.auth.noAccount}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
