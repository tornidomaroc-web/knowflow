'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { GoogleAccountHint } from '@/components/auth/GoogleAccountHint';
import { AppleButton } from '@/components/auth/AppleButton';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { ClayDefs } from '@/components/clay/ClayIcons';
import { APPLE_SIGNIN_ENABLED } from '@/lib/auth/providers';
import { googleSignInAllowed } from '@/lib/platform';
import { usePlatform } from '@/components/platform/PlatformProvider';
import { AuthField, PasswordField } from '@/components/auth/AuthField';
import { useTranslation, Locale } from '@/lib/i18n';
import { isAuthErrorFragment, loginNotice } from '@/lib/auth/login-notice';
import { authErrorMessage } from '@/lib/auth/auth-error';

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
      // Audit cause #8: our sentence in the page's language, by code (src/lib/auth/auth-error.ts), never GoTrue's English.
      setError(authErrorMessage(error, 'login', t, locale));
      setLoading(false);
    } else {
      router.push(`/${locale}/dashboard`);
    }
  };

  return (
    // Design "C", PR 2 (the owner-approved artboard Login.dc.html): the real
    // app icon as a dark tile, the title, the provider button and the "or"
    // (web only), then ONE clay card holding the fields, the forgot link and
    // the gold button; the way to sign up under it. What the page does is
    // unchanged: the same handler, strings, notices, errors and redirect.
    <div className="kf-site flex min-h-screen justify-center bg-background" dir={isRtl ? 'rtl' : 'ltr'}>
      <ClayDefs />
      <form onSubmit={handleLogin} className="flex w-full max-w-sm flex-col gap-3.5 px-5 pb-7 pt-10 text-start">
        {/* #105: the icon links to the landing, the way back these pages had no
            other way to. It names the product for a screen reader (#103). */}
        <div className="rise flex flex-col items-center gap-3 text-center">
          <Link href={`/${locale}`} aria-label={t.nav.home} className="rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BrandIcon size={84} radius={24} />
          </Link>
          <h1 className="rise rise-1 mt-1 text-[1.875rem] font-extrabold leading-tight text-foreground">{t.auth.loginTitle}</h1>
          <p className="rise rise-1 text-base font-medium text-muted-foreground">{t.auth.loginSubtitle}</p>
        </div>

        {error && <div className="rounded-2xl border border-danger-border bg-danger-subtle px-4 py-3 text-sm text-danger [text-wrap:balance]">{error}</div>}

        {notice && (
          <div className="rounded-2xl border border-primary-border bg-primary-subtle px-4 py-3 text-sm text-foreground">
            {notice.text}
            {notice.link && (
              <Link href={notice.link.href} className="kf-hit mt-1 block w-fit font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
        <div className="mt-2 flex flex-col gap-3.5 empty:hidden">
          <GoogleButton label={t.auth.googleLogin} errorLabel={t.auth.googleFailed} />
          {/* Apple guideline 4.8: Apple's own sign-in beside Google, with the same
              weight. Shown only once the provider is enabled (#119, #121):
              NEXT_PUBLIC_APPLE_SIGNIN=enabled, set by the owner after the console
              steps, and the button appears on the next build. Off today: Sign in
              with Apple ships natively in 1.1. */}
          {APPLE_SIGNIN_ENABLED && <AppleButton label={t.auth.appleLogin} errorLabel={t.auth.appleFailed} />}
        </div>

        {providerShown && (
          <div className="my-1 flex items-center gap-3" aria-hidden="true">
            <span className="h-0.5 flex-1 rounded-full bg-border" />
            <span className="text-sm font-semibold text-muted-foreground">{t.auth.orDivider}</span>
            <span className="h-0.5 flex-1 rounded-full bg-border" />
          </div>
        )}

        <div className="kf-card flex flex-col gap-3 rounded-[1.75rem] p-[1.125rem]">
          <AuthField
            variant="clay"
            label={t.auth.email}
            type="email"
            name="email"
            dir="ltr"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <PasswordField
            variant="clay"
            label={t.auth.password}
            showLabel={t.auth.showPassword}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Link href={`/${locale}/forgot-password`} className="inline-flex min-h-[2.75rem] items-center self-start text-sm font-semibold text-accent transition-colors hover:text-accent-hover">
            {t.auth.forgotLink}
          </Link>
          <button type="submit" disabled={loading} className="pressable kf-gold flex min-h-[3.375rem] w-full items-center justify-center rounded-full px-4 text-[1.0625rem] font-extrabold transition-colors disabled:opacity-60">
            {loading ? t.auth.loggingIn : t.auth.loginButton}
          </button>
        </div>

        <GoogleAccountHint text={t.auth.googleAccountHint} forgotLabel={t.auth.forgotLink} forgotHref={`/${locale}/forgot-password`} />
        <Link href={`/${locale}/signup`} className="inline-flex min-h-[2.75rem] items-center self-center text-[0.9375rem] font-semibold text-foreground transition-colors hover:text-accent">
          {t.auth.noAccount}
        </Link>
      </form>
    </div>
  );
}
