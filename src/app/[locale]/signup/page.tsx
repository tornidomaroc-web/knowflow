'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { useTranslation, Locale } from '@/lib/i18n';

export default function SignupPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params);
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  const supabase = createClient();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // Send the mail link back to our own callback instead of letting it
        // default to the bare Site URL, which is where it used to drop people:
        // on the marketing page, still signed out, left to find Sign In alone.
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      }
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Confirm email is ON for this project, so GoTrue withholds the session
    // until the address is proven. The session field was always on this object.
    // Nothing read it, so signup pushed at a dashboard the middleware then
    // bounced, and the user landed on Sign In with no idea why.
    if (!authData.session) {
      setNotice(t.auth.checkInboxBody);
      setLoading(false);
      return;
    }

    // Only reachable holding a session. The upsert needs one: profiles is
    // guarded by `using (auth.uid() = id)`, so without a session this write was
    // always refused, and its error was logged to a console nobody reads.
    if (authData.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: authData.user.id,
        full_name: fullName,
        email: email,
        plan: 'free'
      });
      if (profileError && profileError.code !== '23505') {
        console.error('Profile upsert error:', profileError);
      }
    }

    router.push(`/${locale}/dashboard`);
  };

  const fieldClass =
    'w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="flex min-h-screen" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden border-e border-border bg-primary text-primary-foreground lg:flex">
        <div
          className="absolute inset-0 z-0 opacity-20"
          style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="relative z-10 text-center">
          <h1 className="mb-4 text-6xl font-bold tracking-tight">
            {t.nav.home.replace('Flow', '')}<span className="opacity-80">Flow</span>
          </h1>
          <p className="text-lg uppercase tracking-widest text-primary-foreground/80">
            Unlock your knowledge
          </p>
        </div>
      </div>
      <div className="flex w-full items-center justify-center bg-surface p-8 lg:w-1/2">
        <form onSubmit={handleSignup} className="w-full max-w-sm space-y-6 text-start">
          <div className="mb-10 text-center lg:hidden">
            <h1 className="text-4xl font-bold tracking-tight">
              {t.nav.home.replace('Flow', '')}<span className="text-primary">Flow</span>
            </h1>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">{t.auth.signupTitle}</h2>
          <p className="mb-8 text-sm text-muted-foreground">{t.auth.signupSubtitle}</p>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {notice && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">{t.auth.checkInboxTitle}</p>
              <p className="mt-1 text-muted-foreground">{notice}</p>
            </div>
          )}

          {/*
            "Continue with Google" here, "Sign in with Google" on /login, and the
            difference is not cosmetic. On /login the person is asserting they
            already have an account, so "sign in" is what they are doing. Here
            the outcome is genuinely ambiguous and we know exactly why: GoTrue
            either creates an account or links this identity onto an existing
            user with the same address, and register #74 is the case where that
            existing user is unconfirmed and loses their password to it.
            "Sign up with Google" would be a plain lie to that person, who is not
            signing up. "Continue" is the only word true of every outcome.
          */}
          <GoogleButton label={t.auth.googleSignup} errorLabel={t.auth.googleFailed} />

          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{t.auth.orDivider}</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">{t.auth.name}</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={fieldClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">{t.auth.email}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={fieldClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">{t.auth.password}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={fieldClass} />
              {/*
                Register #77. A repeat signup on an address that is registered but
                UNCONFIRMED does not update the password: GoTrue reaches
                `signup.go:197` with the existing user in hand and deliberately
                leaves it alone ("do not update the user because we can't be sure
                of their claimed identity"), re-sending only the confirmation
                mail. So a second signup with a DIFFERENT password succeeds, the
                mail works, the address confirms, and the password that signs
                them in is the FIRST one. Nothing on screen would contradict them.

                Our own copy is what sends people here: `noticeLinkExpired` tells
                them to sign up again, and this form asks for a password.

                UNCONDITIONAL ON PURPOSE, and this is the load-bearing decision.
                The case IS detectable: the repeat response is not sanitized
                (`sanitizeUser`, signup.go:349, is applied only to the CONFIRMED
                collision), so the real user comes back carrying its ORIGINAL
                created_at and the same age gap used for register #74 would
                identify it exactly. Doing that would tell whoever typed the
                address that it is already registered, and the person filling in
                a signup form is not necessarily its owner. That is precisely the
                leak `sanitizeUser` exists to prevent, which upstream has left
                open on this path. So the line is shown to everyone and reveals
                nothing about anyone.
              */}
              <p className="text-xs text-muted-foreground">
                {t.auth.signupRepeatPassword}{' '}
                <Link
                  href={`/${locale}/forgot-password`}
                  className="underline transition-colors hover:text-primary"
                >
                  {t.auth.signupRepeatPasswordLink}
                </Link>
              </p>
            </div>
          </div>

          <button type="submit" disabled={loading} className={cn(buttonVariants({ variant: 'primary' }), 'mt-6 w-full')}>
            {loading ? t.auth.creating : t.auth.createBtn}
          </button>

          <div className="mt-6 text-center">
            <Link href={`/${locale}/login`} className="text-sm text-muted-foreground transition-colors hover:text-primary">
              {t.auth.hasAccount}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
