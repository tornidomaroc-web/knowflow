'use client'

import { SummarySection } from '@/components/summary/SummarySection'
import { QuizSection } from '@/components/quiz/QuizSection'
import { DeleteMaterialControl, type DeleteMaterialLabels } from '@/components/materials/DeleteMaterialControl'

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
  deleteLabels,
}: {
  docId: string
  summary: string | null
  partial: boolean
  /** #128: as the subject page, a file with no text gets no summary or quiz. */
  noText?: boolean
  deleteLabels: DeleteMaterialLabels
}) {
  return (
    <>
      {!noText && <SummarySection doc={{ id: docId, status: 'ready', summary, summary_is_partial: partial }} />}
      {!noText && <QuizSection doc={{ id: docId, status: 'ready' }} />}
      <DeleteMaterialControl documentId={docId} labels={deleteLabels} onDeleted={() => {}} />
    </>
  )
}
