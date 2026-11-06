import type { Metadata } from 'next'
import Link from 'next/link'
import { ClayClock } from '@/components/clay/ClayIcons'
import { KBSelector } from '@/components/agent/KBSelector'
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
import type { KnowledgeBase } from '@/types'
import LONG from './long.json'
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
 *   app        Design "C", PR 4: the screen exactly as /dashboard/agent builds
 *              it, the REAL KBSelector (the history button or column, the
 *              subject bar, ChatBox) over the five subjects above, with a
 *              history of five past conversations as literal data
 *              (KBSelector's `preview`: nothing is read from Supabase).
 *              `?open=c2` opens the long one as if picked from the history;
 *              `?drawer=1` opens the phone's history drawer. A question typed
 *              here goes to /api/agent like any other (the proof run answers
 *              it in the browser; nothing reaches a server route).
 */
export const metadata: Metadata = {
  title: 'Ask: design preview',
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

type View = 'default' | 'none' | 'zero' | 'history' | 'answer' | 'subjects' | 'noanswer' | 'capture' | 'app'

export default async function AskPreview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ view?: string; platform?: string; tail?: string; q?: string; open?: string; drawer?: string }>
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
  const view: View = raw === 'none' || raw === 'zero' || raw === 'history' || raw === 'answer' || raw === 'subjects' || raw === 'noanswer' || raw === 'capture' || raw === 'app' ? raw : 'default'

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

  // Design "C", PR 4 (`view=app`): five past conversations, newest first, in
  // two subjects; c2 is a long one (a long question, an answer with a
  // heading and a list, three sources, then a question and an answer in the
  // other language). The messages table stores no sources; the preview
  // passes them so the opened conversation shows its pills.
  const day = (d: number) => new Date(Date.UTC(2026, 10, d, 9, 30)).toISOString()
  const appKbs = kbs.map((k) => ({ ...k, user_id: 'u', description: null, language: ar ? 'ar' : 'en', created_at: day(1) })) as unknown as KnowledgeBase[]
  const historyList = [
    { id: 'c1', kb_id: 'k1', created_at: day(5), knowledge_bases: { name: kbs[0].name } },
    { id: 'c2', kb_id: 'k4', created_at: day(4), knowledge_bases: { name: kbs[3].name } },
    { id: 'c3', kb_id: 'k1', created_at: day(2), knowledge_bases: { name: kbs[0].name } },
    { id: 'c4', kb_id: 'k4', created_at: day(1), knowledge_bases: { name: kbs[3].name } },
    { id: 'c5', kb_id: 'k1', created_at: new Date(Date.UTC(2026, 9, 28, 18, 0)).toISOString(), knowledge_bases: { name: kbs[0].name } },
  ]
  // G2: a source's page, as the route sends it: [start, end, kind], or none.
  const chem = (i: number, id: string, f: string, sim: number, p?: [number, number, 'page' | 'slide']) => ({
    index: i, document_id: id, chunk_id: `${id}-${i}`, filename: f, similarity: sim,
    page_start: p ? p[0] : null, page_end: p ? p[1] : null, page_kind: p ? p[2] : null,
  })
  const summaryFile = ar ? 'ملخص الكيمياء العضوية - الفصل 7.pdf' : 'Organic Chemistry summary - Chapter 7.pdf'
  const historyMessages = {
    c2: [
      { role: 'user', content: LONG[safeLocale].question },
      {
        role: 'assistant',
        content: LONG[safeLocale].answer,
        // G2: a single page, a range, a slide and a file with no known page.
        citations: [
          chem(1, 'o1', summaryFile, 0.92, [12, 12, 'page']),
          chem(2, 'o2', 'reactions-cheatsheet-v3.pdf', 0.86, [3, 4, 'page']),
          chem(3, 'o3', ar ? 'محاضرة Reactions (2).pptx' : 'Lecture التفاعلات (2).pptx', 0.81, [5, 5, 'slide']),
          chem(4, 'o4', ar ? 'ملاحظات المحاضرة السابعة.docx' : 'Lecture 7 notes.docx', 0.78),
        ],
      },
      { role: 'user', content: LONG[safeLocale].otherQuestion },
      { role: 'assistant', content: LONG[safeLocale].otherAnswer, citations: [chem(1, 'o1', summaryFile, 0.9, [12, 12, 'page']), chem(2, 'o2', 'reactions-cheatsheet-v3.pdf', 0.83, [3, 4, 'page'])] },
    ],
    c1: conversation,
  }
  const appMaterials = materials.map((m, i) => ({ id: `m${i}`, kb_id: 'k1', filename: m.filename, lead: m.lead }))

  return (
    <div className="min-h-screen">
      <div className={sp.platform ? 'hidden' : 'flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-xs'}>
        <span className="font-semibold text-foreground">ask · preview</span>
        <span className="text-faint">{safeLocale} · {view}</span>
        {(['default', 'none', 'zero', 'history', 'answer', 'subjects', 'noanswer', 'capture', 'app'] as const).filter((v) => v !== view).map((v) => (
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
          <div className="kf-card overflow-hidden rounded-xl">
            <PreviewSubjectChips subjects={offered} initial={initialAskSubject(kbs.map((k) => k.id), answerable, 'k2')} />
          </div>
        ) : view === 'noanswer' ? (
          <div className="kf-card flex h-[28rem] flex-col overflow-hidden rounded-xl bg-surface">
            <AskNoAnswerableSubject href={`/${safeLocale}/dashboard/knowledge`} labels={{ title: t.dashboard.home.step2Title, cta: t.dashboard.upload.uploadButton }} />
          </div>
        ) : view === 'capture' ? (
          // As /dashboard/agent on the phone: the title, then KBSelector's card
          // (its history button and subject bar over ChatBox).
          <div className={`flex flex-col md:h-[calc(100dvh-4rem)] ${platform === 'native' ? 'h-[calc(100dvh-1.25rem-6.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]' : 'h-[calc(100dvh-4.5rem-6.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]'}`}>
            {platform === 'native' && <AskTitle text={t.dashboard.nav.agent} />}
            <div className="kf-card flex min-h-0 flex-1 overflow-hidden rounded-xl bg-surface">
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Design "C", PR 4: KBSelector's bar as it now is (the clock pill, no hairline). */}
                <div className="flex items-center gap-2 bg-surface p-3">
                  <span aria-hidden="true" className="kf-pill inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full md:hidden">
                    <ClayClock width={22} height={22} />
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
        ) : view === 'app' ? (
          // As /dashboard/agent: the same height rule, the large title in the
          // app, then the real KBSelector.
          <div className={`flex flex-col md:h-[calc(100dvh-4rem)] ${platform === 'native' ? 'h-[calc(100dvh-1.25rem-6.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]' : 'h-[calc(100dvh-4.5rem-6.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]'}`}>
            {platform === 'native' && <AskTitle text={t.dashboard.nav.agent} />}
            <KBSelector
              kbs={appKbs}
              materials={appMaterials}
              answerableIds={[...answerable]}
              preview={{ conversations: historyList, messages: historyMessages, open: sp.open, drawer: sp.drawer === '1' }}
            />
          </div>
        ) : view === 'history' ? (
          <div className="kf-card h-[28rem] overflow-hidden rounded-xl">
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
            <div className="kf-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface">
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
