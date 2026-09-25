import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChatBox } from '@/components/agent/ChatBox'
import { AgentEmptyState } from '@/components/agent/AgentEmptyState'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Locale, locales, useTranslation } from '@/lib/i18n'
import { PreviewHistory } from './PreviewHistory'

/**
 * DESIGN PREVIEW for the Ask screen (#122, extended for #123): the real
 * components with literal data, in the real chrome. The subject bar and the
 * history drawer (KBSelector) are not rendered, because KBSelector reads
 * conversations through Supabase on mount; ChatBox opens no client until a
 * question is sent, and no question is sent here. 404 on production.
 *
 * `?view=` picks what to show, so every visible Ask string can be looked at:
 *   (default)  an empty conversation with suggestions built from two materials;
 *   none       an empty conversation whose subject has no usable topic, which
 *              is the only state that shows the `overview` suggestion;
 *   zero       a student with no subjects (AgentEmptyState, `home.newKbDesc`);
 *   history    the history list as the phone's drawer shows it, empty
 *              (`agent.noHistory`).
 */
export const metadata: Metadata = {
  title: 'Ask: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

type View = 'default' | 'none' | 'zero' | 'history'

export default async function AskPreview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ view?: string }>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)
  const ar = safeLocale === 'ar'
  const raw = (await searchParams).view
  const view: View = raw === 'none' || raw === 'zero' || raw === 'history' ? raw : 'default'

  const materials =
    view === 'none'
      ? [{ filename: 'xilvaroth-n11-20260810.pdf', lead: null }]
      : [
          { filename: 'xilvaroth-n11-20260810.pdf', lead: ar ? 'يشرح الفصل مرونة الطلب السعرية وعواملها.' : 'The chapter explains price elasticity of demand and its factors.' },
          { filename: ar ? 'تمارين محلولة - الفصل 3.pdf' : 'Solved exercises - Chapter 3.pdf', lead: null },
        ]

  return (
    <div className="min-h-screen">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs">
        <span className="font-semibold text-foreground">ask · preview</span>
        <span className="text-faint">{safeLocale} · {view}</span>
        {(['default', 'none', 'zero', 'history'] as const).filter((v) => v !== view).map((v) => (
          <Link key={v} href={`/${safeLocale}/preview/ask${v === 'default' ? '' : `?view=${v}`}`} className="rounded-full border border-border px-3 py-1 font-semibold text-muted-foreground">
            {v}
          </Link>
        ))}
      </div>
      <DashboardShell
        locale={safeLocale}
        email="student@example.com"
        isPro={false}
        labels={{
          dashboard: t.dashboard.nav.dashboard,
          knowledge: t.dashboard.nav.knowledge,
          agent: t.dashboard.nav.agent,
          settings: t.dashboard.nav.settings,
          appearance: t.nav.appearance,
          themeDark: t.nav.themeDark,
          themeLight: t.nav.themeLight,
          signOut: t.dashboard.nav.signOut,
        }}
      >
        {view === 'zero' ? (
          <AgentEmptyState
            newHref={`/${safeLocale}/dashboard/knowledge/new`}
            labels={{ title: t.dashboard.nav.knowledge, prompt: t.dashboard.home.newKbDesc, cta: t.dashboard.home.newSubject }}
          />
        ) : view === 'history' ? (
          <div className="h-[28rem] overflow-hidden rounded-xl border border-border">
            <PreviewHistory />
          </div>
        ) : (
          <div className="flex h-[calc(100dvh-4.5rem-6rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-xl border border-border bg-surface md:h-[calc(100dvh-4rem)]">
            <ChatBox
              kbId="00000000-0000-0000-0000-000000000000"
              kbName={ar ? 'مبادئ الاقتصاد الجزئي' : 'Microeconomics'}
              materials={materials}
            />
          </div>
        )}
      </DashboardShell>
    </div>
  )
}
