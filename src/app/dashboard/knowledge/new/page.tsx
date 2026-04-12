'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NewKnowledgeBasePage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState<'ar' | 'en' | 'both'>('ar');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    const res = await fetch('/api/check-limit');
    const { canCreate } = await res.json();
    if (!canCreate) {
      setError('Free plan allows 1 Knowledge Base only. Upgrade to Pro for more.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('knowledge_bases')
      .insert({
        user_id: user.id,
        name,
        description,
        language
      });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
    } else {
      router.push('/dashboard/knowledge');
    }
  };

  return (
    <div className="max-w-xl text-white">
      <h1 className="text-3xl font-[family-name:var(--font-playfair)] font-bold tracking-wider mb-8">
        Create Knowledge Base
      </h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="text-red-500 font-[family-name:var(--font-mono)] text-sm">{error}</div>}
        
        <div className="flex flex-col space-y-2">
          <label className="text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-sm">Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-[#0c1510] border border-[var(--border-color)] px-4 py-3 text-white focus:outline-none focus:border-[var(--accent-color)] font-[family-name:var(--font-mono)] text-sm"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <label className="text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-sm">Description (Optional)</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-[#0c1510] border border-[var(--border-color)] px-4 py-3 text-white focus:outline-none focus:border-[var(--accent-color)] font-[family-name:var(--font-mono)] text-sm resize-none"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <label className="text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-sm">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'ar' | 'en' | 'both')}
            className="bg-[#0c1510] border border-[var(--border-color)] px-4 py-3 text-white focus:outline-none focus:border-[var(--accent-color)] font-[family-name:var(--font-mono)] text-sm appearance-none"
          >
            <option value="ar">Arabic</option>
            <option value="en">English</option>
            <option value="both">Both</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-[var(--accent-color)] text-[#070d0a] font-[family-name:var(--font-sans)] font-bold px-8 py-3 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Knowledge Base'}
        </button>
      </form>
    </div>
  );
}
