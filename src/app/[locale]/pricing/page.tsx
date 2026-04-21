'use client'
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { initializePaddle, Paddle } from '@paddle/paddle-js';
import { useTranslation, Locale } from '@/lib/i18n';

export default function PricingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = use(params);
  const t = useTranslation(locale);
  const isRtl = locale === 'ar';

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [paddle, setPaddle] = useState<Paddle | undefined>();

  const supabase = createClient();

  useEffect(() => {
    initializePaddle({
      environment: 'production',
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN!
    }).then(setPaddle);
  }, []);

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    setErrorMsg('');

    const { error } = await supabase
      .from('waitlist')
      .insert({ email, plan: 'pro' });

    if (error) {
      if (error.code === '23505') {
        setErrorMsg('Email already on waitlist.'); // keeping error message strings in English since they are system messages
      } else {
        setErrorMsg('Error joining waitlist.');
      }
      setStatus('error');
      return;
    }

    setStatus('success');
    setEmail('');
  };

  return (
    <div className="bg-[var(--bg-color)] text-white min-h-screen font-[family-name:var(--font-sans)] py-24" dir={isRtl ? "rtl" : "ltr"}>
      <div className="max-w-7xl mx-auto px-6 text-center mb-16">
        <h1 className="text-5xl font-[family-name:var(--font-playfair)] font-bold mb-4">{t.pricing.title}</h1>
      </div>
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* FREE PLAN */}
        <div className={`border border-[var(--border-color)] bg-[var(--input-bg)] p-8 flex flex-col ${isRtl ? 'text-right' : 'text-left'}`}>
          <h2 className="text-2xl font-[family-name:var(--font-playfair)] font-bold mb-2">{t.pricing.free.name}</h2>
          <div className="text-3xl font-bold mb-6">{t.pricing.free.price}<span className="text-sm font-normal text-[var(--muted-color)]">{t.pricing.free.period}</span></div>
          <ul className="space-y-4 mb-8 flex-1 font-[family-name:var(--font-mono)] text-sm text-[var(--muted-color)]">
            {t.pricing.free.features.map((feature, idx) => (
              <li key={idx}>• {feature}</li>
            ))}
          </ul>
          <Link href="/signup" className="block text-center border border-[var(--accent-color)] text-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-black py-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest transition-colors font-bold bg-transparent mx-0">
            {t.pricing.free.button}
          </Link>
        </div>

        {/* PRO PLAN */}
        <div className={`border-2 border-[var(--accent-color)] bg-[var(--input-bg)] p-8 flex flex-col relative ${isRtl ? 'text-right' : 'text-left'}`}>
          <h2 className="text-2xl font-[family-name:var(--font-playfair)] font-bold mb-2">{t.pricing.pro.name}</h2>
          <div className="text-3xl font-bold mb-6">{t.pricing.pro.price}<span className="text-sm font-normal text-[var(--muted-color)]">{t.pricing.pro.period}</span></div>
          <ul className="space-y-4 mb-8 flex-1 font-[family-name:var(--font-mono)] text-sm text-[var(--muted-color)]">
            {t.pricing.pro.features.map((feature, idx) => (
              <li key={idx}>• {feature}</li>
            ))}
          </ul>
          
          <div className="mt-auto">
            <button 
              onClick={async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                  window.location.href = '/login';
                  return;
                }
                setStatus('loading');
                try {
                  const res = await fetch('/api/paddle/checkout', { method: 'POST' });
                  const data = await res.json();
                  if (data.transactionId) {
                    paddle?.Checkout.open({ transactionId: data.transactionId });
                    setStatus('idle');
                  } else {
                    throw new Error(data.error || 'Failed to start checkout');
                  }
                } catch (err: any) {
                  setErrorMsg(err.message);
                  setStatus('error');
                }
              }}
              disabled={status === 'loading'}
              className="w-full bg-[var(--accent-color)] text-black py-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {status === 'loading' ? (
                <>Processing...</>
              ) : t.pricing.pro.button}
            </button>
            {status === 'error' && (
              <p className="text-red-400 font-[family-name:var(--font-mono)] text-xs text-center mt-2">{errorMsg}</p>
            )}
          </div>
        </div>

        {/* ENTERPRISE PLAN */}
        <div className={`border border-[var(--border-color)] bg-[var(--input-bg)] p-8 flex flex-col ${isRtl ? 'text-right' : 'text-left'}`}>
          <h2 className="text-2xl font-[family-name:var(--font-playfair)] font-bold mb-2">{t.pricing.enterprise.name}</h2>
          <div className="text-3xl font-bold mb-6">{t.pricing.enterprise.price}</div>
          <ul className="space-y-4 mb-8 flex-1 font-[family-name:var(--font-mono)] text-sm text-[var(--muted-color)]">
            {t.pricing.enterprise.features.map((feature, idx) => (
              <li key={idx}>• {feature}</li>
            ))}
          </ul>
          <Link href="/contact" className="block text-center border border-[var(--muted-color)] text-[var(--muted-color)] hover:border-white hover:text-white py-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest transition-colors bg-transparent mx-0">
            {t.pricing.enterprise.button}
          </Link>
        </div>

      </div>
    </div>
  );
}
