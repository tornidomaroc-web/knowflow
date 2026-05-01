import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { Locale, locales, useTranslation } from '@/lib/i18n'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const safeLocale: Locale = locales.includes(locale) ? locale : 'en'
  const t = useTranslation(safeLocale)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${safeLocale}/login`)

  const [{ count: kbCount }, { count: docsCount }, { count: convosCount }] = await Promise.all([
    supabase.from('knowledge_bases').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
  ])

  const { data: recentActivity } = await supabase
    .from('conversations')
    .select('id, created_at, platform, knowledge_bases(name)')
    .order('created_at', { ascending: false })
    .limit(20)

  const stats = [
    { label: t.dashboard.home.knowledgeBases, value: kbCount ?? 0, desc: t.dashboard.home.knowledgeBasesDesc },
    { label: t.dashboard.home.documents, value: docsCount ?? 0, desc: t.dashboard.home.documentsDesc },
    { label: t.dashboard.home.conversations, value: convosCount ?? 0, desc: t.dashboard.home.conversationsDesc },
  ]

  const actions = [
    { num: '01', title: t.dashboard.home.newKbTitle, desc: t.dashboard.home.newKbDesc, href: `/${safeLocale}/dashboard/knowledge/new` },
    { num: '02', title: t.dashboard.home.talkAgentTitle, desc: t.dashboard.home.talkAgentDesc, href: `/${safeLocale}/dashboard/agent` },
  ]

  return (
    <div className="text-white space-y-10 max-w-5xl">
      <div>
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.2 }}>
          {t.dashboard.home.welcome}
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#6b7d6e', marginTop: '0.5rem' }}>
          {user.email}
        </p>
        <div style={{ borderBottom: '1px solid #1a2e1e', marginTop: '1.5rem' }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map(({ label, value, desc }) => (
          <div key={label} style={{ background: '#0c1510', border: '1px solid #1a2e1e', padding: '1.5rem' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#6b7d6e', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
              {label}
            </p>
            <p style={{ fontFamily: 'var(--font-playfair)', fontSize: '2.5rem', color: '#2eff8c', lineHeight: 1, marginBottom: '0.5rem' }}>
              {value}
            </p>
            <p style={{ fontSize: '0.8rem', color: '#6b7d6e' }}>{desc}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map(({ num, title, desc, href }) => (
          <Link key={num} href={href} className="group block border transition-colors duration-200 hover:border-[#2eff8c]" style={{ background: '#0c1510', borderColor: '#1a2e1e', padding: '1.5rem', textDecoration: 'none' }}>
            <div className="flex items-start justify-between">
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#2eff8c', marginBottom: '0.5rem' }}>{num}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'white', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>{title}</p>
                <p style={{ fontSize: '0.85rem', color: '#6b7d6e' }}>{desc}</p>
              </div>
              <span style={{ color: '#2eff8c', fontSize: '1.25rem', marginLeft: '1rem' }}>→</span>
            </div>
          </Link>
        ))}
      </div>

      <div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#6b7d6e', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
          {t.dashboard.home.recentActivity}
        </p>
        <RecentActivity
          items={(recentActivity ?? []) as never[]}
          labels={{
            noActivity: t.dashboard.home.noActivity,
            conversation: t.dashboard.home.conversation,
            showLess: t.dashboard.home.showLess,
            viewAll: t.dashboard.home.viewAll,
            unknownKb: t.dashboard.home.unknownKb,
          }}
        />
      </div>
    </div>
  )
}
