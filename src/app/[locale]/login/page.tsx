'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
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
      router.push('/dashboard');
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-color)]" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="hidden lg:flex flex-col justify-center items-center w-1/2 relative overflow-hidden border-r border-[var(--border-color)]">
        <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: 'linear-gradient(to right, var(--border-color) 1px, transparent 1px), linear-gradient(to bottom, var(--border-color) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10 text-center">
          <h1 className="text-6xl font-[family-name:var(--font-playfair)] font-bold text-white mb-4 tracking-wider">
            {t.nav.home.replace('Flow', '')}<span className="text-[var(--accent-color)]">Flow</span>
          </h1>
          <p className="text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-lg tracking-widest uppercase">
            Unlock your knowledge
          </p>
        </div>
      </div>
      <div className="flex w-full lg:w-1/2 justify-center items-center bg-[var(--input-bg)] p-8 text-white">
        <form onSubmit={handleLogin} className={`w-full max-w-sm space-y-6 ${isRtl ? 'text-right' : 'text-left'}`}>
          <div className="text-center mb-10 lg:hidden">
            <h1 className="text-4xl font-[family-name:var(--font-playfair)] font-bold tracking-wider">
              {t.nav.home.replace('Flow', '')}<span className="text-[var(--accent-color)]">Flow</span>
            </h1>
          </div>
          <h2 className="text-3xl font-[family-name:var(--font-playfair)] font-bold">{t.auth.loginTitle}</h2>
          <p className="text-[var(--muted-color)] font-[family-name:var(--font-sans)] text-sm mb-8">{t.auth.loginSubtitle}</p>
          
          {error && <div className="text-red-500 font-[family-name:var(--font-mono)] text-sm py-2">{error}</div>}
          
          <div className="space-y-4 font-[family-name:var(--font-mono)] text-sm">
            <div className="flex flex-col space-y-2">
              <label className="text-[var(--muted-color)]">{t.auth.email}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-[var(--bg-color)] border border-[var(--border-color)] rounded-none px-4 py-3 focus:outline-none focus:border-[var(--accent-color)] transition-colors" />
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-[var(--muted-color)]">{t.auth.password}</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-none px-4 py-3 pr-10 focus:outline-none focus:border-[var(--accent-color)] transition-colors" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-[var(--muted-color)] hover:text-white transition-colors`} tabIndex={-1}>
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          <button type="submit" disabled={loading} className="w-full bg-[var(--accent-color)] text-[#070d0a] font-[family-name:var(--font-sans)] font-bold py-3 mt-6 hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? t.auth.loggingIn : t.auth.loginButton}
          </button>
          
          <div className="text-center mt-6">
            <Link href={`/${locale}/signup`} className="text-[var(--muted-color)] font-[family-name:var(--font-sans)] text-sm hover:text-[var(--accent-color)] transition-colors">
              {t.auth.noAccount}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
