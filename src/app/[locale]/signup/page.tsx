'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { AppleButton } from '@/components/auth/AppleButton';
import { BrandIcon } from '@/components/brand/BrandIcon';
import { ClayDefs } from '@/components/clay/ClayIcons';
import { APPLE_SIGNIN_ENABLED } from '@/lib/auth/providers';
import { googleSignInAllowed, purchaseLinksAllowed } from '@/lib/platform';
import { usePlatform } from '@/components/platform/PlatformProvider';
import { markSeenAfterSignUp } from '@/lib/first-screen';
import { AuthField, PasswordField } from '@/components/auth/AuthField';
import { useTranslation, Locale } from '@/lib/i18n';
import { keepDotWithBefore } from '@/lib/separator';

export default function SignupPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params);
  const t = useTranslation(locale);
  // The "or" between the provider buttons and the e-mail form exists only
  // when a provider button is shown; inside the app (STORE_PATH.md step a)
  // the Google button is hidden and Apple is not enabled yet, so the divider
  // would separate nothing. Read from the same context the button reads.
  const platform = usePlatform();
  const providerShown = googleSignInAllowed(platform) || APPLE_SIGNIN_ENABLED;
  const isRtl = locale === 'ar';

  const supabase = createClient();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // #102. A mistyped password does NOT fail here, and that is why it has to
    // be caught here. Confirm-email is on, so the mail link lands the student in
    // the dashboard already signed in (api/auth/callback applies the session
    // and redirects); the password is never typed again until the next sign-in
    // on another device or after signing out. That is when the typo surfaces,
    // days later, on an account that already holds their materials, looking
    // like nothing they did, with a recovery mail as the only way back in.
    // Checked before anything leaves the page, so a mismatch sends nothing.
    if (password !== confirmPassword) {
      setNotice(null);
      setError(t.auth.passwordMismatch);
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // #132: the language this page was opened in travels with the account,
        // so the confirmation link opens in it on a device that has never seen
        // this site. Read back by the callback (`landingLocale`).
        data: { full_name: fullName, locale },
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

    // Activation fix 3: in the app, this device now opens on login, not
    // sign-up, even when the mail is confirmed in Safari (src/lib/first-screen.ts).
    markSeenAfterSignUp(platform, document);

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

  return (
    // Design "C", PR 2, in the sign-in page's clay (Login.dc.html): the real app
    // icon as a dark tile, the title, the provider button and the "or" (web
    // only), ONE clay card with the four fields and the gold button, the way
    // back to sign in under it. What the page does is unchanged: the same
    // handler, profile write, strings, notices, errors and redirect.
    <div className="kf-site flex min-h-screen justify-center bg-background" dir={isRtl ? 'rtl' : 'ltr'}>
      <ClayDefs />
      <form onSubmit={handleSignup} className="flex w-full max-w-sm flex-col gap-3.5 px-5 pb-7 pt-10 text-start">
        {/* #105: the icon links to the landing, the way back these pages had no
            other way to. It names the product for a screen reader (#103). */}
        <div className="rise flex flex-col items-center gap-3 text-center">
          <Link href={`/${locale}`} aria-label={t.nav.home} className="rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BrandIcon size={84} radius={24} />
          </Link>
          <h1 className="rise rise-1 mt-1 text-[1.875rem] font-extrabold leading-tight text-foreground">{t.auth.signupTitle}</h1>
          <p className="rise rise-1 text-base font-medium text-muted-foreground">
            {t.auth.signupSubtitle}
            {/* #105: the free-plan line, reusing the landing's approved `cta.note`
                in both languages. Nothing on signup said it was free before. */}
            {/* Step Wording-1: web only. Inside the app no plan is named. In
                that slot the app says what it does instead (activation fix 4,
                owner-approved 2026-11-10, docs/copy-drafts/activation_3_signup.md):
                the approved `about.subtitle`, unchanged, since a fresh install
                now opens here. */}
            <span className="mt-1 block text-sm">{keepDotWithBefore(purchaseLinksAllowed(platform) ? t.cta.note : t.about.subtitle)}</span>
          </p>
        </div>

        {error && <div className="rounded-2xl border border-danger-border bg-danger-subtle px-4 py-3 text-sm text-danger">{error}</div>}

        {notice && (
          <div className="rounded-2xl border border-primary-border bg-primary-subtle px-4 py-3 text-sm">
            <p className="font-medium text-foreground">{t.auth.checkInboxTitle}</p>
            {/* Balanced (activation 5, the owner's review of #315): the Arabic
                sentence ended on one word alone. Style only. */}
            <p className="mt-1 text-muted-foreground [text-wrap:balance]">{notice}</p>
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
        <div className="mt-2 flex flex-col gap-3.5 empty:hidden">
          <GoogleButton label={t.auth.googleSignup} errorLabel={t.auth.googleFailed} />
          {/* Apple guideline 4.8: Apple's own sign-in beside Google, with the same
              weight. Shown only once the provider is enabled (#119, #121):
              NEXT_PUBLIC_APPLE_SIGNIN=enabled, set by the owner after the console
              steps, and the button appears on the next build. Off today: Sign in
              with Apple ships natively in 1.1. */}
          {APPLE_SIGNIN_ENABLED && <AppleButton label={t.auth.appleSignup} errorLabel={t.auth.appleFailed} />}
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
            label={t.auth.name}
            type="text"
            name="name"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <PasswordField
            variant="clay"
            label={t.auth.confirmPassword}
            showLabel={t.auth.showPassword}
            name="confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading} className="pressable kf-gold mt-1 flex min-h-[3.375rem] w-full items-center justify-center rounded-full px-4 text-[1.0625rem] font-extrabold transition-colors disabled:opacity-60">
            {loading ? t.auth.creating : t.auth.createBtn}
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <Link href={`/${locale}/login`} className="inline-flex min-h-[2.75rem] items-center text-[0.9375rem] font-semibold text-foreground transition-colors hover:text-accent">
            {t.auth.hasAccount}
          </Link>
            {/* #105: moved here from under the password fields, unreworded, as ruled. It is a note for a returning student, beside the sign-in line. It is still shown to everyone, so it still reveals nothing about any address. */}
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
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t.auth.signupRepeatPassword}{' '}
              <Link
                href={`/${locale}/forgot-password`}
                className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-accent"
              >
                {t.auth.signupRepeatPasswordLink}
              </Link>
            </p>
        </div>
      </form>
    </div>
  );
}
