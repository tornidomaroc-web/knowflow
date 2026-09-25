'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { AppleButton } from '@/components/auth/AppleButton';
import { AuthField, PasswordField } from '@/components/auth/AuthField';
import { useTranslation, Locale } from '@/lib/i18n';

export default function LoginPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params);
  const t = useTranslation(locale);
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
  }, []);

  const notice =
    noticeCode === 'signin_required' ? t.auth.noticeSigninRequired
    : noticeCode === 'link_expired' ? t.auth.noticeLinkExpired
    : null;

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
    <div className="flex min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex w-full items-center justify-center bg-surface p-8">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-6 text-start">
          {/* #103: the product name at every width. The gold panel carried it at lg and up and is gone. */}
          {/* #105: it links to the landing. These pages had no other way back. */}
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold tracking-tight">
              <Link href={`/${locale}`} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {t.nav.home.replace('Flow', '')}<span className="text-primary">Flow</span>
              </Link>
            </h1>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">{t.auth.loginTitle}</h2>
          <p className="mb-8 text-sm text-muted-foreground">{t.auth.loginSubtitle}</p>

          {error && <div className="rounded-xl border border-danger-border bg-danger-subtle px-4 py-3 text-sm text-danger">{error}</div>}

          {notice && (
            <div className="rounded-xl border border-primary-border bg-primary-subtle px-4 py-3 text-sm text-foreground">{notice}</div>
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
              weight. Its console setup is the owner's (register #119). */}
          <AppleButton label={t.auth.appleLogin} errorLabel={t.auth.appleFailed} />

          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{t.auth.orDivider}</span>
            <span className="h-px flex-1 bg-border" />
          </div>

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
