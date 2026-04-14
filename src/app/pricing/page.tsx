'use client'
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { initializePaddle, Paddle } from '@paddle/paddle-js';

export default function PricingPage() {
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
        setErrorMsg('Email already on waitlist.');
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
    <div className="bg-[var(--bg-color)] text-white min-h-screen font-[family-name:var(--font-sans)] py-24">
      <div className="max-w-7xl mx-auto px-6 text-center mb-16">
        <h1 className="text-5xl font-[family-name:var(--font-playfair)] font-bold mb-4">Simple, transparent pricing.</h1>
      </div>
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* FREE PLAN */}
        <div className="border border-[var(--border-color)] bg-[var(--input-bg)] p-8 flex flex-col">
          <h2 className="text-2xl font-[family-name:var(--font-playfair)] font-bold mb-2">Free</h2>
          <div className="text-3xl font-bold mb-6">$0<span className="text-sm font-normal text-[var(--muted-color)]">/month</span></div>
          <ul className="space-y-4 mb-8 flex-1 font-[family-name:var(--font-mono)] text-sm text-[var(--muted-color)]">
            <li>• 1 Knowledge Base</li>
            <li>• 10 documents</li>
            <li>• 100 conversations/month</li>
            <li>• Web access only</li>
          </ul>
          <Link href="/signup" className="block text-center border border-[var(--accent-color)] text-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-black py-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest transition-colors font-bold bg-transparent">
            Get Started Free
          </Link>
        </div>

        {/* PRO PLAN */}
        <div className="border-2 border-[var(--accent-color)] bg-[var(--input-bg)] p-8 flex flex-col relative">

          <h2 className="text-2xl font-[family-name:var(--font-playfair)] font-bold mb-2">Pro</h2>
          <div className="text-3xl font-bold mb-6">$49<span className="text-sm font-normal text-[var(--muted-color)]">/month</span></div>
          <ul className="space-y-4 mb-8 flex-1 font-[family-name:var(--font-mono)] text-sm text-[var(--muted-color)]">
            <li>• 10 Knowledge Bases</li>
            <li>• Unlimited documents</li>
            <li>• Unlimited conversations</li>
            <li>• Telegram + Slack + API</li>
            <li>• Priority support</li>
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
                <>
                  <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : 'Upgrade to Pro'}
            </button>
            {status === 'error' && (
              <p className="text-red-400 font-[family-name:var(--font-mono)] text-xs text-center mt-2">{errorMsg}</p>
            )}
          </div>
        </div>

        {/* ENTERPRISE PLAN */}
        <div className="border border-[var(--border-color)] bg-[var(--input-bg)] p-8 flex flex-col">
          <h2 className="text-2xl font-[family-name:var(--font-playfair)] font-bold mb-2">Enterprise</h2>
          <div className="text-3xl font-bold mb-6">Custom</div>
          <ul className="space-y-4 mb-8 flex-1 font-[family-name:var(--font-mono)] text-sm text-[var(--muted-color)]">
            <li>• Unlimited everything</li>
            <li>• Custom domain</li>
            <li>• Dedicated support</li>
            <li>• SLA guarantee</li>
          </ul>
          <Link href="/contact" className="block text-center border border-[var(--muted-color)] text-[var(--muted-color)] hover:border-white hover:text-white py-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest transition-colors bg-transparent">
            Contact Us
          </Link>
        </div>

      </div>
    </div>
  );
}
