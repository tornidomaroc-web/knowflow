'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui';
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
  const [showPassword, setShowPassword] = useState(false);

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
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-6 text-start">
          <div className="mb-10 text-center lg:hidden">
            <h1 className="text-4xl font-bold tracking-tight">
              {t.nav.home.replace('Flow', '')}<span className="text-primary">Flow</span>
            </h1>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">{t.auth.loginTitle}</h2>
          <p className="mb-8 text-sm text-muted-foreground">{t.auth.loginSubtitle}</p>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">{t.auth.email}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={fieldClass} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">{t.auth.password}</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required className={cn(fieldClass, 'pe-10')} />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground" tabIndex={-1}>
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className={cn(buttonVariants({ variant: 'primary' }), 'mt-6 w-full')}>
            {loading ? t.auth.loggingIn : t.auth.loginButton}
          </button>

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
