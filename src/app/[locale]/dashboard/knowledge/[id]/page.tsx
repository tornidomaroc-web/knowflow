'use client'
import React from 'react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DropZone } from '@/components/upload/DropZone'
import { SummarySection } from '@/components/summary/SummarySection'
import type { Document } from '@/types'
import { Locale, locales, useTranslation } from '@/lib/i18n'

interface KB {
  id: string
  name: string
  description: string
  language: string
}

export default function KBDetailPage({ params }: { params: Promise<{ id: string; locale: Locale }> }) {
  const { id, locale } = React.use(params)
  const safeLocale: Locale = locales.includes(locale) ? locale : 'en'
  const t = useTranslation(safeLocale)
  const [kb, setKb] = useState<KB | null>(null)
  const [docs, setDocs] = useState<Document[]>([])
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
      setDocs(docsData || [])
    }
    load()
  }, [id])

  const statusColor = (s: string) => {
    if (s === 'ready') return 'text-primary'
    if (s === 'processing') return 'text-amber-700'
    if (s === 'error') return 'text-red-700'
    return 'text-muted-foreground'
  }

  return (
    <div>
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{kb?.name || '...'}</h1>
          {kb?.description ? <p className="mt-1 text-sm text-muted-foreground">{kb.description}</p> : null}
        </header>

        <DropZone kbId={id} onSuccess={(doc) => setDocs(prev => [doc, ...prev])} />

        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.dashboard.kbDetail.documents}
          </h2>
          {docs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
              {t.dashboard.kbDetail.noDocuments}
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
              {docs.map((doc) => (
                <div key={doc.id} className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{doc.filename}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {doc.file_type?.toUpperCase()} · {doc.chunk_count} {t.dashboard.kbDetail.chunks}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium uppercase tracking-wide ${statusColor(doc.status)}`}>
                      {doc.status}
                    </span>
                  </div>
                  <SummarySection doc={doc} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
