'use client'
import React from 'react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DropZone } from '@/components/upload/DropZone'
import { SummarySection } from '@/components/summary/SummarySection'
import { QuizSection } from '@/components/quiz/QuizSection'
import { DeleteMaterialControl } from '@/components/materials/DeleteMaterialControl'
import { RenameMaterialControl } from '@/components/materials/RenameMaterialControl'
import { SubjectHeader } from '@/components/materials/SubjectHeader'
import { MaterialCard } from '@/components/materials/MaterialCard'
import type { Document } from '@/types'
import { Locale, useTranslation, resolveLocale } from '@/lib/i18n'
import { withSupportEmail } from '@/lib/site'
import { subjectStats, emptyStats } from '@/lib/subject-stats'

interface KB {
  id: string
  name: string
  description: string
  language: string
}

export default function KBDetailPage({ params }: { params: Promise<{ id: string; locale: Locale }> }) {
  const { id, locale } = React.use(params)
  const safeLocale: Locale = resolveLocale(locale)
  const t = useTranslation(safeLocale)
  const [kb, setKb] = useState<KB | null>(null)
  const [docs, setDocs] = useState<Document[]>([])
  // Register #85 (SIGNED_IN_FEATURES.md 2.2): which materials already have a
  // quiz, in any language, for the study-kit checklist. One read of the
  // subject's quizzes by document id; RLS scopes it to the caller.
  const [quizzedIds, setQuizzedIds] = useState<Set<string>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: kbData } = await supabase
        .from('knowledge_bases')
        .select('*')
        .eq('id', id)
        .single()
      setKb(kbData)

      const { data: docsData } = await supabase
        .from('documents')
        .select('*')
        .eq('kb_id', id)
        .order('created_at', { ascending: false })
      // `<Database>` types documents.file_type as `string | null` (the column is
      // bare `text`, no check constraint); Document narrows it to the app-enforced
      // extension union. The ingest route validates every written value against
      // ALLOWED_TYPES, whose keys are exactly that union, so this cast asserts an
      // app invariant — not a DB-guaranteed one.
      const list = (docsData || []) as Document[]
      setDocs(list)

      if (list.length) {
        const { data: quizRows } = await supabase
          .from('quizzes')
          .select('document_id')
          .in('document_id', list.map((d) => d.id))
        setQuizzedIds(new Set((quizRows ?? []).map((q) => q.document_id)))
      }
    }
    load()
  }, [id])

  const stats = kb
    ? subjectStats(
        docs.map((d) => ({ id: d.id, kb_id: d.kb_id, status: d.status, summary_generated_at: d.summary_generated_at, created_at: d.created_at })),
        Array.from(quizzedIds).map((document_id) => ({ document_id })),
        []
      ).get(kb.id) ?? emptyStats()
    : emptyStats()

  const sd = t.dashboard.subjectDetail
  const cardLabels = {
    chunks: t.dashboard.kbDetail.chunks,
    statusReady: sd.statusReady,
    statusProcessing: sd.statusProcessing,
    statusError: sd.statusError,
    checklist: sd.checklist,
    summaryDone: sd.summaryDone,
    summaryTodo: sd.summaryTodo,
    quizDone: sd.quizDone,
    quizTodo: sd.quizTodo,
    added: sd.added,
  }

  return (
    <div>
      <div className="mx-auto max-w-4xl space-y-6">
        {kb ? (
          <SubjectHeader
            name={kb.name}
            description={kb.description}
            stats={stats}
            askHref={`/${safeLocale}/dashboard/agent?kb=${kb.id}`}
            labels={{
              materials: t.dashboard.home.documents,
              summarised: t.dashboard.subjects.summarised,
              quizzed: t.dashboard.subjects.quizzed,
              stillProcessing: sd.stillProcessing,
              askAbout: sd.askAbout,
            }}
          />
        ) : (
          <header>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">...</h1>
          </header>
        )}

        <DropZone kbId={id} onSuccess={(doc) => setDocs(prev => [doc, ...prev])} />

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            {t.dashboard.kbDetail.documents}
          </h2>
          {docs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
              {t.dashboard.kbDetail.noDocuments}
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => (
                <MaterialCard
                  key={doc.id}
                  filename={doc.filename}
                  fileType={doc.file_type}
                  chunkCount={doc.chunk_count}
                  status={doc.status}
                  addedAt={doc.created_at}
                  locale={safeLocale}
                  hasSummary={Boolean(doc.summary_generated_at)}
                  hasQuiz={quizzedIds.has(doc.id)}
                  labels={cardLabels}
                >
                  <SummarySection doc={doc} />
                  <QuizSection doc={doc} />
                  {/* #47: Rename beside Delete. The row wraps, and an open rename
                      panel takes the full width, so neither control squeezes the other. */}
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <RenameMaterialControl
                      documentId={doc.id}
                      filename={doc.filename}
                      labels={withSupportEmail(t.dashboard.kbDetail.renameMaterial)}
                      onRenamed={(renamedId, filename) => setDocs(prev => prev.map(d => (d.id === renamedId ? { ...d, filename } : d)))}
                      onGone={(goneId) => setDocs(prev => prev.filter(d => d.id !== goneId))}
                    />
                    <DeleteMaterialControl
                      documentId={doc.id}
                      labels={withSupportEmail(t.dashboard.kbDetail.deleteMaterial)}
                      onDeleted={(deletedId) => setDocs(prev => prev.filter(d => d.id !== deletedId))}
                    />
                  </div>
                </MaterialCard>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
