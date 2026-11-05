'use client'

import { SummarySection } from '@/components/summary/SummarySection'
import { QuizSection } from '@/components/quiz/QuizSection'
import { DeleteMaterialControl, type DeleteMaterialLabels } from '@/components/materials/DeleteMaterialControl'
import { RenameMaterialControl, type RenameMaterialLabels } from '@/components/materials/RenameMaterialControl'

/**
 * A material's study kit and delete control, for the subject preview (#123,
 * batch 2): the real SummarySection, QuizSection and DeleteMaterialControl, as
 * the subject page renders them. None of them fetches on open. A click on
 * "summarize", "quiz me" or a confirmed delete reaches its route with no
 * session, which answers 401 before it reads anything, so the preview shows
 * the session-expired line and nothing is written.
 */
export function PreviewStudyKit({
  docId,
  summary,
  partial,
  noText = false,
  quizEmpty = false,
  deleteLabels,
  rename,
}: {
  docId: string
  summary: string | null
  partial: boolean
  /** #128: as the subject page, a file with no text gets no summary or quiz. */
  noText?: boolean
  /** Step Redesign-3: the quiz panel on its drawn "no quiz from this file" state. */
  quizEmpty?: boolean
  deleteLabels: DeleteMaterialLabels
  /** Design "C", PR 3: the idle Rename beside Delete, as the subject page renders the pair (nothing is sent unless saved). */
  rename?: { filename: string; labels: RenameMaterialLabels }
}) {
  return (
    <>
      {!noText && <SummarySection doc={{ id: docId, status: 'ready', summary, summary_is_partial: partial }} />}
      {!noText && <QuizSection doc={{ id: docId, status: 'ready' }} previewEmpty={quizEmpty} />}
      <DeleteMaterialControl documentId={docId} labels={deleteLabels} onDeleted={() => {}} />
      {rename && <RenameMaterialControl documentId={docId} filename={rename.filename} labels={rename.labels} onRenamed={() => {}} onGone={() => {}} />}
    </>
  )
}
