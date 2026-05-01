import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { KBSelector } from '@/components/agent/KBSelector';
import { Locale, locales, useTranslation } from '@/lib/i18n';

export default async function AgentPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const safeLocale: Locale = locales.includes(locale) ? locale : 'en';
  const t = useTranslation(safeLocale);

  const supabase = await createClient();

  const { data: kbs } = await supabase
    .from('knowledge_bases')
    .select('*')
    .order('created_at', { ascending: false });

  if (!kbs || kbs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-white border border-[var(--border-color)] bg-[#0c1510]">
        <h2 className="text-xl font-[family-name:var(--font-playfair)] mb-4">{t.dashboard.nav.knowledge}</h2>
        <p className="text-[var(--muted-color)] font-[family-name:var(--font-sans)] mb-6">{t.dashboard.home.newKbDesc}</p>
        <Link href={`/${safeLocale}/dashboard/knowledge/new`} className="bg-[var(--accent-color)] text-[#070d0a] px-6 py-2 font-[family-name:var(--font-mono)] uppercase text-xs tracking-widest">
          {t.dashboard.home.newKbTitle}
        </Link>
      </div>
    );
  }

  return (
    <div className="text-white space-y-6 mx-auto h-full flex flex-col">
      <h1 className="text-4xl font-[family-name:var(--font-playfair)] font-bold tracking-wider">
        {t.dashboard.nav.agent}
      </h1>
      <KBSelector kbs={kbs} />
    </div>
  );
}
