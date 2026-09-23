/**
 * WHERE A MATERIAL'S FILE IS STORED, AND THE ONE PLACE THE RULES LIVE.
 *
 * TWO KEY SCHEMES EXIST, AND BOTH ARE LIVE (register #110).
 *
 *   NEW UPLOADS (since #110):  {userId}/{kbId}/{documentId}/{safeStorageName(filename)}
 *     One folder per document, so no two rows can ever share a file. The key is
 *     written to `documents.storage_path` in the same insert that creates the
 *     row, and a partial unique index on that column enforces it in the database.
 *
 *   ROWS FROM BEFORE #110:     {userId}/{kbId}/{safeStorageName(filename)}
 *     `storage_path` is NULL, and the key is recomputed from the filename exactly
 *     as it always was. Those rows were deliberately NOT backfilled: SQL cannot
 *     reproduce `safeStorageName` exactly (JavaScript sees a character outside
 *     the Basic Multilingual Plane, such as an emoji, as TWO code units and writes
 *     `__`; Postgres sees ONE code point and would write `_`), and a backfill that
 *     pointed one row at the wrong file would be the very harm #110 exists to end.
 *
 * `effectiveStorageKey` is the only way code may locate a row's file. Upload
 * writes new keys with `documentStorageKey`; delete reads with
 * `effectiveStorageKey`. Nothing else derives a key.
 *
 * THE OLD DEFECT, AND WHAT IS LEFT OF IT. The old rule maps every character
 * outside the allowlist to `_`, so `مذكرة.pdf` and `ملخّص.pdf` both became
 * `_____.pdf`, and upload's `upsert: true` overwrote the first file's bytes.
 * New uploads cannot collide, and upload no longer overwrites (`upsert: false`).
 * Pre-#110 rows that already share a key keep sharing it; the delete path keeps
 * such a file while any other row still maps to it. Bytes already overwritten
 * are gone and cannot be recovered.
 *
 * The name part is still the B4 path-traversal fix: the client-supplied name is
 * reduced to a flat basename so the key cannot escape the user's prefix (e.g.
 * `../../evil.pdf`). Only the key is reduced; the row keeps the original name.
 */

export const DOCUMENTS_BUCKET = 'documents';

/**
 * The flat, safe basename for `clientName`, or null when nothing safe remains.
 * The caller decides what null means.
 */
export function safeStorageName(clientName: string): string | null {
  const name = ((clientName || '').split(/[/\\]/).pop() || '') // basename: drop directories
    .replace(/[\x00-\x1f\x7f]/g, '')                          // strip control chars
    .replace(/[^A-Za-z0-9._-]/g, '_')                         // allowlist
    .replace(/^\.+/, '');                                     // drop leading dots ("..", etc.)
  return name || null;
}

/**
 * The key a NEW upload is written under. The document id makes it unique; the
 * name part only keeps it readable. A name that sanitises to nothing is stored
 * as `upload`, which is safe here because the folder already makes it unique
 * and the key is stored rather than recomputed.
 */
export function documentStorageKey(
  userId: string,
  kbId: string,
  documentId: string,
  clientName: string
): string {
  return `${userId}/${kbId}/${documentId}/${safeStorageName(clientName) ?? 'upload'}`;
}

/**
 * Where a row's file is: `storage_path` when the row has one, otherwise the
 * pre-#110 rule recomputed from the filename. null when neither resolves.
 * `userId` must be the owner of the row's subject, which the caller has
 * already established through RLS.
 */
export function effectiveStorageKey(
  userId: string,
  row: { kb_id: string; filename: string; storage_path?: string | null }
): string | null {
  if (row.storage_path) return row.storage_path;
  const name = safeStorageName(row.filename);
  return name ? `${userId}/${row.kb_id}/${name}` : null;
}
