'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Input, buttonVariants } from '@/components/ui';
import { Locale, locales, useTranslation } from '@/lib/i18n';
import { KB_LANGUAGES, type KbLanguage } from '@/types';

const fieldClass =
  'w-full rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring';

// Type guard against the shared KB_LANGUAGES source of truth, so the runtime
// narrowing and the compile-time KbLanguage domain are literally the same list
// (mirrors the ingest route's isAllowedFileType). `.some` narrows a widened
// `string` with no cast — replacing the old `as 'ar'|'en'|'both'` assertion.
function isKbLanguage(v: string): v is KbLanguage {
  return KB_LANGUAGES.some((l) => l === v);
}

// Each language's existing i18n label key, keyed by KbLanguage so adding a
// language to KB_LANGUAGES without giving it a label here is a compile error.
const LANG_LABEL: Record<KbLanguage, 'languageAr' | 'languageEn' | 'languageBoth'> = {
  ar: 'languageAr',
  en: 'languageEn',
  both: 'languageBoth',
};

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
  const [language, setLanguage] = useState<KbLanguage>('ar');
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
              onChange={(e) => {
                const v = e.target.value;
                if (isKbLanguage(v)) setLanguage(v);
              }}
              className={cn(fieldClass, 'h-11 py-0')}
            >
              {KB_LANGUAGES.map((l) => (
                <option key={l} value={l}>{t.dashboard.newKb[LANG_LABEL[l]]}</option>
              ))}
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
