'use client'

import { useState } from 'react'
import { SubjectChips } from '@/components/agent/SubjectChips'

/**
 * Ask's subject bar for the preview (#129 (c)): the real SubjectChips over
 * the subjects the page computed with `answerableSubjectIds`, with a local
 * selection so a tap can be tried. Nothing is fetched.
 */
export function PreviewSubjectChips({ subjects, initial }: { subjects: { id: string; name: string }[]; initial: string }) {
  const [selected, setSelected] = useState(initial)
  return (
    <div className="border-b border-border bg-surface p-3">
      <SubjectChips subjects={subjects} selectedId={selected} onPick={setSelected} />
    </div>
  )
}
