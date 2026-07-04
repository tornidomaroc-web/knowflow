'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui';
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
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

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
