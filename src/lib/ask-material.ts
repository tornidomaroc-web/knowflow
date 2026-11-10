import { isAnswerable, type MaterialTextFields } from '@/lib/material-text';

/**
 * ACTIVATION 5, AUDIT CAUSE #6: ASKING IN A SUBJECT WITH NO FILE TO ANSWER FROM.
 *
 * `/api/agent` counted the question (`enforceLimit(user, 'query')`), opened a
 * conversation (the monthly count) and called the model before it knew the
 * subject held nothing, so a student who asked in an empty subject paid a
 * question and got "I can't find that in your materials".
 *
 * "Ready" is the rule the code already uses for Ask (register #129):
 * `isAnswerable` in src/lib/material-text.ts, i.e. `status === 'ready'` and not
 * a file with no text (`hasNoText`: ready, `embedding_status` 'ready',
 * `chunk_count` 0). A processing, failed or textless file does not count.
 *
 * The route now reads the subject's ready rows (RLS-scoped, so another
 * account's subject reads as empty) before any counter, and when none is
 * answerable answers 409 with `X-KF-Refusal: no_material`: nothing counted,
 * no conversation, no embedding, no model call. The chat shows the way to the
 * subject's upload tile in place of the reply (`AskNoMaterial`).
 */
export const NO_MATERIAL_REFUSAL = 'no_material';

export function hasAnswerableMaterial(rows: MaterialTextFields[] | null | undefined): boolean {
  return (rows ?? []).some(isAnswerable);
}

/** Where a subject's upload tile is: the subject's own page, which opens on it. */
export function subjectUploadHref(locale: string, kbId: string): string {
  return `/${locale}/dashboard/knowledge/${kbId}`;
}
