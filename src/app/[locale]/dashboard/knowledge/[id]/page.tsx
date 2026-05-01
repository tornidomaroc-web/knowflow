'use client'
import React from 'react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DropZone } from '@/components/upload/DropZone'

interface Document {
  id: string
  filename: string
  file_type: string
  status: string
  chunk_count: number
  created_at: string
}

interface KB {
  id: string
  name: string
  description: string
  language: string
}

export default function KBDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
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
    if (s === 'ready') return '#2eff8c'
    if (s === 'processing') return '#f59e0b'
    if (s === 'error') return '#ef4444'
    return '#6b7d6e'
  }

  return (
    <div className="text-white max-w-4xl">
      <div className="mb-8">
        <h1 style={{fontFamily:'var(--font-playfair)'}}
            className="text-3xl font-bold mb-2">
          {kb?.name || '...'}
        </h1>
        <p className="text-[#6b7d6e] text-sm">{kb?.description}</p>
      </div>

      <div className="mb-8">
        <DropZone kbId={id} onSuccess={(doc) => setDocs(prev => [doc, ...prev])} />
      </div>

      <div>
        <h2 style={{fontFamily:'var(--font-mono)'}}
            className="text-xs uppercase tracking-widest text-[#6b7d6e] mb-4">
          Documents
        </h2>
        {docs.length === 0 ? (
          <div className="border border-dashed border-[#1a2e1e] p-8 text-center text-[#6b7d6e] text-sm">
            No documents yet. Upload your first file above.
          </div>
        ) : (
          <div className="border border-[#1a2e1e]">
            {docs.map((doc, i) => (
              <div key={doc.id}
                   className={`flex items-center justify-between p-4 ${i !== docs.length-1 ? 'border-b border-[#1a2e1e]' : ''}`}>
                <div>
                  <p className="text-sm text-white">{doc.filename}</p>
                  <p className="text-xs text-[#6b7d6e] mt-1">{doc.file_type?.toUpperCase()} · {doc.chunk_count} chunks</p>
                </div>
                <span style={{color: statusColor(doc.status), fontFamily:'var(--font-mono)'}}
                      className="text-xs uppercase tracking-widest">
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
