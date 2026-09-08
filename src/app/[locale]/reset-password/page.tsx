'use client';

import { useState, use, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui';
import { useTranslation, Locale } from '@/lib/i18n';

/**
 * Where /api/auth/callback sends a RECOVERY landing.
 *
 * The session is already live by the time this renders: Supabase recovery works
 * by granting one, and `updateUser` needs it. So "sign in before or after the
 * new password" is not a choice this app gets to make. What it does get to
 * choose is where that live session lands, and landing it HERE rather than on
 * the dashboard is the whole mitigation: the only thing on offer is the form
 * that ends the window, plus an explicit way to close it without setting one.
 */
export default function ResetPasswordPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params);
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  const supabase = createClient();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    // The client is recreated each render; the check only needs to run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    router.push(`/${locale}/dashboard`);
  };

  const handleCancel = async () => {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
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
        </div>
      </div>
      <div className="flex w-full items-center justify-center bg-surface p-8 lg:w-1/2">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 text-start">
          <h2 className="text-3xl font-semibold tracking-tight">{t.auth.resetTitle}</h2>
          <p className="mb-8 text-sm text-muted-foreground">{t.auth.resetSubtitle}</p>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {hasSession === false ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
              {t.auth.resetNoSession}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">{t.auth.password}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={fieldClass} />
              </div>
              <button type="submit" disabled={loading || hasSession === null} className={cn(buttonVariants({ variant: 'primary' }), 'mt-2 w-full')}>
                {loading ? t.auth.resetSaving : t.auth.resetSubmit}
              </button>
              <button type="button" onClick={handleCancel} className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-primary">
                {t.auth.resetCancel}
              </button>
            </>
          )}

          <div className="mt-6 text-center">
            <Link href={`/${locale}/forgot-password`} className="text-sm text-muted-foreground transition-colors hover:text-primary">
              {t.auth.forgotLink}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
