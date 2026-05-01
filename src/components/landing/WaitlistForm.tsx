'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface WaitlistFormProps {
  placeholder: string;
  button: string;
  badge: string;
  isRtl: boolean;
  successText: string;
  errorDuplicate: string;
  errorGeneric: string;
}

export function WaitlistForm({
  placeholder,
  button,
  badge,
  isRtl,
  successText,
  errorDuplicate,
  errorGeneric,
}: WaitlistFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setErrorMsg('');

    const supabase = createClient();
    const { error } = await supabase.from('waitlist').insert({ email: email.trim(), plan: 'free' });

    if (error) {
      setErrorMsg(error.code === '23505' ? errorDuplicate : errorGeneric);
      setStatus('error');
      return;
    }

    setStatus('success');
    setEmail('');
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row max-w-lg mx-auto font-[family-name:var(--font-mono)] text-sm"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          disabled={status === 'loading' || status === 'success'}
          className="flex-1 bg-[var(--input-bg)] border border-[var(--border-color)] px-6 py-4 focus:outline-none focus:border-[var(--accent-color)] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === 'loading' || status === 'success'}
          className="bg-[var(--accent-color)] text-black px-8 py-4 uppercase tracking-widest font-bold hover:opacity-90 transition-opacity mt-4 sm:mt-0 disabled:opacity-60"
        >
          {status === 'loading' ? '...' : button}
        </button>
      </form>
      <p className="mt-8 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--muted-color)]">
        {status === 'success' ? successText : status === 'error' ? errorMsg : badge}
      </p>
    </>
  );
}
