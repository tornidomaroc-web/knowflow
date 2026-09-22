/**
 * THE STORAGE KEY A MATERIAL IS WRITTEN UNDER, AND THE ONE PLACE THE RULE LIVES.
 *
 * A material's file sits in the `documents` bucket at
 * `{userId}/{kbId}/{safeStorageName(filename)}`. The key is NOT stored on the
 * `documents` row, so upload and delete both derive it from the filename, and
 * both must call THIS function. If they ever disagreed, the delete path would
 * remove the wrong file or leave the right one behind (register #47).
 *
 * The rule is the B4 path-traversal fix, lifted out of `/api/ingest` unchanged:
 * reduce the client-supplied name to a flat basename so the key cannot escape
 * the user's prefix (e.g. `../../evil.pdf`). Only the key is reduced; the row
 * keeps the original name for display.
 *
 * KNOWN DEFECT, NOT FIXED HERE: every character outside the allowlist becomes
 * `_`, so two different Arabic names of the same shape share ONE key --
 * `مذكرة.pdf` and `ملخّص.pdf` both become `_____.pdf` -- and the upload path's
 * `upsert: true` overwrites the first file's bytes. The delete path therefore
 * keeps a file while any other row in the subject still maps to it.
 */

export const DOCUMENTS_BUCKET = 'documents';

/**
 * The flat, safe basename for `clientName`, or null when nothing safe remains.
 * The caller decides what null means: the upload path falls back to a
 * time-based name, and the delete path refuses, because a time-based name
 * cannot be recomputed from the row.
 */
export function safeStorageName(clientName: string): string | null {
  const name = ((clientName || '').split(/[/\\]/).pop() || '') // basename: drop directories
    .replace(/[\x00-\x1f\x7f]/g, '')                          // strip control chars
    .replace(/[^A-Za-z0-9._-]/g, '_')                         // allowlist
    .replace(/^\.+/, '');                                     // drop leading dots ("..", etc.)
  return name || null;
}
