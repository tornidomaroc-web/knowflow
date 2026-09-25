import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ChatBox } from '@/components/agent/ChatBox'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { Locale, locales, useTranslation } from '@/lib/i18n'

/**
 * DESIGN PREVIEW for the Ask screen's empty conversation (review #122): the
 * real ChatBox with a literal subject and materials, in the real chrome. The
 * subject bar and history (KBSelector) are not rendered, because KBSelector
 * reads conversations through Supabase on mount; ChatBox opens no client
 * until a question is sent, and no question is sent here. 404 on production.
 */
export const metadata: Metadata = {
  title: 'Ask: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function AskPreview({ params }: { params: Promise<{ locale: string }> }) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)
  const ar = safeLocale === 'ar'

  return (
    <div className="min-h-screen">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs">
        <span className="font-semibold text-foreground">ask · preview</span>
        <span className="text-faint">{safeLocale} · empty conversation</span>
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
        <div className="flex h-[calc(100dvh-4.5rem-6rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-xl border border-border bg-surface md:h-[calc(100dvh-4rem)]">
          <ChatBox
            kbId="00000000-0000-0000-0000-000000000000"
            kbName={ar ? 'مبادئ الاقتصاد الجزئي' : 'Microeconomics'}
            materials={[
              { filename: 'xilvaroth-n11-20260810.pdf', lead: ar ? 'يشرح الفصل مرونة الطلب السعرية وعواملها.' : 'The chapter explains price elasticity of demand and its factors.' },
              { filename: ar ? 'تمارين محلولة - الفصل 3.pdf' : 'Solved exercises - Chapter 3.pdf', lead: null },
            ]}
          />
        </div>
      </DashboardShell>
    </div>
  )
}
