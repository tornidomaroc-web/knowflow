import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ count: kbCount }, { count: docsCount }, { count: convosCount }] = await Promise.all([
    supabase.from('knowledge_bases').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
  ])

  return (
    <div className="text-white space-y-10 max-w-5xl">

      {/* SECTION 1 — Header */}
      <div>
        <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '2.5rem', fontWeight: 700, lineHeight: 1.2 }}>
          Welcome back.
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#6b7d6e', marginTop: '0.5rem' }}>
          {user.email}
        </p>
        <div style={{ borderBottom: '1px solid #1a2e1e', marginTop: '1.5rem' }} />
      </div>

      {/* SECTION 2 — Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Knowledge Bases', value: kbCount ?? 0, desc: 'Active knowledge bases' },
          { label: 'Documents', value: docsCount ?? 0, desc: 'Files processed' },
          { label: 'Conversations', value: convosCount ?? 0, desc: 'Agent interactions' },
        ].map(({ label, value, desc }) => (
          <div key={label} style={{ background: '#0c1510', border: '1px solid #1a2e1e', padding: '1.5rem' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#6b7d6e', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
              {label}
            </p>
            <p style={{ fontFamily: 'var(--font-playfair)', fontSize: '2.5rem', color: '#2eff8c', lineHeight: 1, marginBottom: '0.5rem' }}>
              {value}
            </p>
            <p style={{ fontSize: '0.8rem', color: '#6b7d6e' }}>
              {desc}
            </p>
          </div>
        ))}
      </div>

      {/* SECTION 3 — Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { num: '01', title: 'NEW KNOWLEDGE BASE', desc: 'Upload documents and create an agent', href: '/dashboard/knowledge/new' },
          { num: '02', title: 'TALK TO AGENT', desc: 'Ask questions about your knowledge bases', href: '/dashboard/agent' },
        ].map(({ num, title, desc, href }) => (
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

      {/* SECTION 4 — Recent Activity */}
      <div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#6b7d6e', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
          Recent Activity
        </p>
        <div style={{ border: '1px dashed #1a2e1e', padding: '3rem', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#6b7d6e' }}>
            No activity yet
          </p>
        </div>
      </div>

    </div>
  )
}
