import type { Locale } from '@/lib/i18n'

/**
 * WHERE A SUBJECT OPENS (activation fix 1, the 2026-11-09 audit, cause #1).
 *
 * Both students who signed up created one subject and uploaded nothing: the
 * form sent them back to the subjects LIST, one tap away from the upload tile.
 * A created subject now opens on its own page, where that tile is.
 *
 * Only a UUID is put in the path. The id comes from our own insert, but the
 * check costs nothing and means a missing or odd value can never build a path
 * to some other page: anything else falls back to the list, as before.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isSubjectId(id: unknown): id is string {
  return typeof id === 'string' && UUID.test(id)
}

/** The page a just-created subject opens on; the list when there is no usable id. */
export function subjectCreatedPath(locale: Locale, id: unknown): string {
  return isSubjectId(id) ? `/${locale}/dashboard/knowledge/${id}` : `/${locale}/dashboard/knowledge`
}
