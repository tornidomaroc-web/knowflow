'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="flex min-h-screen bg-[var(--bg-color)]">
      <div className="hidden lg:flex flex-col justify-center items-center w-1/2 relative overflow-hidden border-r border-[var(--border-color)]">
        <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: 'linear-gradient(to right, var(--border-color) 1px, transparent 1px), linear-gradient(to bottom, var(--border-color) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10 text-center">
          <h1 className="text-6xl font-[family-name:var(--font-playfair)] font-bold text-white mb-4 tracking-wider">
            Know<span className="text-[var(--accent-color)]">Flow</span>
          </h1>
          <p className="text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-lg tracking-widest uppercase">
            Unlock your knowledge
          </p>
        </div>
      </div>
      <div className="flex w-full lg:w-1/2 justify-center items-center bg-[var(--input-bg)] p-8 text-white">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-6">
          <div className="text-center mb-10 lg:hidden">
            <h1 className="text-4xl font-[family-name:var(--font-playfair)] font-bold tracking-wider">
              Know<span className="text-[var(--accent-color)]">Flow</span>
            </h1>
          </div>
          <h2 className="text-3xl font-[family-name:var(--font-playfair)] font-bold">Welcome back</h2>
          <p className="text-[var(--muted-color)] font-[family-name:var(--font-sans)] text-sm mb-8">Sign in to your account</p>
          
          {error && <div className="text-red-500 font-[family-name:var(--font-mono)] text-sm py-2">{error}</div>}
          
          <div className="space-y-4 font-[family-name:var(--font-mono)] text-sm">
            <div className="flex flex-col space-y-2">
              <label className="text-[var(--muted-color)]">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-[var(--bg-color)] border border-[var(--border-color)] rounded-none px-4 py-3 focus:outline-none focus:border-[var(--accent-color)] transition-colors" />
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-[var(--muted-color)]">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-[var(--bg-color)] border border-[var(--border-color)] rounded-none px-4 py-3 focus:outline-none focus:border-[var(--accent-color)] transition-colors" />
            </div>
          </div>
          
          <button type="submit" disabled={loading} className="w-full bg-[var(--accent-color)] text-[#070d0a] font-[family-name:var(--font-sans)] font-bold py-3 mt-6 hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          
          <div className="text-center mt-6">
            <Link href="/signup" className="text-[var(--muted-color)] font-[family-name:var(--font-sans)] text-sm hover:text-[var(--accent-color)] transition-colors">
              Don't have an account? Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
