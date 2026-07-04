'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Input, buttonVariants } from '@/components/ui';
import { Locale, locales, useTranslation } from '@/lib/i18n';

const fieldClass =
  'w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring';

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
    const { canCreate, limit, tier } = await res.json();
    if (!canCreate) {
      // Tier-correct message with the real limit interpolated from the API, so
      // the copy can never drift from the enforced number. A Pro user never sees
      // the free-plan / upgrade wording.
      const template = tier === 'pro' ? t.dashboard.newKb.errorLimitPro : t.dashboard.newKb.errorLimitFree;
      setError(template.replace('{limit}', String(limit)));
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
    <div>
      <div className="mx-auto max-w-xl">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight md:text-3xl">
          {t.dashboard.newKb.title}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">{t.dashboard.newKb.name}</label>
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">{t.dashboard.newKb.description}</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(fieldClass, 'resize-none')}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">{t.dashboard.newKb.language}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'ar' | 'en' | 'both')}
              className={cn(fieldClass, 'h-11 py-0')}
            >
              <option value="ar">{t.dashboard.newKb.languageAr}</option>
              <option value="en">{t.dashboard.newKb.languageEn}</option>
              <option value="both">{t.dashboard.newKb.languageBoth}</option>
            </select>
          </div>

          <button type="submit" disabled={loading} className={buttonVariants({ variant: 'primary' })}>
            {loading ? t.dashboard.newKb.creating : t.dashboard.newKb.create}
          </button>
        </form>
      </div>
    </div>
  );
}
