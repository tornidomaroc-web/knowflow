'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Locale, locales, useTranslation } from '@/lib/i18n';

export default function NewKnowledgeBasePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = use(params);
  const safeLocale: Locale = locales.includes(locale) ? locale : 'en';
  const t = useTranslation(safeLocale);
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
      setError(t.dashboard.newKb.errorAuth);
      setLoading(false);
      return;
    }

    const res = await fetch('/api/check-limit');
    const { canCreate } = await res.json();
    if (!canCreate) {
      setError(t.dashboard.newKb.errorLimit);
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
      router.push(`/${safeLocale}/dashboard/knowledge`);
    }
  };

  return (
    <div className="max-w-xl text-white">
      <h1 className="text-3xl font-[family-name:var(--font-playfair)] font-bold tracking-wider mb-8">
        {t.dashboard.newKb.title}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="text-red-500 font-[family-name:var(--font-mono)] text-sm">{error}</div>}

        <div className="flex flex-col space-y-2">
          <label className="text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-sm">{t.dashboard.newKb.name}</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-[#0c1510] border border-[var(--border-color)] px-4 py-3 text-white focus:outline-none focus:border-[var(--accent-color)] font-[family-name:var(--font-mono)] text-sm"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <label className="text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-sm">{t.dashboard.newKb.description}</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-[#0c1510] border border-[var(--border-color)] px-4 py-3 text-white focus:outline-none focus:border-[var(--accent-color)] font-[family-name:var(--font-mono)] text-sm resize-none"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <label className="text-[var(--muted-color)] font-[family-name:var(--font-mono)] text-sm">{t.dashboard.newKb.language}</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'ar' | 'en' | 'both')}
            className="bg-[#0c1510] border border-[var(--border-color)] px-4 py-3 text-white focus:outline-none focus:border-[var(--accent-color)] font-[family-name:var(--font-mono)] text-sm appearance-none"
          >
            <option value="ar">{t.dashboard.newKb.languageAr}</option>
            <option value="en">{t.dashboard.newKb.languageEn}</option>
            <option value="both">{t.dashboard.newKb.languageBoth}</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-[var(--accent-color)] text-[#070d0a] font-[family-name:var(--font-sans)] font-bold px-8 py-3 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? t.dashboard.newKb.creating : t.dashboard.newKb.create}
        </button>
      </form>
    </div>
  );
}
