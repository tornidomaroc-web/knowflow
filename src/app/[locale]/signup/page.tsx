'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
        <form onSubmit={handleSignup} className={`w-full max-w-sm space-y-6 ${isRtl ? 'text-right' : 'text-left'}`}>
          <div className="text-center mb-10 lg:hidden">
             <h1 className="text-4xl font-[family-name:var(--font-playfair)] font-bold tracking-wider">
               {t.nav.home.replace('Flow', '')}<span className="text-[var(--accent-color)]">Flow</span>
             </h1>
          </div>
          <h2 className="text-3xl font-[family-name:var(--font-playfair)] font-bold">{t.auth.signupTitle}</h2>
          <p className="text-[var(--muted-color)] font-[family-name:var(--font-sans)] text-sm mb-8">{t.auth.signupSubtitle}</p>
          
          {error && <div className="text-red-500 font-[family-name:var(--font-mono)] text-sm py-2">{error}</div>}
          
          <div className="space-y-4 font-[family-name:var(--font-mono)] text-sm">
            <div className="flex flex-col space-y-2">
              <label className="text-[var(--muted-color)]">{t.auth.name}</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="bg-[var(--bg-color)] border border-[var(--border-color)] rounded-none px-4 py-3 focus:outline-none focus:border-[var(--accent-color)] transition-colors" />
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-[var(--muted-color)]">{t.auth.email}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-[var(--bg-color)] border border-[var(--border-color)] rounded-none px-4 py-3 focus:outline-none focus:border-[var(--accent-color)] transition-colors" />
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-[var(--muted-color)]">{t.auth.password}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-[var(--bg-color)] border border-[var(--border-color)] rounded-none px-4 py-3 focus:outline-none focus:border-[var(--accent-color)] transition-colors" />
            </div>
          </div>
          
          <button type="submit" disabled={loading} className="w-full bg-[var(--accent-color)] text-[#070d0a] font-[family-name:var(--font-sans)] font-bold py-3 mt-6 hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? t.auth.creating : t.auth.createBtn}
          </button>
          
          <div className="text-center mt-6">
            <Link href={`/${locale}/login`} className="text-[var(--muted-color)] font-[family-name:var(--font-sans)] text-sm hover:text-[var(--accent-color)] transition-colors">
              {t.auth.hasAccount}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
