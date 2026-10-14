import type { Metadata } from 'next'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { notFound } from 'next/navigation'
import { ChatBox } from '@/components/agent/ChatBox'
import { AgentEmptyState } from '@/components/agent/AgentEmptyState'
import { AskTitle } from '@/components/agent/AskTitle'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { PlatformProvider } from '@/components/platform/PlatformProvider'
import { resolvePlatform } from '@/lib/platform'
import { Locale, locales, useTranslation } from '@/lib/i18n'
import { PreviewHistory } from './PreviewHistory'
import { PreviewSubjectChips } from './PreviewSubjectChips'
import { AskNoAnswerableSubject } from '@/components/agent/SubjectChips'
import { answerableSubjectIds, initialAskSubject } from '@/lib/material-text'
import { CAPTURE_CITATIONS, CAPTURE_EN, CAPTURE_QUESTION, CAPTURE_QUESTION_NEW, CAPTURE_SUBJECTS, captureAnswer } from './capture'

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
 *              (`agent.noHistory`);
 *   answer     a full conversation in the real ChatBox (Step Redesign-3): two
 *              questions, two answers, each with its sources (#124: an Arabic
 *              name with a chapter number, a Latin name, a mixed one).
 *   subjects   the subject bar (#129 (c)) over five subjects whose files mix
 *              ready, no-text, processing and failed: only the two with a
 *              file Ask can answer from are offered, computed by the real rule.
 *   noanswer   subjects exist but none can be asked (#129 (c)): the panel
 *              that sends the student to their subjects, never a blank page.
 *   capture    Step Store-Fix-2: the App Store capture's ar/04 as the phone
 *              lays it out. The card is KBSelector's on the phone (the history
 *              button and the subject bar over the conversation), the
 *              conversation the real ChatBox holding run 38618442205's
 *              question and answer as markdown (./capture.ts says which part
 *              is verbatim). `?tail=N` sets the stand-in's length, `?q=new`
 *              asks plan.json's new question.
 */
export const metadata: Metadata = {
  title: 'Ask: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

type View = 'default' | 'none' | 'zero' | 'history' | 'answer' | 'subjects' | 'noanswer' | 'capture'

export default async function AskPreview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ view?: string; platform?: string; tail?: string; q?: string }>
}) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  const safeLocale = locale as Locale
  const t = useTranslation(safeLocale)
  const ar = safeLocale === 'ar'
  const sp = await searchParams
  const raw = sp.view
  const platform = resolvePlatform(sp.platform)
  const view: View = raw === 'none' || raw === 'zero' || raw === 'history' || raw === 'answer' || raw === 'subjects' || raw === 'noanswer' || raw === 'capture' ? raw : 'default'

  // #129 (c): five subjects and their files, through the real rule.
  const kbs = [
    { id: 'k1', name: ar ? 'مبادئ الاقتصاد الجزئي' : 'Microeconomics' },
    { id: 'k2', name: ar ? 'صور المحاضرات' : 'Lecture photos' },
    { id: 'k3', name: ar ? 'الإحصاء' : 'Statistics' },
    { id: 'k4', name: ar ? 'الكيمياء العضوية' : 'Organic Chemistry' },
    { id: 'k5', name: ar ? 'تاريخ الفلسفة' : 'History of Philosophy' },
  ]
  const readyRows = [
    { kb_id: 'k1', status: 'ready', chunk_count: 12, embedding_status: 'ready' }, // text
    { kb_id: 'k1', status: 'ready', chunk_count: 0, embedding_status: 'ready' },  // no text
    { kb_id: 'k2', status: 'ready', chunk_count: 0, embedding_status: 'ready' },  // only no text
    { kb_id: 'k4', status: 'ready', chunk_count: 30, embedding_status: 'ready' }, // text
    // k3 holds only a processing file and k5 only a failed one: neither is a
    // ready row, which is all the Ask page reads.
  ]
  const answerable = answerableSubjectIds(readyRows)
  const offered = kbs.filter((k) => answerable.has(k.id))

  const materials =
    view === 'none'
      ? [{ filename: 'xilvaroth-n11-20260810.pdf', lead: null }]
      : [
          { filename: 'xilvaroth-n11-20260810.pdf', lead: ar ? 'يشرح الفصل مرونة الطلب وعواملها.' : 'The chapter explains elasticity of demand and its factors.' },
          { filename: ar ? 'تمارين محلولة - الفصل 3.pdf' : 'Solved exercises - Chapter 3.pdf', lead: null },
        ]

  // #124 and Step Redesign-3: the citation names mix an Arabic name with a
  // chapter number, a Latin name, and a mixed one.
  const conversation = [
    { role: 'user', content: ar ? 'ما هي مرونة الطلب؟' : 'What is elasticity of demand?' },
    {
      role: 'assistant',
      content: ar ? 'مرونة الطلب هي مدى تغيّر الكمية المطلوبة عند تغيّر أحد العوامل المؤثرة فيها، مثل الدخل.' : 'Elasticity of demand is how much the quantity demanded changes when one of its factors changes, such as income.',
      citations: [
        { index: 1, document_id: 'd2', chunk_id: 'c1', filename: ar ? 'تمارين محلولة - الفصل 3.pdf' : 'Solved exercises - Chapter 3.pdf', similarity: 0.91 },
        { index: 2, document_id: 'd1', chunk_id: 'c2', filename: 'xilvaroth-n11-20260810.pdf', similarity: 0.84 },
      ],
    },
    { role: 'user', content: ar ? 'أعطني مثالًا من التمارين.' : 'Give me an example from the exercises.' },
    {
      role: 'assistant',
      content: ar ? 'في التمرين الثاني ارتفع الدخل بنسبة 10% فارتفعت الكمية المطلوبة بنسبة 20%، فمرونة الطلب الدخلية تساوي 2.' : 'In exercise 2 income rose by 10% and the quantity demanded rose by 20%, so the income elasticity of demand is 2.',
      citations: [
        { index: 1, document_id: 'd2', chunk_id: 'c4', filename: ar ? 'تمارين محلولة - الفصل 3.pdf' : 'Solved exercises - Chapter 3.pdf', similarity: 0.93 },
        { index: 2, document_id: 'd6', chunk_id: 'c3', filename: ar ? 'ملخص Chapter 3 (1).pdf' : 'Summary الفصل 3 (1).pdf', similarity: 0.8 },
      ],
    },
  ]

  return (
    <div className="min-h-screen">
      <div className={sp.platform ? 'hidden' : 'flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs'}>
        <span className="font-semibold text-foreground">ask · preview</span>
        <span className="text-faint">{safeLocale} · {view}</span>
        {(['default', 'none', 'zero', 'history', 'answer', 'subjects', 'noanswer', 'capture'] as const).filter((v) => v !== view).map((v) => (
          <Link key={v} href={`/${safeLocale}/preview/ask${v === 'default' ? '' : `?view=${v}`}`} className="rounded-full border border-border px-3 py-1 font-semibold text-muted-foreground">
            {v}
          </Link>
        ))}
      </div>
      <PlatformProvider platform={platform}>
      <DashboardShell
        platform={platform}
        activeNav="agent"
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
        ) : view === 'subjects' ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <PreviewSubjectChips subjects={offered} initial={initialAskSubject(kbs.map((k) => k.id), answerable, 'k2')} />
          </div>
        ) : view === 'noanswer' ? (
          <div className="flex h-[28rem] flex-col overflow-hidden rounded-xl border border-border bg-surface">
            <AskNoAnswerableSubject href={`/${safeLocale}/dashboard/knowledge`} labels={{ title: t.dashboard.home.step2Title, cta: t.dashboard.upload.uploadButton }} />
          </div>
        ) : view === 'capture' ? (
          // As /dashboard/agent on the phone: the title, then KBSelector's card
          // (its history button and subject bar over ChatBox).
          <div className={`flex flex-col md:h-[calc(100dvh-4rem)] ${platform === 'native' ? 'h-[calc(100dvh-1.25rem-6.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]' : 'h-[calc(100dvh-4.5rem-6.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]'}`}>
            {platform === 'native' && <AskTitle text={t.dashboard.nav.agent} />}
            <div className="kf-card flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border bg-surface p-3">
                  <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground md:hidden">
                    <Menu className="h-5 w-5" />
                  </span>
                  <PreviewSubjectChips bare subjects={ar ? CAPTURE_SUBJECTS : CAPTURE_EN.subjects} initial="s1" />
                </div>
                <ChatBox
                  kbId="00000000-0000-0000-0000-000000000000"
                  kbName={ar ? CAPTURE_SUBJECTS[0].name : CAPTURE_EN.subjects[0].name}
                  materials={[]}
                  initialMessages={ar ? [
                    { role: 'user', content: sp.q === 'new' ? CAPTURE_QUESTION_NEW : CAPTURE_QUESTION },
                    { role: 'assistant', content: captureAnswer(Number(sp.tail) || 0), citations: CAPTURE_CITATIONS },
                  ] : [
                    { role: 'user', content: CAPTURE_EN.question },
                    { role: 'assistant', content: CAPTURE_EN.answer, citations: CAPTURE_EN.citations },
                  ]}
                />
              </div>
            </div>
          </div>
        ) : view === 'history' ? (
          <div className="h-[28rem] overflow-hidden rounded-xl border border-border">
            <PreviewHistory />
          </div>
        ) : (
          // Step Redesign-3: the default (an empty conversation) and `answer`
          // (a full conversation: two questions, two answers, each answer with
          // its sources under "Sources") are the REAL ChatBox at the page's
          // height, as /dashboard/agent lays it out: the large title inside
          // the app, the conversation scrolling, the composer at the bottom.
          <div className={`flex flex-col md:h-[calc(100dvh-4rem)] ${platform === 'native' ? 'h-[calc(100dvh-1.25rem-6.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]' : 'h-[calc(100dvh-4.5rem-6.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]'}`}>
            {platform === 'native' && <AskTitle text={t.dashboard.nav.agent} />}
            <div className="kf-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
              <ChatBox
                kbId="00000000-0000-0000-0000-000000000000"
                kbName={ar ? 'مبادئ الاقتصاد الجزئي' : 'Microeconomics'}
                materials={materials}
                initialMessages={view === 'answer' ? conversation : null}
              />
            </div>
          </div>
        )}
      </DashboardShell>
      </PlatformProvider>
    </div>
  )
}
